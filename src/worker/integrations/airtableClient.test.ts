import { describe, expect, it } from "vitest";
import type { MirrorCreate, MirrorUpdate } from "../../shared/domain/airtableMirror";
import { AirtableClient, AirtableError } from "./airtableClient";

/**
 * These tests run against a fake Airtable using a virtual clock, so they prove
 * the rate-limit and batching behaviour that would otherwise only show up as
 * 429s during live judging.
 */

interface Call {
  url: string;
  method: string;
  body: unknown;
  at: number;
}

function harness(responder: (call: Call) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  let now = 0;
  const calls: Call[] = [];

  const clock = () => now;
  // Virtual sleep: advances the clock instantly so tests stay fast.
  const sleep = async (ms: number) => {
    now += ms;
  };

  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      at: now,
    };
    calls.push(call);
    const { status = 200, body = {}, headers = {} } = responder(call);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as unknown as typeof fetch;

  const client = new AirtableClient({
    token: "pat_fake_token",
    baseId: "appFAKE",
    fetcher,
    clock,
    sleep,
  });

  return { client, calls, advance: (ms: number) => (now += ms) };
}

const creates = (n: number): MirrorCreate[] =>
  Array.from({ length: n }, (_, i) => ({
    table: "Speakers" as const,
    internalId: `spk_${i}`,
    fields: { Name: `Speaker ${i}` },
  }));

describe("rate limiting", () => {
  it("spaces requests at least 210ms apart, staying under 5 per second", async () => {
    const { client, calls } = harness(() => ({ body: { records: [] } }));

    await Promise.all([
      client.listTableNames(),
      client.listTableNames(),
      client.listTableNames(),
      client.listTableNames(),
      client.listTableNames(),
    ]);

    expect(calls).toHaveLength(5);
    for (let i = 1; i < calls.length; i++) {
      const gap = calls[i]!.at - calls[i - 1]!.at;
      expect(gap).toBeGreaterThanOrEqual(210);
    }
    // Five requests must span at least ~4 gaps, i.e. more than 800ms of budget.
    expect(calls[4]!.at - calls[0]!.at).toBeGreaterThanOrEqual(840);
  });

  it("serialises concurrent callers rather than bursting", async () => {
    const { client, calls } = harness(() => ({ body: { records: [] } }));
    await Promise.all(Array.from({ length: 8 }, () => client.listTableNames()));
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i]!.at);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(210);
  });
});

describe("429 handling", () => {
  it("retries after the server's Retry-After and then succeeds", async () => {
    let hits = 0;
    const { client, calls } = harness(() => {
      hits += 1;
      if (hits === 1) return { status: 429, headers: { "retry-after": "2" }, body: {} };
      return { body: { tables: [{ name: "Events" }] } };
    });

    const tables = await client.listTableNames();
    expect(tables).toEqual(["Events"]);
    expect(calls).toHaveLength(2);
    // Waited the full 2s the server asked for.
    expect(calls[1]!.at - calls[0]!.at).toBeGreaterThanOrEqual(2000);
  });

  it("gives up after repeated 429s instead of looping forever", async () => {
    const { client, calls } = harness(() => ({
      status: 429,
      headers: { "retry-after": "1" },
      body: {},
    }));
    await expect(client.listTableNames()).rejects.toBeInstanceOf(AirtableError);
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it("surfaces other errors immediately with the status", async () => {
    const { client } = harness(() => ({ status: 401, body: { error: "unauthorized" } }));
    await expect(client.listTableNames()).rejects.toMatchObject({ status: 401 });
  });
});

describe("writes", () => {
  it("sends at most 10 records per create request", async () => {
    const { client, calls } = harness((call) => ({
      body: {
        records: ((call.body as { records: unknown[] }).records ?? []).map((_, i) => ({
          id: `rec${i}`,
          fields: {},
        })),
      },
    }));

    await client.createRecords("Speakers", creates(10));
    const sent = (calls[0]!.body as { records: unknown[] }).records;
    expect(sent).toHaveLength(10);
  });

  it("maps each internal id to the Airtable record id it became", async () => {
    const { client } = harness((call) => ({
      body: {
        records: ((call.body as { records: unknown[] }).records ?? []).map((_, i) => ({
          id: `recNEW${i}`,
          fields: {},
        })),
      },
    }));

    const mapping = await client.createRecords("Speakers", creates(3));
    expect(mapping.get("spk_0")).toBe("recNEW0");
    expect(mapping.get("spk_1")).toBe("recNEW1");
    expect(mapping.get("spk_2")).toBe("recNEW2");
  });

  it("issues no request for an empty batch", async () => {
    const { client, calls } = harness(() => ({ body: {} }));
    await client.createRecords("Speakers", []);
    await client.updateRecords("Speakers", []);
    expect(calls).toHaveLength(0);
  });

  it("updates by record id with PATCH", async () => {
    const { client, calls } = harness(() => ({ body: { records: [] } }));
    const updates: MirrorUpdate[] = [
      { table: "Speakers", internalId: "spk_a", recordId: "recAAA", fields: { Name: "Ada" } },
    ];
    await client.updateRecords("Speakers", updates);
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.body).toMatchObject({
      records: [{ id: "recAAA", fields: { Name: "Ada" } }],
    });
  });
});

describe("schema provisioning", () => {
  const fullFields = (table: "Events" | "Speakers") =>
    table === "Events"
      ? ["SpeakerOps ID", "Name", "Slug", "Tagline", "Starts On", "Ends On", "Timezone", "Venue"].map(
          (name) => ({ name }),
        )
      : ["SpeakerOps ID", "Name", "Email", "Company", "Title", "Bio", "Location"].map((name) => ({
          name,
        }));

  it("creates only the tables the base is missing", async () => {
    const { client, calls } = harness((call) => {
      if (call.method === "GET")
        return {
          body: {
            tables: [
              { id: "tblE", name: "Events", fields: fullFields("Events") },
              { id: "tblS", name: "Speakers", fields: fullFields("Speakers") },
            ],
          },
        };
      return { body: { id: "tblNEW" } };
    });

    const result = await client.ensureSchema(["Events", "Speakers", "Submissions"]);
    expect(result.createdTables).toEqual(["Submissions"]);
    expect(result.createdFields).toEqual({});
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect((posts[0]!.body as { name: string }).name).toBe("Submissions");
  });

  it("adopts a template-created table by adding only its missing columns", async () => {
    // The real trigger: an Airtable event template ships a Speakers table with
    // its own shape. The mirror must add its join key and missing columns
    // without touching the template's fields.
    const { client, calls } = harness((call) => {
      if (call.method === "GET")
        return {
          body: {
            tables: [
              {
                id: "tblTemplate",
                name: "Speakers",
                fields: [
                  { name: "Name" },
                  { name: "Bio" },
                  { name: "Email" },
                  { name: "Phone" },
                  { name: "Profile Photo" },
                ],
              },
            ],
          },
        };
      return { body: { id: "made" } };
    });

    const result = await client.ensureSchema(["Speakers"]);
    expect(result.createdTables).toEqual([]);
    expect(result.createdFields).toEqual({
      Speakers: ["SpeakerOps ID", "Company", "Title", "Location"],
    });
    const fieldPosts = calls.filter((c) => c.method === "POST" && c.url.includes("/tables/tblTemplate/fields"));
    expect(fieldPosts.map((c) => (c.body as { name: string }).name)).toEqual([
      "SpeakerOps ID",
      "Company",
      "Title",
      "Location",
    ]);
  });

  it("creates nothing when the base is already complete", async () => {
    const { client, calls } = harness(() => ({
      body: { tables: [{ id: "tblE", name: "Events", fields: fullFields("Events") }] },
    }));
    const result = await client.ensureSchema(["Events"]);
    expect(result).toEqual({ createdTables: [], createdFields: {} });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("gives number fields the precision Airtable requires", async () => {
    const { client, calls } = harness((call) =>
      call.method === "GET" ? { body: { tables: [] } } : { body: { id: "tbl" } },
    );
    await client.ensureSchema(["Rooms"]);
    const body = calls.find((c) => c.method === "POST")!.body as {
      fields: { name: string; type: string; options?: { precision: number } }[];
    };
    const capacity = body.fields.find((f) => f.name === "Capacity")!;
    expect(capacity).toMatchObject({ type: "number", options: { precision: 0 } });
  });
});

describe("verify", () => {
  it("reports reachability without throwing when credentials are bad", async () => {
    const { client } = harness(() => ({ status: 403, body: { error: "forbidden" } }));
    const probe = await client.verify();
    expect(probe.ok).toBe(false);
    expect(probe.error).toContain("403");
  });

  it("never returns the token in its result", async () => {
    const { client } = harness(() => ({ status: 401, body: { error: "nope" } }));
    const probe = await client.verify();
    expect(JSON.stringify(probe)).not.toContain("pat_fake_token");
  });
});
