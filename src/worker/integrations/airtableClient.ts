import {
  TABLE_SCHEMA,
  type MirrorCreate,
  type MirrorTable,
  type MirrorUpdate,
} from "../../shared/domain/airtableMirror";

/**
 * Rate-safe Airtable HTTP client.
 *
 * Airtable allows 5 requests/second/base and 10 records per write request.
 * Every call goes through one serialised queue with 210ms spacing (~4.7/s),
 * so no amount of concurrent syncing can breach the limit from one isolate.
 * 429s are retried with the server's Retry-After.
 */

const MIN_REQUEST_SPACING_MS = 210;
const MAX_RETRIES = 3;

export interface AirtableClientConfig {
  token: string;
  baseId: string;
  /** Test seams. Production uses the Worker globals. */
  fetcher?: typeof fetch;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export class AirtableError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Airtable request failed (${status}): ${detail}`);
    this.name = "AirtableError";
  }
}

export class AirtableClient {
  private readonly fetcher: typeof fetch;
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  /** Requests actually issued — surfaced in the sync report. */
  requestCount = 0;

  constructor(private readonly cfg: AirtableClientConfig) {
    this.fetcher = cfg.fetcher ?? fetch;
    this.clock = cfg.clock ?? Date.now;
    this.sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Serialises every request and spaces them under the rate limit. */
  private schedule<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.queue.then(async () => {
      const waitMs = Math.max(0, this.lastStartedAt + MIN_REQUEST_SPACING_MS - this.clock());
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastStartedAt = this.clock();
      this.requestCount += 1;
      return operation();
    });
    this.queue = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }

  private async request(url: string, init: RequestInit, attempt = 0): Promise<unknown> {
    const response = await this.schedule(() =>
      this.fetcher(url, {
        ...init,
        headers: {
          authorization: `Bearer ${this.cfg.token}`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      }),
    );

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await this.sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
      return this.request(url, init, attempt + 1);
    }
    if (!response.ok) {
      throw new AirtableError(response.status, (await response.text()).slice(0, 500));
    }
    return response.json();
  }

  private dataUrl(table: string): string {
    return `https://api.airtable.com/v0/${encodeURIComponent(this.cfg.baseId)}/${encodeURIComponent(table)}`;
  }

  // -------------------------------------------------------------------------
  // Schema (Meta API) — lets the mirror create its own base layout
  // -------------------------------------------------------------------------

  async listTableNames(): Promise<string[]> {
    const body = (await this.request(
      `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(this.cfg.baseId)}/tables`,
      { method: "GET" },
    )) as { tables?: { name: string }[] };
    return (body.tables ?? []).map((t) => t.name);
  }

  async createTable(table: MirrorTable): Promise<void> {
    const fields = TABLE_SCHEMA[table].map((f) =>
      f.type === "number"
        ? { name: f.name, type: "number", options: { precision: 0 } }
        : { name: f.name, type: f.type },
    );
    await this.request(
      `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(this.cfg.baseId)}/tables`,
      { method: "POST", body: JSON.stringify({ name: table, fields }) },
    );
  }

  /**
   * Create any mirror table the base is missing. Returns the tables created,
   * so a first run can report "I built your base" rather than staying silent.
   */
  async ensureTables(tables: readonly MirrorTable[]): Promise<MirrorTable[]> {
    const existing = new Set(await this.listTableNames());
    const created: MirrorTable[] = [];
    for (const table of tables) {
      if (existing.has(table)) continue;
      await this.createTable(table);
      created.push(table);
    }
    return created;
  }

  // -------------------------------------------------------------------------
  // Records
  // -------------------------------------------------------------------------

  /** One batch of at most 10 creates. Returns internalId -> Airtable record id. */
  async createRecords(table: MirrorTable, items: readonly MirrorCreate[]): Promise<Map<string, string>> {
    if (items.length === 0) return new Map();
    const body = (await this.request(this.dataUrl(table), {
      method: "POST",
      body: JSON.stringify({
        records: items.map((i) => ({ fields: i.fields })),
        typecast: true,
      }),
    })) as { records?: AirtableRecord[] };

    const created = body.records ?? [];
    const mapping = new Map<string, string>();
    created.forEach((record, index) => {
      const source = items[index];
      if (source) mapping.set(source.internalId, record.id);
    });
    return mapping;
  }

  /** One batch of at most 10 updates. */
  async updateRecords(table: MirrorTable, items: readonly MirrorUpdate[]): Promise<void> {
    if (items.length === 0) return;
    await this.request(this.dataUrl(table), {
      method: "PATCH",
      body: JSON.stringify({
        records: items.map((i) => ({ id: i.recordId, fields: i.fields })),
        typecast: true,
      }),
    });
  }

  /** Cheap connectivity probe that does not depend on any table existing. */
  async verify(): Promise<{ ok: boolean; tables: string[]; error?: string }> {
    try {
      return { ok: true, tables: await this.listTableNames() };
    } catch (err) {
      return {
        ok: false,
        tables: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
