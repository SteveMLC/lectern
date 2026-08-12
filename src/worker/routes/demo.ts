import { Hono } from "hono";
import eventFile from "../../../demo-data/liam-conference.event.json";
import speakersFile from "../../../demo-data/liam-conference.speakers.json";
import submissionsFile from "../../../demo-data/liam-conference.submissions.json";
import {
  DemoEventFile,
  DemoSpeakersFile,
  DemoSubmissionsFile,
  type DemoDataset,
  type DemoDatasetSummary,
  type DemoLoadResponse,
  type DemoStatusResponse,
} from "../../shared/contracts/demoData";
import { buildDemoLoadPlan, type DemoLoadPlan } from "../../shared/domain/demoLoader";
import { findScheduleConflicts } from "../../shared/domain/schedule";
import type { Env } from "../env";
import { organizerAuth } from "../lib/auth";
import { errorResponse } from "../lib/http";

/**
 * Demo dataset loader — the bridge between hand-authored fixtures in
 * `demo-data/` and the running app. This is what makes a non-engineer's JSON
 * edit visible in the product in one click.
 *
 * Deliberately talks to D1 directly rather than through LecternRepo:
 * loading fixtures is the same class of operation as seeding, it is
 * inherently storage-shaped, and keeping it out of the repository interface
 * means feature lanes can evolve that interface without this tool colliding.
 *
 * Loads are idempotent. Every id is derived from the dataset's human keys, so
 * "load" deletes the dataset's event and re-inserts it — which is also exactly
 * what "reset" needs to do.
 */

export const demoApi = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Dataset registry
// ---------------------------------------------------------------------------

interface RegisteredDataset {
  key: string;
  label: string;
  credit: string;
  dataset: DemoDataset;
}

function parseDatasets(): { datasets: RegisteredDataset[]; errors: string[] } {
  const errors: string[] = [];
  const datasets: RegisteredDataset[] = [];

  const event = DemoEventFile.safeParse(eventFile);
  const speakers = DemoSpeakersFile.safeParse(speakersFile);
  const submissions = DemoSubmissionsFile.safeParse(submissionsFile);

  if (!event.success) errors.push(`event file: ${event.error.issues[0]?.message ?? "invalid"}`);
  if (!speakers.success)
    errors.push(`speakers file: ${speakers.error.issues[0]?.message ?? "invalid"}`);
  if (!submissions.success)
    errors.push(`submissions file: ${submissions.error.issues[0]?.message ?? "invalid"}`);

  if (event.success && speakers.success && submissions.success) {
    datasets.push({
      key: event.data.key,
      label: event.data.name,
      credit: "Demo data and QA: Liam",
      dataset: {
        event: event.data,
        speakers: speakers.data.speakers,
        submissions: submissions.data.submissions,
      },
    });
  }

  return { datasets, errors };
}

// ---------------------------------------------------------------------------
// D1 writes
// ---------------------------------------------------------------------------

/** Child-first delete. Explicit rather than relying on cascade behaviour. */
function deleteStatements(db: D1Database, eventId: string): D1PreparedStatement[] {
  const byEvent = (table: string) =>
    db.prepare(`DELETE FROM ${table} WHERE event_id = ?`).bind(eventId);

  return [
    db
      .prepare(
        "DELETE FROM session_speakers WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ?)",
      )
      .bind(eventId),
    db
      .prepare(
        "DELETE FROM submission_speakers WHERE submission_id IN (SELECT id FROM submissions WHERE event_id = ?)",
      )
      .bind(eventId),
    db
      .prepare(
        "DELETE FROM speaker_assets WHERE speaker_id IN (SELECT id FROM speakers WHERE event_id = ?)",
      )
      .bind(eventId),
    db
      .prepare(
        "DELETE FROM form_fields WHERE form_id IN (SELECT id FROM forms WHERE event_id = ?)",
      )
      .bind(eventId),
    db
      .prepare(
        "DELETE FROM conditional_rules WHERE form_id IN (SELECT id FROM forms WHERE event_id = ?)",
      )
      .bind(eventId),
    byEvent("speaker_tasks"),
    byEvent("task_definitions"),
    byEvent("agenda_slots"),
    byEvent("sessions"),
    byEvent("submissions"),
    byEvent("forms"),
    byEvent("speakers"),
    byEvent("rooms"),
    byEvent("tracks"),
    db.prepare("DELETE FROM events WHERE id = ?").bind(eventId),
  ];
}

/** Parent-first insert, matching foreign-key order. */
function insertStatements(db: D1Database, plan: DemoLoadPlan): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  const e = plan.event;

  out.push(
    db
      .prepare(
        `INSERT INTO events (id, slug, name, tagline, description, starts_on, ends_on, timezone, venue, website_url, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
      )
      .bind(
        e.id,
        e.slug,
        e.name,
        e.tagline,
        e.description,
        e.startsOn,
        e.endsOn,
        e.timezone,
        e.venue,
        e.websiteUrl,
        e.createdAt,
        e.updatedAt,
      ),
  );

  for (const t of plan.tracks) {
    out.push(
      db
        .prepare(
          "INSERT INTO tracks (id, event_id, name, description, color, sort_order) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(t.id, t.eventId, t.name, t.description, t.color, t.sortOrder),
    );
  }

  for (const r of plan.rooms) {
    out.push(
      db
        .prepare(
          "INSERT INTO rooms (id, event_id, name, capacity, sort_order) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(r.id, r.eventId, r.name, r.capacity, r.sortOrder),
    );
  }

  const f = plan.form;
  out.push(
    db
      .prepare(
        `INSERT INTO forms (id, event_id, kind, title, welcome_text, thank_you_text, is_open, opens_at, closes_at, max_speakers_per_submission, allow_drafts, created_at, updated_at)
         VALUES (?1,?2,'cfp',?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
      )
      .bind(
        f.id,
        f.eventId,
        f.title,
        f.welcomeText,
        f.thankYouText,
        f.isOpen ? 1 : 0,
        f.opensAt,
        f.closesAt,
        f.maxSpeakersPerSubmission,
        f.allowDrafts ? 1 : 0,
        f.createdAt,
        f.updatedAt,
      ),
  );

  for (const ff of plan.formFields) {
    out.push(
      db
        .prepare(
          `INSERT INTO form_fields (id, form_id, key, label, field_type, required, sort_order, help_text, options_json)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
        )
        .bind(
          ff.id,
          ff.formId,
          ff.key,
          ff.label,
          ff.fieldType,
          ff.required ? 1 : 0,
          ff.sortOrder,
          ff.helpText,
          ff.options ? JSON.stringify(ff.options) : null,
        ),
    );
  }

  for (const rule of plan.conditionalRules) {
    out.push(
      db
        .prepare(
          `INSERT INTO conditional_rules (id, form_id, source_field_key, operator, values_json, action, target_field_key)
           VALUES (?1,?2,?3,?4,?5,?6,?7)`,
        )
        .bind(
          rule.id,
          rule.formId,
          rule.sourceFieldKey,
          rule.operator,
          JSON.stringify(rule.values),
          rule.action,
          rule.targetFieldKey,
        ),
    );
  }

  for (const s of plan.speakers) {
    out.push(
      db
        .prepare(
          `INSERT INTO speakers (id, event_id, email, name, company, title, bio, location, socials_json, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`,
        )
        .bind(
          s.id,
          s.eventId,
          s.email,
          s.name,
          s.company,
          s.title,
          s.bio,
          s.location,
          s.socials ? JSON.stringify(s.socials) : null,
          s.createdAt,
          s.updatedAt,
        ),
    );
  }

  for (const s of plan.submissions) {
    out.push(
      db
        .prepare(
          `INSERT INTO submissions (id, event_id, form_id, track_id, title, abstract, format, status, answers_json, submitted_at, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
        )
        .bind(
          s.id,
          s.eventId,
          s.formId,
          s.trackId,
          s.title,
          s.abstract,
          s.format,
          s.status,
          JSON.stringify(s.answers),
          s.submittedAt,
          s.createdAt,
          s.updatedAt,
        ),
    );
  }

  for (const ss of plan.submissionSpeakers) {
    out.push(
      db
        .prepare(
          "INSERT INTO submission_speakers (submission_id, speaker_id, role, sort_order) VALUES (?1,?2,?3,?4)",
        )
        .bind(ss.submissionId, ss.speakerId, ss.role, ss.sortOrder),
    );
  }

  for (const s of plan.sessions) {
    out.push(
      db
        .prepare(
          `INSERT INTO sessions (id, event_id, source_submission_id, track_id, title, abstract, format, status, origin, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`,
        )
        .bind(
          s.id,
          s.eventId,
          s.sourceSubmissionId,
          s.trackId,
          s.title,
          s.abstract,
          s.format,
          s.status,
          s.origin,
          s.createdAt,
          s.updatedAt,
        ),
    );
  }

  for (const ss of plan.sessionSpeakers) {
    out.push(
      db
        .prepare(
          "INSERT INTO session_speakers (session_id, speaker_id, role, sort_order) VALUES (?1,?2,?3,?4)",
        )
        .bind(ss.sessionId, ss.speakerId, ss.role, ss.sortOrder),
    );
  }

  for (const slot of plan.agendaSlots) {
    out.push(
      db
        .prepare(
          `INSERT INTO agenda_slots (id, event_id, session_id, room_id, starts_at, ends_at, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
        )
        .bind(
          slot.id,
          slot.eventId,
          slot.sessionId,
          slot.roomId,
          slot.startsAt,
          slot.endsAt,
          slot.createdAt,
          slot.updatedAt,
        ),
    );
  }

  for (const td of plan.taskDefinitions) {
    out.push(
      db
        .prepare(
          `INSERT INTO task_definitions (id, event_id, key, label, description, applies_to, due_at, sort_order)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
        )
        .bind(
          td.id,
          td.eventId,
          td.key,
          td.label,
          td.description,
          td.appliesTo,
          td.dueAt,
          td.sortOrder,
        ),
    );
  }

  for (const t of plan.speakerTasks) {
    out.push(
      db
        .prepare(
          `INSERT INTO speaker_tasks (id, event_id, speaker_id, task_definition_id, status, completed_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7)`,
        )
        .bind(
          t.id,
          t.eventId,
          t.speakerId,
          t.taskDefinitionId,
          t.status,
          t.completedAt,
          t.updatedAt,
        ),
    );
  }

  return out;
}

function summarize(entry: RegisteredDataset, plan: DemoLoadPlan, loaded: boolean): DemoDatasetSummary {
  const conflicts = findScheduleConflicts(plan.agendaSlots, plan.sessionSpeakers);
  return {
    key: entry.key,
    name: entry.label,
    slug: plan.event.slug,
    loaded,
    counts: {
      speakers: plan.speakers.length,
      submissions: plan.submissions.length,
      sessions: plan.sessions.length,
      scheduled: plan.agendaSlots.length,
      conflicts: conflicts.length,
      outstandingTasks: plan.speakerTasks.filter((t) => t.status !== "complete").length,
    },
  };
}

async function isLoaded(db: D1Database, eventId: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS ok FROM events WHERE id = ?").bind(eventId).first<{
    ok: number;
  }>();
  return row?.ok === 1;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

demoApi.use("*", organizerAuth);

demoApi.get("/status", async (c) => {
  const { datasets, errors } = parseDatasets();
  if (errors.length > 0) {
    return errorResponse(500, "demo_data_invalid", `Demo data failed validation: ${errors.join("; ")}`);
  }

  const now = new Date().toISOString();
  const summaries: DemoDatasetSummary[] = [];
  for (const entry of datasets) {
    const plan = buildDemoLoadPlan({ dataset: entry.dataset, now });
    summaries.push(summarize(entry, plan, await isLoaded(c.env.DB, plan.event.id)));
  }

  const body: DemoStatusResponse = { datasets: summaries };
  return c.json(body);
});

demoApi.post("/:key/load", async (c) => {
  const { datasets, errors } = parseDatasets();
  if (errors.length > 0) {
    return errorResponse(500, "demo_data_invalid", `Demo data failed validation: ${errors.join("; ")}`);
  }

  const entry = datasets.find((d) => d.key === c.req.param("key"));
  if (!entry) return errorResponse(404, "dataset_not_found", "No demo dataset with that key.");

  const now = new Date().toISOString();
  const plan = buildDemoLoadPlan({ dataset: entry.dataset, now });

  if (plan.unknownSpeakerKeys.length > 0 || plan.unknownRefs.length > 0) {
    return errorResponse(
      422,
      "demo_data_broken_refs",
      `Demo data references things that do not exist: ${[
        ...plan.unknownSpeakerKeys.map((k) => `speaker:${k}`),
        ...plan.unknownRefs,
      ].join(", ")}. Run 'pnpm demo:check' for detail.`,
    );
  }

  // Delete then insert: makes load idempotent and doubles as reset.
  await c.env.DB.batch(deleteStatements(c.env.DB, plan.event.id));
  await c.env.DB.batch(insertStatements(c.env.DB, plan));

  const conflicts = findScheduleConflicts(plan.agendaSlots, plan.sessionSpeakers);
  const body: DemoLoadResponse = {
    dataset: summarize(entry, plan, true),
    report: [
      `Loaded "${entry.label}" at /e/${plan.event.slug}`,
      `${plan.speakers.length} speakers, ${plan.submissions.length} submissions`,
      `${plan.sessions.length} sessions — ${plan.sessions.filter((s) => s.sourceSubmissionId !== null).length} from accepted submissions, ${plan.sessions.filter((s) => s.origin === "direct").length} added directly`,
      `${plan.agendaSlots.length} scheduled, ${conflicts.length} conflicts staged`,
      ...conflicts.map((cf) => `  conflict (${cf.type}): ${cf.message}`),
      `${plan.speakerTasks.filter((t) => t.status !== "complete").length} outstanding speaker tasks`,
    ],
  };
  return c.json(body);
});

demoApi.post("/:key/unload", async (c) => {
  const { datasets } = parseDatasets();
  const entry = datasets.find((d) => d.key === c.req.param("key"));
  if (!entry) return errorResponse(404, "dataset_not_found", "No demo dataset with that key.");

  const now = new Date().toISOString();
  const plan = buildDemoLoadPlan({ dataset: entry.dataset, now });
  await c.env.DB.batch(deleteStatements(c.env.DB, plan.event.id));

  const body: DemoLoadResponse = {
    dataset: summarize(entry, plan, false),
    report: [`Removed "${entry.label}". The seeded demo event is untouched.`],
  };
  return c.json(body);
});
