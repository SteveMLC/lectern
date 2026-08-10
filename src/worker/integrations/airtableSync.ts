import {
  MIRROR_TABLES,
  batch,
  estimateRequests,
  mapAgendaRow,
  mapEventRow,
  mapRoomRow,
  mapSessionRow,
  mapSpeakerRow,
  mapSubmissionRow,
  mapTaskRow,
  mapTrackRow,
  mergePlans,
  planTable,
  type MirrorRow,
  type MirrorSourceRow,
  type MirrorTable,
} from "../../shared/domain/airtableMirror";
import { randomId } from "../../shared/ids";
import { AirtableClient, AirtableError } from "./airtableClient";

/**
 * Mirrors an event's operational records from D1 into Airtable.
 *
 * D1 remains authoritative. This pushes a readable copy into the organizer's
 * base so the people who live in Airtable see submissions, decisions, the
 * schedule, and outstanding speaker tasks without opening the app.
 *
 * Idempotent by construction: `external_id_map` remembers which Airtable
 * record each internal row became, so re-running updates in place. Pressing
 * Sync ten times leaves the same rows, not ten copies.
 */

export interface SyncResult {
  ok: boolean;
  runId: string;
  tablesCreated: MirrorTable[];
  created: number;
  updated: number;
  orphans: number;
  /** App-owned orphan rows removed only when explicitly requested. */
  orphansRemoved: number;
  /** Mappings repaired by matching SpeakerOps ID against live records. */
  relinked: number;
  /** Rows in the base that carry no SpeakerOps ID; never touched. */
  foreignRows: number;
  /** Whether this run could read live keys and self-heal stale D1 mappings. */
  reconciliationReadAvailable: boolean;
  /** Extra app-owned rows carrying a duplicate SpeakerOps ID found this run. */
  duplicatesFound: number;
  /** Duplicate rows removed only when the caller explicitly requested deduplication. */
  duplicatesRemoved: number;
  airtableRequests: number;
  report: string[];
  error?: string;
}

/** The queries that shape each mirror table, with joins resolved for humans. */
const SOURCE_QUERIES: Record<MirrorTable, { sql: string; map: (r: MirrorSourceRow) => MirrorRow }> = {
  Events: {
    sql: "SELECT id, name, slug, tagline, starts_on, ends_on, timezone, venue FROM events WHERE id = ?1",
    map: mapEventRow,
  },
  Tracks: {
    sql: "SELECT id, name, description, event_id FROM tracks WHERE event_id = ?1 ORDER BY sort_order",
    map: mapTrackRow,
  },
  Rooms: {
    sql: "SELECT id, name, capacity, event_id FROM rooms WHERE event_id = ?1 ORDER BY sort_order",
    map: mapRoomRow,
  },
  Speakers: {
    sql: "SELECT id, name, email, company, title, bio, location FROM speakers WHERE event_id = ?1 ORDER BY name",
    map: mapSpeakerRow,
  },
  Submissions: {
    sql: `SELECT s.id, s.title, s.abstract, s.status, s.format, s.submitted_at,
                 t.name AS track_name,
                 (SELECT group_concat(sp.name, ', ')
                    FROM submission_speakers ss JOIN speakers sp ON sp.id = ss.speaker_id
                   WHERE ss.submission_id = s.id) AS speaker_names
            FROM submissions s
            LEFT JOIN tracks t ON t.id = s.track_id
           WHERE s.event_id = ?1
           ORDER BY s.submitted_at IS NULL, s.submitted_at DESC, s.id`,
    map: mapSubmissionRow,
  },
  Sessions: {
    sql: `SELECT s.id, s.title, s.format, s.status, s.origin, s.source_submission_id,
                 t.name AS track_name,
                 (SELECT group_concat(sp.name, ', ')
                    FROM session_speakers ss JOIN speakers sp ON sp.id = ss.speaker_id
                   WHERE ss.session_id = s.id) AS speaker_names
            FROM sessions s
            LEFT JOIN tracks t ON t.id = s.track_id
           WHERE s.event_id = ?1
           ORDER BY s.id`,
    map: mapSessionRow,
  },
  Agenda: {
    sql: `SELECT a.id, a.starts_at, a.ends_at,
                 ses.title AS session_title, r.name AS room_name
            FROM agenda_slots a
            JOIN sessions ses ON ses.id = a.session_id
            LEFT JOIN rooms r ON r.id = a.room_id
           WHERE a.event_id = ?1
           ORDER BY a.starts_at`,
    map: mapAgendaRow,
  },
  Tasks: {
    sql: `SELECT st.id, st.status, st.completed_at,
                 sp.name AS speaker_name, td.label AS task_label
            FROM speaker_tasks st
            JOIN speakers sp ON sp.id = st.speaker_id
            JOIN task_definitions td ON td.id = st.task_definition_id
           WHERE st.event_id = ?1
           ORDER BY sp.name, td.sort_order`,
    map: mapTaskRow,
  },
};

/** The integration_connections row for this event's Airtable link. */
async function ensureConnection(db: D1Database, eventId: string, now: string): Promise<string> {
  const existing = await db
    .prepare("SELECT id FROM integration_connections WHERE event_id = ?1 AND system = 'airtable'")
    .bind(eventId)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const id = randomId("conn");
  await db
    .prepare(
      `INSERT INTO integration_connections (id, event_id, system, status, config_json, updated_at)
       VALUES (?1, ?2, 'airtable', 'configured', '{}', ?3)`,
    )
    .bind(id, eventId, now)
    .run();
  return id;
}

async function loadExternalIds(
  db: D1Database,
  connectionId: string,
): Promise<Map<MirrorTable, Map<string, string>>> {
  const { results } = await db
    .prepare(
      "SELECT entity_type, internal_id, external_id FROM external_id_map WHERE connection_id = ?1",
    )
    .bind(connectionId)
    .all<{ entity_type: string; internal_id: string; external_id: string }>();

  const byTable = new Map<MirrorTable, Map<string, string>>();
  for (const table of MIRROR_TABLES) byTable.set(table, new Map());
  for (const row of results) {
    const table = byTable.get(row.entity_type as MirrorTable);
    if (table) table.set(row.internal_id, row.external_id);
  }
  return byTable;
}

export async function syncEventToAirtable(options: {
  db: D1Database;
  client: AirtableClient;
  eventId: string;
  now: string;
  deduplicate?: boolean;
  pruneOrphans?: boolean;
}): Promise<SyncResult> {
  const { db, client, eventId, now, deduplicate = false, pruneOrphans = false } = options;
  const report: string[] = [];
  const runId = randomId("sync");
  const connectionId = await ensureConnection(db, eventId, now);

  await db
    .prepare(
      `INSERT INTO sync_runs (id, connection_id, started_at, finished_at, direction, status, stats_json, log_json)
       VALUES (?1, ?2, ?3, NULL, 'push', 'running', NULL, NULL)`,
    )
    .bind(runId, connectionId, now)
    .run();

  const finish = async (result: Omit<SyncResult, "runId">): Promise<SyncResult> => {
    await db
      .prepare(
        `UPDATE sync_runs SET finished_at = ?2, status = ?3, stats_json = ?4, log_json = ?5 WHERE id = ?1`,
      )
      .bind(
        runId,
        new Date().toISOString(),
        result.ok ? "success" : "failure",
        JSON.stringify({
          created: result.created,
          updated: result.updated,
          orphans: result.orphans,
          orphansRemoved: result.orphansRemoved,
          relinked: result.relinked,
          foreignRows: result.foreignRows,
          reconciliationReadAvailable: result.reconciliationReadAvailable,
          duplicatesFound: result.duplicatesFound,
          duplicatesRemoved: result.duplicatesRemoved,
          airtableRequests: result.airtableRequests,
        }),
        JSON.stringify(result.report),
      )
      .run();
    await db
      .prepare("UPDATE integration_connections SET status = ?2, updated_at = ?3 WHERE id = ?1")
      .bind(connectionId, result.ok ? "configured" : "error", new Date().toISOString())
      .run();
    return { ...result, runId };
  };

  try {
    const schema = await client.ensureSchema(MIRROR_TABLES);
    const tablesCreated = schema.createdTables;
    if (tablesCreated.length > 0) {
      report.push(`Created ${tablesCreated.length} table(s) in the base: ${tablesCreated.join(", ")}`);
    }
    for (const [table, fields] of Object.entries(schema.createdFields)) {
      report.push(`Adopted existing "${table}" table: added ${fields.join(", ")}`);
    }

    const known = await loadExternalIds(db, connectionId);

    // Reconcile before planning: the base is the truth about which records
    // exist. Stored mappings can be stale in both directions — a database
    // reseed wipes them while the records live on, and someone clearing the
    // base deletes records our mappings still point to. Listing each table's
    // SpeakerOps IDs heals both: live records win, dead mappings are dropped,
    // and rows without our join key are counted but never touched.
    let relinked = 0;
    let foreignRows = 0;
    let readScopeMissing = false;
    const duplicateRecordIds = new Map<MirrorTable, string[]>();
    const orphanRecordIds = new Map<MirrorTable, string[]>();
    const relinkStatements: D1PreparedStatement[] = [];
    const plans = [];
    for (const table of MIRROR_TABLES) {
      const query = SOURCE_QUERIES[table];
      const { results } = await db
        .prepare(query.sql)
        .bind(eventId)
        .all<MirrorSourceRow>();
      const rows = results.map(query.map);

      const stored = known.get(table) ?? new Map<string, string>();

      // Reconciliation needs data.records:read. A token scoped write-only is a
      // legitimate configuration, so a 403 here downgrades to trusting the
      // stored mappings rather than failing the sync.
      let keys: { recordId: string; speakerOpsId: string | null }[] | null = null;
      if (!readScopeMissing) {
        try {
          keys = await client.listRecordKeys(table);
        } catch (error) {
          if (error instanceof AirtableError && error.status === 403) {
            readScopeMissing = true;
          } else {
            throw error;
          }
        }
      }
      if (keys === null) {
        plans.push(planTable(table, rows, stored));
        continue;
      }

      const live = new Map<string, string[]>();
      for (const key of keys) {
        if (key.speakerOpsId === null) {
          foreignRows += 1;
        } else {
          const recordIds = live.get(key.speakerOpsId) ?? [];
          recordIds.push(key.recordId);
          live.set(key.speakerOpsId, recordIds);
        }
      }
      const sourceIds = new Set(rows.map((row) => row.internalId));
      for (const [speakerOpsId, recordIds] of live) {
        if (!sourceIds.has(speakerOpsId)) orphanRecordIds.set(table, recordIds);
      }

      const effective = new Map<string, string>();
      for (const row of rows) {
        const liveIds = live.get(row.internalId) ?? [];
        const storedId = stored.get(row.internalId);
        const liveId = storedId && liveIds.includes(storedId) ? storedId : liveIds[0];
        if (liveId) {
          effective.set(row.internalId, liveId);
          const duplicates = liveIds.filter((recordId) => recordId !== liveId);
          if (duplicates.length > 0) {
            duplicateRecordIds.set(table, [...(duplicateRecordIds.get(table) ?? []), ...duplicates]);
          }
          if (storedId !== liveId) {
            relinked += 1;
            relinkStatements.push(
              db
                .prepare(
                  `INSERT INTO external_id_map (id, connection_id, entity_type, internal_id, external_id, last_synced_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                   ON CONFLICT(connection_id, entity_type, internal_id)
                   DO UPDATE SET external_id = excluded.external_id, last_synced_at = excluded.last_synced_at`,
                )
                .bind(randomId("ext"), connectionId, table, row.internalId, liveId, now),
            );
          }
        }
        // No live record: fall through to create, even if a stale mapping
        // exists — its target is gone and the create will remap it.
      }
      plans.push(planTable(table, rows, effective));
    }
    if (relinkStatements.length > 0) await db.batch(relinkStatements);
    const plan = mergePlans(plans);

    report.push(
      `Plan: ${plan.creates.length} new, ${plan.updates.length} existing, ` +
        `~${estimateRequests(plan)} Airtable requests`,
    );

    // Writes, batched to Airtable's 10-record limit, table by table.
    let created = 0;
    let updated = 0;
    let duplicatesRemoved = 0;
    let orphansRemoved = 0;

    for (const table of MIRROR_TABLES) {
      const creates = plan.creates.filter((c) => c.table === table);
      for (const chunk of batch(creates)) {
        const mapping = await client.createRecords(table, chunk);
        const stmts = [...mapping.entries()].map(([internalId, externalId]) =>
          db
            .prepare(
              `INSERT INTO external_id_map (id, connection_id, entity_type, internal_id, external_id, last_synced_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)
               ON CONFLICT(connection_id, entity_type, internal_id)
               DO UPDATE SET external_id = excluded.external_id, last_synced_at = excluded.last_synced_at`,
            )
            .bind(randomId("ext"), connectionId, table, internalId, externalId, now),
        );
        if (stmts.length > 0) await db.batch(stmts);
        created += mapping.size;
      }

      const updates = plan.updates.filter((u) => u.table === table);
      for (const chunk of batch(updates)) {
        await client.updateRecords(table, chunk);
        updated += chunk.length;
      }

      const touched = creates.length + updates.length;
      if (touched > 0) report.push(`${table}: ${creates.length} created, ${updates.length} updated`);
    }

    const duplicatesFound = [...duplicateRecordIds.values()].reduce((sum, ids) => sum + ids.length, 0);
    const liveOrphansFound = [...orphanRecordIds.values()].reduce((sum, ids) => sum + ids.length, 0);
    const orphansFound = readScopeMissing ? plan.orphans.length : liveOrphansFound;
    if (duplicatesFound > 0 && deduplicate) {
      for (const table of MIRROR_TABLES) {
        for (const chunk of batch(duplicateRecordIds.get(table) ?? [])) {
          await client.deleteRecords(table, chunk);
          duplicatesRemoved += chunk.length;
        }
      }
      report.push(`Removed ${duplicatesRemoved} duplicate app-owned row(s) by SpeakerOps ID.`);
    } else if (duplicatesFound > 0) {
      report.push(
        `Found ${duplicatesFound} duplicate app-owned row(s); rerun with dedupe=1 to remove only the extras.`,
      );
    }

    if (liveOrphansFound > 0 && pruneOrphans) {
      for (const table of MIRROR_TABLES) {
        for (const chunk of batch(orphanRecordIds.get(table) ?? [])) {
          await client.deleteRecords(table, chunk);
          orphansRemoved += chunk.length;
        }
      }
      report.push(`Removed ${orphansRemoved} app-owned orphan row(s) absent from the reset source.`);
    } else if (orphansFound > 0) {
      report.push(
        `Found ${orphansFound} app-owned orphan row(s); rerun with prune=1 to remove them explicitly.`,
      );
    }

    if (readScopeMissing) {
      report.push(
        "Reconciliation skipped: token lacks data.records:read; trusting stored mappings. " +
          "Add that scope to make sync self-healing after resets.",
      );
    }
    if (relinked > 0) {
      report.push(`Reconciled ${relinked} mapping(s) against live records by SpeakerOps ID.`);
    }
    if (foreignRows > 0) {
      report.push(
        `${foreignRows} row(s) in the base carry no SpeakerOps ID (template or hand-added); left untouched.`,
      );
    }
    report.push(`Done in ${client.requestCount} Airtable request(s).`);

    return await finish({
      ok: true,
      tablesCreated,
      created,
      updated,
      orphans: orphansFound,
      orphansRemoved,
      relinked,
      foreignRows,
      reconciliationReadAvailable: !readScopeMissing,
      duplicatesFound,
      duplicatesRemoved,
      airtableRequests: client.requestCount,
      report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.push(`Sync failed: ${message}`);
    return await finish({
      ok: false,
      tablesCreated: [],
      created: 0,
      updated: 0,
      orphans: 0,
      orphansRemoved: 0,
      relinked: 0,
      foreignRows: 0,
      reconciliationReadAvailable: false,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      airtableRequests: client.requestCount,
      report,
      error: message,
    });
  }
}
