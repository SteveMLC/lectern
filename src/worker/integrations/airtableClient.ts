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
    this.fetcher = cfg.fetcher ?? globalThis.fetch.bind(globalThis);
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

  async listTables(): Promise<{ id: string; name: string; fields: string[] }[]> {
    const body = (await this.request(
      `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(this.cfg.baseId)}/tables`,
      { method: "GET" },
    )) as { tables?: { id: string; name: string; fields?: { name: string }[] }[] };
    return (body.tables ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      fields: (t.fields ?? []).map((f) => f.name),
    }));
  }

  async listTableNames(): Promise<string[]> {
    return (await this.listTables()).map((t) => t.name);
  }

  private fieldPayload(field: { name: string; type: string }): Record<string, unknown> {
    return field.type === "number"
      ? { name: field.name, type: "number", options: { precision: 0 } }
      : { name: field.name, type: field.type };
  }

  async createField(tableId: string, field: { name: string; type: string }): Promise<void> {
    await this.request(
      `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(this.cfg.baseId)}/tables/${encodeURIComponent(tableId)}/fields`,
      { method: "POST", body: JSON.stringify(this.fieldPayload(field)) },
    );
  }

  async createTable(table: MirrorTable): Promise<void> {
    const fields = TABLE_SCHEMA[table].map((f) => this.fieldPayload(f));
    await this.request(
      `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(this.cfg.baseId)}/tables`,
      { method: "POST", body: JSON.stringify({ name: table, fields }) },
    );
  }

  /**
   * Make the base fit the mirror without owning it: create any mirror table
   * that is missing, and on tables that already exist — including ones a
   * template created with its own shape — add only the mirror's missing
   * columns. Existing tables, fields, and data are never touched, so the
   * mirror adopts a lived-in base instead of demanding an empty one.
   */
  async ensureSchema(tables: readonly MirrorTable[]): Promise<{
    createdTables: MirrorTable[];
    createdFields: Record<string, string[]>;
  }> {
    const existing = new Map((await this.listTables()).map((t) => [t.name, t]));
    const createdTables: MirrorTable[] = [];
    const createdFields: Record<string, string[]> = {};

    for (const table of tables) {
      const current = existing.get(table);
      if (!current) {
        await this.createTable(table);
        createdTables.push(table);
        continue;
      }
      const present = new Set(current.fields);
      for (const field of TABLE_SCHEMA[table]) {
        if (present.has(field.name)) continue;
        await this.createField(current.id, field);
        (createdFields[table] ??= []).push(field.name);
      }
    }
    return { createdTables, createdFields };
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
