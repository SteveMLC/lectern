import { Hono } from "hono";
import { MIRROR_TABLES } from "../../shared/domain/airtableMirror";
import type { Env } from "../env";
import { AirtableClient } from "../integrations/airtableClient";
import { syncEventToAirtable } from "../integrations/airtableSync";
import { organizerAuth } from "../lib/auth";
import { errorResponse } from "../lib/http";

/**
 * Airtable mirror endpoints.
 *
 * Kept in their own router and talking to D1 directly: this is an operations
 * concern, not application domain, and it must not compete with feature lanes
 * for the repository interface.
 *
 * Credentials come from Worker secrets only and are never returned to the
 * browser — status reports whether a token is configured, never its value.
 */
export const airtableApi = new Hono<{ Bindings: Env }>();

airtableApi.use("*", organizerAuth);

function clientFor(env: Env): AirtableClient | null {
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return null;
  return new AirtableClient({ token: env.AIRTABLE_TOKEN, baseId: env.AIRTABLE_BASE_ID });
}

/** Is Airtable configured, reachable, and what has been mirrored so far? */
airtableApi.get("/status", async (c) => {
  const configured = Boolean(c.env.AIRTABLE_TOKEN && c.env.AIRTABLE_BASE_ID);

  const lastRun = await c.env.DB.prepare(
    `SELECT r.id, r.started_at, r.finished_at, r.status, r.stats_json
       FROM sync_runs r
       JOIN integration_connections ic ON ic.id = r.connection_id
      WHERE ic.system = 'airtable'
      ORDER BY r.started_at DESC LIMIT 1`,
  ).first<{
    id: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    stats_json: string | null;
  }>();

  const mirrored = await c.env.DB.prepare(
    `SELECT entity_type, COUNT(*) AS c
       FROM external_id_map m
       JOIN integration_connections ic ON ic.id = m.connection_id
      WHERE ic.system = 'airtable'
      GROUP BY entity_type`,
  ).all<{ entity_type: string; c: number }>();

  if (!configured) {
    return c.json({
      configured: false,
      reachable: false,
      message:
        "Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID as Worker secrets to enable the mirror. " +
        "The token needs data.records:write and schema.bases:write so the mirror can build its own tables.",
      tables: MIRROR_TABLES,
      mirrored: {},
      lastRun: null,
    });
  }

  const client = clientFor(c.env)!;
  const probe = await client.verify();

  return c.json({
    configured: true,
    reachable: probe.ok,
    error: probe.error,
    baseTables: probe.tables,
    tables: MIRROR_TABLES,
    mirrored: Object.fromEntries((mirrored.results ?? []).map((r) => [r.entity_type, r.c])),
    lastRun: lastRun
      ? {
          id: lastRun.id,
          startedAt: lastRun.started_at,
          finishedAt: lastRun.finished_at,
          status: lastRun.status,
          stats: lastRun.stats_json ? JSON.parse(lastRun.stats_json) : null,
        }
      : null,
  });
});

/** Push an event's operational records into Airtable. Safe to run repeatedly. */
airtableApi.post("/events/:slug/sync", async (c) => {
  const client = clientFor(c.env);
  if (!client) {
    return errorResponse(
      503,
      "airtable_not_configured",
      "AIRTABLE_TOKEN and AIRTABLE_BASE_ID are not set on this deployment.",
    );
  }

  const event = await c.env.DB.prepare("SELECT id FROM events WHERE slug = ?1")
    .bind(c.req.param("slug"))
    .first<{ id: string }>();
  if (!event) return errorResponse(404, "event_not_found", "No event with that slug.");

  const result = await syncEventToAirtable({
    db: c.env.DB,
    client,
    eventId: event.id,
    now: new Date().toISOString(),
  });

  return c.json(result, result.ok ? 200 : 502);
});
