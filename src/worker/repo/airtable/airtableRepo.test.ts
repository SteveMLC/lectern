import { describe, expect, it, vi } from "vitest";
import { AirtableRepo } from "./airtableRepo";

const eventFields = {
  "SpeakerOps ID": "evt_airtable",
  Slug: "airtable-summit",
  Name: "Airtable Summit",
  Tagline: "Operations in a base",
  Description: "Proof event",
  "Starts On": "2026-10-14",
  "Ends On": "2026-10-15",
  Timezone: "America/New_York",
  Venue: "Main Hall",
  "Website URL": "https://example.com",
  "Created At": "2026-08-01T00:00:00Z",
  "Updated At": "2026-08-01T00:00:00Z",
};

const speakerFields = {
  "SpeakerOps ID": "spk_airtable",
  "Event ID": "evt_airtable",
  Email: "speaker@example.com",
  Name: "Avery Speaker",
  Company: "Example Co",
  Title: "Engineer",
  Bio: "A speaker stored in Airtable.",
  Location: "New York",
  Socials: '{"website":"https://example.com/avery"}',
  "Created At": "2026-08-01T00:00:00Z",
  "Updated At": "2026-08-01T00:00:00Z",
};

describe("AirtableRepo proof adapter", () => {
  it("reads cached operations data and writes a simulated message under the rate limit", async () => {
    let now = 0;
    const waits: number[] = [];
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/Events")) {
        return Response.json({ records: [{ id: "rec_event", fields: eventFields }] });
      }
      if (url.includes("/Speakers")) {
        return Response.json({ records: [{ id: "rec_speaker", fields: speakerFields }] });
      }
      if (url.includes("/Messages") && init?.method === "POST") {
        return Response.json({ records: [{ id: "rec_message", fields: {} }] }, { status: 201 });
      }
      return new Response("unexpected", { status: 500 });
    });
    const repo = new AirtableRepo({
      token: "pat_test",
      baseId: "app_test",
      fetcher: fetchMock as unknown as typeof fetch,
      clock: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });

    expect(await repo.health()).toBe(true);
    expect((await repo.listEvents())[0]?.slug).toBe("airtable-summit");
    expect((await repo.getEventBySlug("airtable-summit"))?.event.name).toBe("Airtable Summit");
    expect((await repo.getSpeakerById("spk_airtable"))?.email).toBe("speaker@example.com");
    await repo.simulateCommunication({
      messageId: "msg_test",
      attemptId: "del_test",
      eventId: "evt_airtable",
      speakerId: "spk_airtable",
      toEmail: "speaker@example.com",
      subject: "Reminder",
      bodyMd: "Please finish your tasks.",
      now: "2026-08-10T05:00:00Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([210, 210]);
    const messageCall = fetchMock.mock.calls[2]!;
    const payload = JSON.parse(String(messageCall[1]?.body)) as {
      records: { fields: Record<string, string> }[];
    };
    expect(payload.records[0]?.fields).toMatchObject({
      "SpeakerOps ID": "msg_test",
      Status: "sent_simulated",
      "Delivery Mode": "simulated",
      "Delivery Status": "success",
    });
  });

  it("retries Airtable 429 responses using Retry-After", async () => {
    let now = 0;
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(Response.json({ records: [{ id: "rec_event", fields: eventFields }] }));
    const repo = new AirtableRepo({
      token: "pat_test",
      baseId: "app_test",
      fetcher: fetchMock as unknown as typeof fetch,
      clock: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });

    expect(await repo.health()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waits).toContain(1000);
  });
});
