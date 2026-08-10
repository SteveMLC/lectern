/**
 * Airtable mirror planning — pure, no I/O.
 *
 * D1 stays the authoritative operational store. This layer decides what to
 * push into Airtable so the organizer's base reflects real operational
 * records: who submitted, what got accepted, who still owes a headshot.
 *
 * Why mirror rather than use Airtable as the backend:
 * - Airtable allows 5 requests/second/base. Serving page loads from it would
 *   put a rate limit in the demo path. Mirroring keeps it off the read path.
 * - Airtable has no transactions or joins. The submission/session invariants
 *   are enforced by the D1 schema and would be unenforceable there.
 * - If Airtable is slow or down, the app keeps working and the sync reports
 *   a failure. The reverse would take the whole product down.
 *
 * Idempotency: every internal row maps to an Airtable record id in
 * `external_id_map`. Known rows are PATCHed, unknown rows are POSTed and the
 * returned id is recorded. Re-running a sync updates in place — it never
 * duplicates, however many times a judge presses the button.
 */

export const MIRROR_TABLES = [
  "Events",
  "Tracks",
  "Rooms",
  "Speakers",
  "Submissions",
  "Sessions",
  "Agenda",
  "Tasks",
] as const;

export type MirrorTable = (typeof MIRROR_TABLES)[number];

/** Airtable caps batch writes at 10 records per request. */
export const AIRTABLE_BATCH_LIMIT = 10;

export interface MirrorRow {
  /** Our internal id — the join key into external_id_map. */
  internalId: string;
  fields: Record<string, unknown>;
}

export interface MirrorCreate {
  table: MirrorTable;
  internalId: string;
  fields: Record<string, unknown>;
}

export interface MirrorUpdate {
  table: MirrorTable;
  internalId: string;
  recordId: string;
  fields: Record<string, unknown>;
}

export interface MirrorPlan {
  creates: MirrorCreate[];
  updates: MirrorUpdate[];
  /** Rows in Airtable we previously created whose source row is now gone. */
  orphans: { table: MirrorTable; internalId: string; recordId: string }[];
}

/**
 * Decide creates vs updates for one table.
 *
 * `known` maps internalId -> Airtable record id, loaded from external_id_map.
 */
export function planTable(
  table: MirrorTable,
  rows: readonly MirrorRow[],
  known: ReadonlyMap<string, string>,
): MirrorPlan {
  const creates: MirrorCreate[] = [];
  const updates: MirrorUpdate[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    seen.add(row.internalId);
    const recordId = known.get(row.internalId);
    if (recordId === undefined) {
      creates.push({ table, internalId: row.internalId, fields: row.fields });
    } else {
      updates.push({ table, internalId: row.internalId, recordId, fields: row.fields });
    }
  }

  const orphans = [...known.entries()]
    .filter(([internalId]) => !seen.has(internalId))
    .map(([internalId, recordId]) => ({ table, internalId, recordId }));

  return { creates, updates, orphans };
}

export function mergePlans(plans: readonly MirrorPlan[]): MirrorPlan {
  return {
    creates: plans.flatMap((p) => p.creates),
    updates: plans.flatMap((p) => p.updates),
    orphans: plans.flatMap((p) => p.orphans),
  };
}

/** Split into Airtable-legal batches, preserving order. */
export function batch<T>(items: readonly T[], size: number = AIRTABLE_BATCH_LIMIT): T[][] {
  if (size < 1) throw new RangeError("Batch size must be at least 1.");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * How many Airtable requests a plan costs. Used to warn before a sync that
 * would take an uncomfortably long time behind the rate limiter.
 */
export function estimateRequests(plan: MirrorPlan): number {
  const perTable = new Map<MirrorTable, { creates: number; updates: number }>();
  for (const c of plan.creates) {
    const entry = perTable.get(c.table) ?? { creates: 0, updates: 0 };
    entry.creates += 1;
    perTable.set(c.table, entry);
  }
  for (const u of plan.updates) {
    const entry = perTable.get(u.table) ?? { creates: 0, updates: 0 };
    entry.updates += 1;
    perTable.set(u.table, entry);
  }
  let total = 0;
  for (const { creates, updates } of perTable.values()) {
    total += Math.ceil(creates / AIRTABLE_BATCH_LIMIT) + Math.ceil(updates / AIRTABLE_BATCH_LIMIT);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Field mapping — what an organizer actually sees in the base
// ---------------------------------------------------------------------------

/**
 * "SpeakerOps ID" is the stable join key in every table. Field names are
 * written for a human reading the base, not for the code.
 */
export const SPEAKEROPS_ID_FIELD = "SpeakerOps ID";

export interface MirrorSourceRow {
  [column: string]: string | number | null;
}

const isoOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const textOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export function mapEventRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Name: textOrNull(r.name),
      Slug: textOrNull(r.slug),
      Tagline: textOrNull(r.tagline),
      "Starts On": isoOrNull(r.starts_on),
      "Ends On": isoOrNull(r.ends_on),
      Timezone: textOrNull(r.timezone),
      Venue: textOrNull(r.venue),
    },
  };
}

export function mapTrackRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Name: textOrNull(r.name),
      Description: textOrNull(r.description),
      Event: textOrNull(r.event_id),
    },
  };
}

export function mapRoomRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Name: textOrNull(r.name),
      Capacity: typeof r.capacity === "number" ? r.capacity : null,
      Event: textOrNull(r.event_id),
    },
  };
}

export function mapSpeakerRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Name: textOrNull(r.name),
      Email: textOrNull(r.email),
      Company: textOrNull(r.company),
      Title: textOrNull(r.title),
      Bio: textOrNull(r.bio),
      Location: textOrNull(r.location),
    },
  };
}

export function mapSubmissionRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Title: textOrNull(r.title),
      Abstract: textOrNull(r.abstract),
      Status: textOrNull(r.status),
      Format: textOrNull(r.format),
      Track: textOrNull(r.track_name),
      Speakers: textOrNull(r.speaker_names),
      "Submitted At": isoOrNull(r.submitted_at),
    },
  };
}

export function mapSessionRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Title: textOrNull(r.title),
      Format: textOrNull(r.format),
      Status: textOrNull(r.status),
      Origin: textOrNull(r.origin),
      "From Submission": textOrNull(r.source_submission_id),
      Track: textOrNull(r.track_name),
      Speakers: textOrNull(r.speaker_names),
    },
  };
}

export function mapAgendaRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Session: textOrNull(r.session_title),
      Room: textOrNull(r.room_name),
      "Starts At": isoOrNull(r.starts_at),
      "Ends At": isoOrNull(r.ends_at),
    },
  };
}

export function mapTaskRow(r: MirrorSourceRow): MirrorRow {
  return {
    internalId: String(r.id),
    fields: {
      [SPEAKEROPS_ID_FIELD]: String(r.id),
      Speaker: textOrNull(r.speaker_name),
      Task: textOrNull(r.task_label),
      Status: textOrNull(r.status),
      "Completed At": isoOrNull(r.completed_at),
    },
  };
}

/** Column types for auto-creating the base schema via the Meta API. */
export const TABLE_SCHEMA: Record<MirrorTable, { name: string; type: string }[]> = {
  Events: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Name", type: "singleLineText" },
    { name: "Slug", type: "singleLineText" },
    { name: "Tagline", type: "singleLineText" },
    { name: "Starts On", type: "singleLineText" },
    { name: "Ends On", type: "singleLineText" },
    { name: "Timezone", type: "singleLineText" },
    { name: "Venue", type: "singleLineText" },
  ],
  Tracks: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Name", type: "singleLineText" },
    { name: "Description", type: "multilineText" },
    { name: "Event", type: "singleLineText" },
  ],
  Rooms: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Name", type: "singleLineText" },
    { name: "Capacity", type: "number" },
    { name: "Event", type: "singleLineText" },
  ],
  Speakers: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Name", type: "singleLineText" },
    { name: "Email", type: "email" },
    { name: "Company", type: "singleLineText" },
    { name: "Title", type: "singleLineText" },
    { name: "Bio", type: "multilineText" },
    { name: "Location", type: "singleLineText" },
  ],
  Submissions: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Title", type: "singleLineText" },
    { name: "Abstract", type: "multilineText" },
    { name: "Status", type: "singleLineText" },
    { name: "Format", type: "singleLineText" },
    { name: "Track", type: "singleLineText" },
    { name: "Speakers", type: "singleLineText" },
    { name: "Submitted At", type: "singleLineText" },
  ],
  Sessions: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Title", type: "singleLineText" },
    { name: "Format", type: "singleLineText" },
    { name: "Status", type: "singleLineText" },
    { name: "Origin", type: "singleLineText" },
    { name: "From Submission", type: "singleLineText" },
    { name: "Track", type: "singleLineText" },
    { name: "Speakers", type: "singleLineText" },
  ],
  Agenda: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Session", type: "singleLineText" },
    { name: "Room", type: "singleLineText" },
    { name: "Starts At", type: "singleLineText" },
    { name: "Ends At", type: "singleLineText" },
  ],
  Tasks: [
    { name: SPEAKEROPS_ID_FIELD, type: "singleLineText" },
    { name: "Speaker", type: "singleLineText" },
    { name: "Task", type: "singleLineText" },
    { name: "Status", type: "singleLineText" },
    { name: "Completed At", type: "singleLineText" },
  ],
};
