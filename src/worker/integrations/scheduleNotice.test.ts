import { describe, expect, it } from "vitest";
import {
  deterministicScheduleNotice,
  draftScheduleNotice,
  formatSlotWindow,
  type ScheduleNoticeInput,
} from "./scheduleNotice";

const INPUT: ScheduleNoticeInput = {
  eventName: "Horizon Dev Summit 2026",
  talkTitle: "RAG Is Dead, Long Live RAG",
  speakerNames: ["Marco Reyes", "Lin Zhao"],
  slotSummary: "Thursday, September 10 · 2:30 – 3:15 PM PDT",
  roomName: "Main Hall",
  scheduleUrl: "https://lectern.example/e/horizon-2026",
  icsUrl: "https://lectern.example/api/public/events/horizon-2026/sessions/ses_1/calendar.ics",
  note: "gave them the post-keynote slot — biggest room of the day",
};

function fakeAnthropic(responder: () => { status?: number; body?: unknown }) {
  const calls: { body: Record<string, unknown> }[] = [];
  const fetcher = (async (_url: string | URL, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body)) });
    const { status = 200, body = {} } = responder();
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("formatSlotWindow", () => {
  it("renders the window in the event timezone with a timezone label", () => {
    const formatted = formatSlotWindow(
      "2026-09-10T21:30:00Z",
      "2026-09-10T22:15:00Z",
      "America/Los_Angeles",
    );
    expect(formatted).toContain("Thursday, September 10");
    expect(formatted).toContain("2:30");
    expect(formatted).toContain("3:15");
    expect(formatted).toMatch(/PDT|PT/);
  });
});

describe("deterministicScheduleNotice", () => {
  it("carries the slot, room, both links, and greets every speaker", () => {
    const draft = deterministicScheduleNotice(INPUT);
    expect(draft.subject).toContain("RAG Is Dead");
    expect(draft.bodyMd).toContain("Hi Marco and Lin,");
    expect(draft.bodyMd).toContain("When: Thursday, September 10 · 2:30 – 3:15 PM PDT");
    expect(draft.bodyMd).toContain("Where: Main Hall");
    expect(draft.bodyMd).toContain(INPUT.scheduleUrl);
    expect(draft.bodyMd).toContain(INPUT.icsUrl);
    // The internal note never leaks.
    expect(draft.bodyMd).not.toContain("biggest room of the day");
    expect(draft.note).toContain("internal note was not copied");
  });

  it("handles a missing room and three or more speakers", () => {
    const draft = deterministicScheduleNotice({
      ...INPUT,
      roomName: null,
      speakerNames: ["Ada Okafor", "Omar Haddad", "Yuki Tanaka"],
    });
    expect(draft.bodyMd).toContain("Hi Ada, Omar and Yuki,");
    expect(draft.bodyMd).toContain("Room to be announced");
  });
});

describe("draftScheduleNotice", () => {
  it("uses the template when no key is configured", async () => {
    const draft = await draftScheduleNotice(INPUT, {});
    expect(draft.aiUsed).toBe(false);
    expect(draft.bodyMd).toContain("When: Thursday, September 10");
  });

  it("sends the verbatim slot facts to the model", async () => {
    const { fetcher, calls } = fakeAnthropic(() => ({
      body: {
        id: "msg_notice",
        model: "claude-sonnet-5",
        usage: { input_tokens: 40, output_tokens: 60 },
        content: [
          {
            type: "tool_use",
            input: {
              subject: "S",
              body: `Body\nWhen: ${INPUT.slotSummary}\nWhere: Main Hall\n${INPUT.icsUrl}\n${INPUT.scheduleUrl}`,
            },
          },
        ],
      },
    }));
    const draft = await draftScheduleNotice(INPUT, { apiKey: "k", fetcher });
    const sent = JSON.stringify(calls[0]!.body.messages);
    expect(sent).toContain("When: Thursday, September 10");
    expect(sent).toContain("never restate the time or room in your own words");
    expect(draft.aiUsed).toBe(true);
    // Facts already present — nothing appended twice.
    expect(draft.bodyMd.match(/When: Thursday/g)).toHaveLength(1);
  });

  it("guarantees the slot block and calendar link when the AI omits them", async () => {
    const { fetcher } = fakeAnthropic(() => ({
      body: {
        id: "msg_lossy",
        model: "claude-sonnet-5",
        usage: { input_tokens: 40, output_tokens: 30 },
        content: [
          {
            type: "tool_use",
            input: { subject: "You're on!", body: "Hi Marco and Lin,\n\nSee you soon." },
          },
        ],
      },
    }));
    const draft = await draftScheduleNotice(INPUT, { apiKey: "k", fetcher });
    expect(draft.aiUsed).toBe(true);
    expect(draft.bodyMd).toContain("When: Thursday, September 10 · 2:30 – 3:15 PM PDT");
    expect(draft.bodyMd).toContain("Where: Main Hall");
    expect(draft.bodyMd).toContain(INPUT.icsUrl);
  });

  it("falls back to the template on an API error, with a note", async () => {
    const { fetcher } = fakeAnthropic(() => ({ status: 529, body: { error: "overloaded" } }));
    const draft = await draftScheduleNotice(INPUT, { apiKey: "k", fetcher });
    expect(draft.aiUsed).toBe(false);
    expect(draft.note).toContain("AI drafting unavailable");
    expect(draft.bodyMd).toContain("When: Thursday, September 10");
  });
});
