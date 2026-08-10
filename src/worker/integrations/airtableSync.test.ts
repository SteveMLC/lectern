import { describe, expect, it } from "vitest";
import { AirtableClient } from "./airtableClient";
import { syncEventToAirtable } from "./airtableSync";

/**
 * End-to-end sync orchestration against a fake D1 and a fake Airtable.
 *
 * The claim this exists to prove is idempotency: pressing Sync repeatedly must
 * update records in place, never duplicate them. That is the behaviour most
 * likely to be wrong and the most embarrassing to discover during judging,
 * and it cannot be checked by typechecking alone.
 */

interface Row {
  [column: string]: string | number | null;
}

/** Minimal D1 stand-in covering exactly the surface airtableSync uses. */
function fakeDb(seed: {
  events: Row[];
  tracks?: Row[];
  rooms?: Row[];
  speakers?: Row[];
  submissions?: Row[];
  sessions?: Row[];
  agenda?: Row[];
  tasks?: Row[];
}) {
  const externalIds: Row[] = [];
  const connections: Row[] = [];
  const syncRuns: Row[] = [];

  const pick = (sql: string): Row[] => {
    if (sql.includes("FROM events")) return seed.events;
    if (sql.includes("FROM tracks")) return seed.tracks ?? [];
    if (sql.includes("FROM rooms")) return seed.rooms ?? [];
    if (sql.includes("FROM speakers")) return seed.speakers ?? [];
    if (sql.includes("FROM submissions")) return seed.submissions ?? [];
    if (sql.includes("FROM sessions")) return seed.sessions ?? [];
    if (sql.includes("FROM agenda_slots")) return seed.agenda ?? [];
    if (sql.includes("FROM speaker_tasks")) return seed.tasks ?? [];
    return [];
  };

  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...bound: unknown[]) => statement(sql, bound),
    first: async () => {
      if (sql.includes("FROM integration_connections")) return connections[0] ?? null;
      const rows = pick(sql);
      return rows[0] ?? null;
    },
    all: async () => {
      if (sql.includes("FROM external_id_map")) return { results: externalIds };
      return { results: pick(sql) };
    },
    run: async () => {
      if (sql.startsWith("INSERT INTO integration_connections")) {
        connections.push({ id: String(args[0]) });
      } else if (sql.startsWith("INSERT INTO sync_runs")) {
        syncRuns.push({ id: String(args[0]), status: "running" });
      } else if (sql.startsWith("UPDATE sync_runs")) {
        const run = syncRuns.find((r) => r.id === args[0]);
        if (run) run.status = String(args[2]);
      } else if (sql.includes("INSERT INTO external_id_map")) {
        externalIds.push({
          entity_type: String(args[2]),
          internal_id: String(args[3]),
          external_id: String(args[4]),
        });
      }
      return { success: true };
    },
  });

  return {
    db: {
      prepare: (sql: string) => statement(sql),
      batch: async (stmts: { run: () => Promise<unknown> }[]) => {
        for (const s of stmts) await s.run();
        return [];
      },
    } as unknown as D1Database,
    externalIds,
    syncRuns,
  };
}

/** Fake Airtable that hands out sequential record ids and remembers writes. */
function fakeAirtable(existingTables: string[] = []) {
  const posts: { table: string; count: number }[] = [];
  const patches: { table: string; ids: string[] }[] = [];
  let counter = 0;
  let now = 0;

  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    if (u.includes("/meta/bases/") && method === "GET") {
      return new Response(JSON.stringify({ tables: existingTables.map((name) => ({ name })) }), {
        status: 200,
      });
    }
    if (u.includes("/meta/bases/") && method === "POST") {
      existingTables.push(body.name);
      return new Response(JSON.stringify({ id: "tbl" }), { status: 200 });
    }

    const table = decodeURIComponent(u.split("/").pop() ?? "");
    if (method === "POST") {
      const records = body.records.map(() => ({ id: `rec${counter++}`, fields: {} }));
      posts.push({ table, count: records.length });
      return new Response(JSON.stringify({ records }), { status: 200 });
    }
    if (method === "PATCH") {
      patches.push({ table, ids: body.records.map((r: { id: string }) => r.id) });
      return new Response(JSON.stringify({ records: [] }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;

  const client = new AirtableClient({
    token: "pat_fake",
    baseId: "appFAKE",
    fetcher,
    clock: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  });

  return { client, posts, patches };
}

const SEED = {
  events: [{ id: "evt_1", name: "Horizon", slug: "horizon", tagline: null, starts_on: "2026-10-14", ends_on: "2026-10-15", timezone: "UTC", venue: null }],
  speakers: [
    { id: "spk_a", name: "Ada", email: "ada@example.com", company: null, title: null, bio: null, location: null },
    { id: "spk_b", name: "Lin", email: "lin@example.com", company: null, title: null, bio: null, location: null },
  ],
  sessions: [
    { id: "ses_1", title: "Accepted Talk", format: "talk", status: "confirmed", origin: "accepted_submission", source_submission_id: "sub_1", track_name: null, speaker_names: "Ada" },
    { id: "ses_2", title: "Sponsor Keynote", format: "keynote", status: "confirmed", origin: "direct", source_submission_id: null, track_name: null, speaker_names: "Lin" },
  ],
};

describe("syncEventToAirtable", () => {
  it("creates the base tables it needs on a first run", async () => {
    const { db } = fakeDb(SEED);
    const { client } = fakeAirtable([]);
    const result = await syncEventToAirtable({ db, client, eventId: "evt_1", now: "2026-08-10T00:00:00Z" });

    expect(result.ok).toBe(true);
    expect(result.tablesCreated).toEqual([
      "Events",
      "Tracks",
      "Rooms",
      "Speakers",
      "Submissions",
      "Sessions",
      "Agenda",
      "Tasks",
    ]);
  });

  it("pushes records and records the Airtable id for every row", async () => {
    const { db, externalIds } = fakeDb(SEED);
    const { client } = fakeAirtable();
    const result = await syncEventToAirtable({ db, client, eventId: "evt_1", now: "2026-08-10T00:00:00Z" });

    // 1 event + 2 speakers + 2 sessions
    expect(result.created).toBe(5);
    expect(externalIds).toHaveLength(5);
    expect(externalIds.every((r) => String(r.external_id).startsWith("rec"))).toBe(true);
    expect(new Set(externalIds.map((r) => r.entity_type))).toEqual(
      new Set(["Events", "Speakers", "Sessions"]),
    );
  });

  it("is idempotent: a second sync updates in place and creates nothing", async () => {
    const { db, externalIds } = fakeDb(SEED);

    const first = await syncEventToAirtable({
      db,
      client: fakeAirtable().client,
      eventId: "evt_1",
      now: "2026-08-10T00:00:00Z",
    });
    expect(first.created).toBe(5);
    expect(first.updated).toBe(0);

    const secondAirtable = fakeAirtable(["Events", "Tracks", "Rooms", "Speakers", "Submissions", "Sessions", "Agenda", "Tasks"]);
    const second = await syncEventToAirtable({
      db,
      client: secondAirtable.client,
      eventId: "evt_1",
      now: "2026-08-10T00:05:00Z",
    });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(5);
    expect(secondAirtable.posts).toEqual([]);
    // Still five mappings, not ten.
    expect(externalIds).toHaveLength(5);
  });

  it("marks the run failed and reports the reason when Airtable rejects the token", async () => {
    const { db, syncRuns } = fakeDb(SEED);
    const fetcher = (async () =>
      new Response(JSON.stringify({ error: "invalid token" }), { status: 401 })) as unknown as typeof fetch;
    let now = 0;
    const client = new AirtableClient({
      token: "bad",
      baseId: "appFAKE",
      fetcher,
      clock: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });

    const result = await syncEventToAirtable({ db, client, eventId: "evt_1", now: "2026-08-10T00:00:00Z" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
    expect(syncRuns[0]?.status).toBe("failure");
    expect(result.report.some((line) => line.includes("Sync failed"))).toBe(true);
  });

  it("stays within Airtable's 10-record write limit on a large event", async () => {
    const many = Array.from({ length: 23 }, (_, i) => ({
      id: `spk_${i}`,
      name: `Speaker ${i}`,
      email: `s${i}@example.com`,
      company: null,
      title: null,
      bio: null,
      location: null,
    }));
    const { db } = fakeDb({ events: SEED.events, speakers: many });
    const { client, posts } = fakeAirtable();

    await syncEventToAirtable({ db, client, eventId: "evt_1", now: "2026-08-10T00:00:00Z" });

    const speakerPosts = posts.filter((p) => p.table === "Speakers");
    expect(speakerPosts.map((p) => p.count)).toEqual([10, 10, 3]);
    expect(speakerPosts.every((p) => p.count <= 10)).toBe(true);
  });
});
