import { Hono, type Context } from "hono";
import pkg from "../../../package.json";
import {
  AssetKind,
  AgendaSlotRequest,
  type AirtableStatusResponse,
  CfpSubmissionRequest,
  CommunicationKind,
  type CommunicationPreviewResponse,
  CreateDirectSessionRequest,
  type CreateDirectSessionResponse,
  type CreateSubmissionResponse,
  type EventCounts,
  type EventsListResponse,
  type HealthResponse,
  type OrganizerAgendaResponse,
  type PublicScheduleResponse,
  type PublicSessionsResponse,
  type PublicSpeakersResponse,
  SubmissionDecisionRequest,
  type SubmissionDecisionResponse,
  FeedbackDraftRequest,
  type FeedbackDraftResponse,
  type SpeakerPortalResponse,
  SimulateCommunicationRequest,
  type SimulateCommunicationResponse,
  type SubmissionsListResponse,
  type UploadAssetResponse,
  UpdateSpeakerProfileRequest,
  UpdateSpeakerTaskRequest,
} from "../../shared/contracts";
import { isCfpOpen } from "../../shared/domain/cfp";
import { submissionsToCsv } from "../../shared/domain/csv";
import { buildCalendarInvite } from "../../shared/domain/ics";
import { missingRequiredFields, pruneAnswers } from "../../shared/domain/rules";
import { randomId } from "../../shared/ids";
import type { Env } from "../env";
import { organizerAuth } from "../lib/auth";
import { errorResponse } from "../lib/http";
import { createRepo } from "../repo/factory";
import { draftDecisionFeedback } from "../integrations/decisionFeedback";
import { AirtableRepo } from "../repo/airtable/airtableRepo";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const WALKTHROUGH_R2_KEY = "submission/speakerops-walkthrough-final.mp4";
const WALKTHROUGH_FILENAME = "speakerops-walkthrough-final.mp4";

function walkthroughHeaders(object: R2Object): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "video/mp4");
  headers.set("content-length", String(object.size));
  headers.set("content-disposition", `inline; filename="${WALKTHROUGH_FILENAME}"`);
  headers.set("cache-control", "public, max-age=3600");
  headers.set("etag", object.httpEtag);
  return headers;
}

export const api = new Hono<{ Bindings: Env }>();

async function uploadSpeakerAsset(
  c: Context<{ Bindings: Env }>,
  speakerId: string,
): Promise<Response> {
  const repo = createRepo(c.env);
  const speaker = await repo.getSpeakerById(speakerId);
  if (!speaker) return errorResponse(404, "speaker_not_found", "No speaker with that id.");

  let form: FormData;
  try {
    form = await c.req.raw.formData();
  } catch {
    return errorResponse(400, "bad_request", "Expected multipart/form-data with a 'file' part.");
  }

  const filePart: unknown = form.get("file");
  if (!(filePart instanceof File)) {
    return errorResponse(422, "validation_error", "Part 'file' must be a file.");
  }
  const file = filePart;
  const kind = AssetKind.safeParse(form.get("kind"));
  if (!kind.success) {
    return errorResponse(422, "validation_error", "Part 'kind' must be headshot, slides, or document.");
  }
  if (file.size === 0) return errorResponse(422, "validation_error", "Uploaded file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(413, "too_large", "Uploads are limited to 10 MB.");
  }

  const assetId = randomId("asset");
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || `upload-${assetId}.bin`;
  const r2Key = `speakers/${speakerId}/${assetId}/${safeName}`;
  const contentType = file.type || "application/octet-stream";

  await c.env.BUCKET.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType } });
  const asset = await repo.createSpeakerAsset({
    id: assetId,
    speakerId,
    kind: kind.data,
    filename: file.name || safeName,
    contentType,
    sizeBytes: file.size,
    r2Key,
    uploadedAt: new Date().toISOString(),
  });
  const body: UploadAssetResponse = { asset };
  return c.json(body, 201);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeCssColor(value: string | null): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#eef2ff";
}

function embedDocument(title: string, body: string): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #ffffff; color: #18181b; }
    .wrap { padding: 16px; }
    .header { border-bottom: 1px solid #e4e4e7; margin-bottom: 14px; padding-bottom: 12px; }
    .eyebrow { color: #71717a; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    h1 { font-size: 20px; line-height: 1.2; margin: 3px 0 0; }
    .subtle { color: #71717a; font-size: 13px; }
    .stack { display: grid; gap: 10px; }
    .item { border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; }
    .row { align-items: baseline; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
    .title { font-size: 15px; font-weight: 700; line-height: 1.35; margin: 0; }
    .meta { color: #52525b; font-size: 12px; line-height: 1.5; margin-top: 5px; }
    .abstract { color: #3f3f46; font-size: 13px; line-height: 1.55; margin: 8px 0 0; }
    .pill { border-radius: 999px; display: inline-flex; font-size: 11px; font-weight: 700; padding: 2px 8px; }
    .empty { border: 1px dashed #d4d4d8; border-radius: 8px; color: #71717a; font-size: 13px; padding: 16px; text-align: center; }
    .speaker { display: grid; gap: 4px; }
    .speaker-name { font-size: 15px; font-weight: 700; }
    @media (max-width: 520px) { .wrap { padding: 12px; } .row { display: grid; justify-content: start; } }
  </style>
</head>
<body><main class="wrap">${body}</main></body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors *",
      },
    },
  );
}

function formatEmbedDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatEmbedTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function sessionSpeakers(speakers: PublicSessionsResponse["sessions"][number]["speakers"]): string {
  if (speakers.length === 0) return "Speakers TBA";
  return speakers.map((speaker) => escapeHtml(speaker.name)).join(", ");
}

function renderScheduleEmbed(data: PublicScheduleResponse): Response {
  const items =
    data.slots.length === 0
      ? `<div class="empty">Schedule coming soon.</div>`
      : data.slots
          .map((slot) => {
            const track = slot.session.track;
            const starts = formatEmbedDateTime(slot.startsAt, data.timezone);
            const ends = formatEmbedTime(slot.endsAt, data.timezone);
            return `<article class="item">
  <div class="row">
    <p class="title">${escapeHtml(slot.session.title)}</p>
    ${track ? `<span class="pill" style="background:${safeCssColor(track.color)}; color:#18181b">${escapeHtml(track.name)}</span>` : ""}
  </div>
  <div class="meta">${escapeHtml(starts)}-${escapeHtml(ends)}${slot.room ? ` · ${escapeHtml(slot.room.name)}` : ""} · ${sessionSpeakers(slot.session.speakers)}</div>
  <p class="abstract">${escapeHtml(slot.session.abstract)}</p>
</article>`;
          })
          .join("");

  return embedDocument(
    `${data.event.name} schedule`,
    `<header class="header"><div class="eyebrow">Schedule</div><h1>${escapeHtml(data.event.name)}</h1><div class="subtle">${escapeHtml(data.timezone)}</div></header><section class="stack">${items}</section>`,
  );
}

function renderSessionsEmbed(data: PublicSessionsResponse): Response {
  const items =
    data.sessions.length === 0
      ? `<div class="empty">Sessions coming soon.</div>`
      : data.sessions
          .map((session) => {
            const track = session.track;
            return `<article class="item">
  <div class="row">
    <p class="title">${escapeHtml(session.title)}</p>
    ${track ? `<span class="pill" style="background:${safeCssColor(track.color)}; color:#18181b">${escapeHtml(track.name)}</span>` : ""}
  </div>
  <div class="meta">${escapeHtml(session.format)} · ${sessionSpeakers(session.speakers)}</div>
  <p class="abstract">${escapeHtml(session.abstract)}</p>
</article>`;
          })
          .join("");

  return embedDocument(
    `${data.event.name} sessions`,
    `<header class="header"><div class="eyebrow">Sessions</div><h1>${escapeHtml(data.event.name)}</h1></header><section class="stack">${items}</section>`,
  );
}

function renderSpeakersEmbed(data: PublicSpeakersResponse): Response {
  const items =
    data.speakers.length === 0
      ? `<div class="empty">Speakers coming soon.</div>`
      : data.speakers
          .map(
            (speaker) => `<article class="item speaker">
  <div class="speaker-name">${escapeHtml(speaker.name)}</div>
  <div class="meta">${escapeHtml([speaker.title, speaker.company].filter(Boolean).join(", ") || "Speaker")}${speaker.location ? ` · ${escapeHtml(speaker.location)}` : ""}</div>
  ${speaker.bio ? `<p class="abstract">${escapeHtml(speaker.bio)}</p>` : ""}
</article>`,
          )
          .join("");

  return embedDocument(
    `${data.event.name} speakers`,
    `<header class="header"><div class="eyebrow">Speakers</div><h1>${escapeHtml(data.event.name)}</h1></header><section class="stack">${items}</section>`,
  );
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

api.get("/health", async (c) => {
  let db = false;
  try {
    db = await createRepo(c.env).health();
  } catch {
    db = false;
  }
  const body: HealthResponse = {
    ok: db,
    service: "speakerops",
    version: pkg.version,
    dataBackend: c.env.DATA_BACKEND === "airtable" ? "airtable" : "d1",
    time: new Date().toISOString(),
    checks: {
      db,
      r2Bound: typeof c.env.BUCKET?.put === "function",
    },
  };
  return c.json(body, db ? 200 : 503);
});

// ---------------------------------------------------------------------------
// Public: events
// ---------------------------------------------------------------------------

api.get("/events", async (c) => {
  const events = await createRepo(c.env).listEvents();
  const body: EventsListResponse = { events };
  return c.json(body);
});

api.get("/events/:slug", async (c) => {
  const bundle = await createRepo(c.env).getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  return c.json(bundle);
});

api.get("/public/events/:slug/schedule", async (c) => {
  const body = await createRepo(c.env).getPublicSchedule(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return c.json(body);
});

api.get("/public/events/:slug/sessions", async (c) => {
  const body = await createRepo(c.env).getPublicSessions(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return c.json(body);
});

api.get("/public/events/:slug/speakers", async (c) => {
  const body = await createRepo(c.env).getPublicSpeakers(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return c.json(body);
});

api.get("/embeds/events/:slug/schedule", async (c) => {
  const body = await createRepo(c.env).getPublicSchedule(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return renderScheduleEmbed(body);
});

api.get("/embeds/events/:slug/sessions", async (c) => {
  const body = await createRepo(c.env).getPublicSessions(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return renderSessionsEmbed(body);
});

api.get("/embeds/events/:slug/speakers", async (c) => {
  const body = await createRepo(c.env).getPublicSpeakers(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return renderSpeakersEmbed(body);
});

api.get("/docs", (c) =>
  c.json({
    name: "SpeakerOps API",
    version: pkg.version,
    basePath: "/api",
    auth: {
      public: "No auth. Public routes never include speaker emails or organizer-only review data.",
      organizer: "Bearer passcode in the Authorization header.",
    },
    endpoints: [
      { method: "GET", path: "/health", auth: "public", purpose: "Worker, version, backend, D1/R2 checks." },
      { method: "GET", path: "/events", auth: "public", purpose: "List public events." },
      { method: "GET", path: "/events/:slug", auth: "public", purpose: "Event bundle for event and CFP pages." },
      { method: "GET", path: "/public/events/:slug/schedule", auth: "public", purpose: "Iframe-safe schedule JSON." },
      { method: "GET", path: "/public/events/:slug/sessions", auth: "public", purpose: "Iframe-safe sessions JSON." },
      { method: "GET", path: "/public/events/:slug/speakers", auth: "public", purpose: "Iframe-safe speaker gallery JSON." },
      { method: "GET", path: "/embeds/events/:slug/schedule", auth: "public", purpose: "Drop-in schedule iframe HTML." },
      { method: "GET", path: "/embeds/events/:slug/sessions", auth: "public", purpose: "Drop-in sessions iframe HTML." },
      { method: "GET", path: "/embeds/events/:slug/speakers", auth: "public", purpose: "Drop-in speaker gallery iframe HTML." },
      { method: "POST", path: "/events/:slug/submissions", auth: "public", purpose: "Submit a CFP proposal." },
      { method: "GET", path: "/speaker-portal/:token", auth: "public", purpose: "Speaker portal bundle; demo tokens currently map to seeded speaker ids." },
      { method: "PATCH", path: "/speaker-portal/:token/profile", auth: "speaker link", purpose: "Update the linked speaker's public profile." },
      { method: "PUT", path: "/speaker-portal/:token/tasks/:taskId", auth: "speaker link", purpose: "Complete or reopen a linked speaker task." },
      { method: "POST", path: "/speaker-portal/:token/assets", auth: "speaker link", purpose: "Upload the linked speaker's headshot, slides, or document to R2." },
      { method: "GET", path: "/events/:slug/submissions", auth: "organizer", purpose: "Organizer submissions list." },
      { method: "GET", path: "/events/:slug/submissions.csv", auth: "organizer", purpose: "Submissions export as CSV (Excel-friendly)." },
      { method: "POST", path: "/events/:slug/submissions/:submissionId/feedback-draft", auth: "organizer", purpose: "Draft a decision-feedback email from the organizer's own reasoning; AI-assisted when a key is configured, deterministic template otherwise. Never auto-sends." },
      { method: "POST", path: "/events/:slug/submissions/:submissionId/decision", auth: "organizer", purpose: "Approve, waitlist, or deny a proposal; approval creates one idempotent session." },
      { method: "GET", path: "/events/:slug/counts", auth: "organizer", purpose: "Organizer dashboard counts." },
      { method: "GET", path: "/integrations/airtable/status", auth: "organizer", purpose: "Airtable proof connectivity, rate guard, and D1 fallback status." },
      { method: "GET", path: "/events/:slug/agenda", auth: "organizer", purpose: "Sessions, placements, and computed room/speaker conflicts." },
      { method: "POST", path: "/events/:slug/sessions", auth: "organizer", purpose: "Add an invited or sponsor session directly, without a submission." },
      { method: "PUT", path: "/events/:slug/sessions/:sessionId/slot", auth: "organizer", purpose: "Create or move a session placement and recompute conflicts." },
      { method: "GET", path: "/events/:slug/communications/preview", auth: "organizer", purpose: "Render a task reminder or session-update email preview." },
      { method: "POST", path: "/events/:slug/communications/simulate", auth: "organizer", purpose: "Persist a safe simulated message and successful delivery attempt." },
      { method: "GET", path: "/public/events/:slug/sessions/:sessionId/calendar.ics", auth: "public", purpose: "Download a scheduled session as an RFC 5545 calendar file." },
      { method: "GET", path: "/public/walkthrough.mp4", auth: "public", purpose: "Stream the narrated submission walkthrough stored in R2." },
      { method: "POST", path: "/speakers/:speakerId/assets", auth: "organizer", purpose: "Upload a speaker asset to R2." },
      { method: "GET", path: "/assets/:assetId", auth: "public", purpose: "Stream a stored asset." },
    ],
    embeds: {
      schedule:
        '<iframe src="/api/embeds/events/horizon-2026/schedule" title="Horizon Dev Summit schedule" width="100%" height="640" loading="lazy"></iframe>',
      sessions:
        '<iframe src="/api/embeds/events/horizon-2026/sessions" title="Horizon Dev Summit sessions" width="100%" height="640" loading="lazy"></iframe>',
      speakers:
        '<iframe src="/api/embeds/events/horizon-2026/speakers" title="Horizon Dev Summit speakers" width="100%" height="640" loading="lazy"></iframe>',
    },
  }),
);

// ---------------------------------------------------------------------------
// Public: CFP submission (the write half of the golden path)
// ---------------------------------------------------------------------------

api.post("/events/:slug/submissions", async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  if (!bundle.cfp) {
    return errorResponse(409, "cfp_unavailable", "This event has no call for speakers.");
  }

  const now = new Date().toISOString();
  if (!isCfpOpen(bundle.cfp.form, now)) {
    return errorResponse(409, "cfp_closed", "The call for speakers is closed.");
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }

  const parsed = CfpSubmissionRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Submission is invalid.", parsed.error.issues);
  }
  const data = parsed.data;

  if (!bundle.tracks.some((t) => t.id === data.trackId)) {
    return errorResponse(422, "validation_error", "Unknown track for this event.");
  }

  const ctx = { format: data.format, answers: data.answers ?? {} };
  const missing = missingRequiredFields(bundle.cfp.fields, bundle.cfp.rules, ctx);
  if (missing.length > 0) {
    return errorResponse(
      422,
      "validation_error",
      `Missing required field(s): ${missing.map((f) => f.label).join(", ")}.`,
      missing.map((f) => ({ path: ["answers", f.key], message: "Required" })),
    );
  }

  const submission = await repo.createCfpSubmission({
    eventId: bundle.event.id,
    formId: bundle.cfp.form.id,
    trackId: data.trackId,
    title: data.title,
    abstract: data.abstract,
    format: data.format,
    answers: pruneAnswers(bundle.cfp.fields, bundle.cfp.rules, ctx),
    speaker: data.speaker,
    speakerId: randomId("spk"),
    submissionId: randomId("sub"),
    now,
  });

  const body: CreateSubmissionResponse = { submission };
  return c.json(body, 201);
});

// ---------------------------------------------------------------------------
// Public: speaker portal demo link
// ---------------------------------------------------------------------------

api.get("/speaker-portal/:token", async (c) => {
  const token = c.req.param("token").trim();
  if (!token) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");

  // The seeded demo uses speaker ids as stable demo tokens. Production-grade
  // expiring links are outside the hackathon claim and can replace this seam.
  const bundle = await createRepo(c.env).getSpeakerPortalByToken(token);
  if (!bundle) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");
  return c.json(bundle);
});

api.patch("/speaker-portal/:token/profile", async (c) => {
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  const portal = await repo.getSpeakerPortalByToken(token);
  if (!portal) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = UpdateSpeakerProfileRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Profile is invalid.", parsed.error.issues);
  }
  const body: SpeakerPortalResponse = await repo.updateSpeakerProfile({
    speakerId: portal.speaker.id,
    ...parsed.data,
    now: new Date().toISOString(),
  });
  return c.json(body);
});

api.put("/speaker-portal/:token/tasks/:taskId", async (c) => {
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  const portal = await repo.getSpeakerPortalByToken(token);
  if (!portal) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = UpdateSpeakerTaskRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Task update is invalid.", parsed.error.issues);
  }
  try {
    const body: SpeakerPortalResponse = await repo.updateSpeakerTask({
      speakerId: portal.speaker.id,
      taskId: c.req.param("taskId"),
      status: parsed.data.status,
      now: new Date().toISOString(),
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof Error && error.message === "task_not_found") {
      return errorResponse(404, "task_not_found", "No task with that id for this speaker.");
    }
    throw error;
  }
});

api.post("/speaker-portal/:token/assets", async (c) => {
  const token = c.req.param("token").trim();
  const portal = await createRepo(c.env).getSpeakerPortalByToken(token);
  if (!portal) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");
  return uploadSpeakerAsset(c, portal.speaker.id);
});

// ---------------------------------------------------------------------------
// Organizer (passcode-gated)
// ---------------------------------------------------------------------------

api.get("/admin/ping", organizerAuth, (c) => c.body(null, 204));

api.get("/integrations/airtable/status", organizerAuth, async (c) => {
  const configured = Boolean(c.env.AIRTABLE_TOKEN && c.env.AIRTABLE_BASE_ID);
  let connected = false;
  if (configured) {
    connected = await new AirtableRepo({
      token: c.env.AIRTABLE_TOKEN!,
      baseId: c.env.AIRTABLE_BASE_ID!,
    }).health();
  }
  const body: AirtableStatusResponse = {
    configured,
    active: c.env.DATA_BACKEND === "airtable",
    connected,
    readTables: ["Events", "Speakers"],
    writeTable: "Messages",
    minimumRequestSpacingMs: 210,
    cacheTtlSeconds: 15,
    fallback: "d1",
  };
  return c.json(body);
});

api.get("/events/:slug/submissions", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const submissions = await repo.listSubmissions(bundle.event.id);
  const body: SubmissionsListResponse = { submissions };
  return c.json(body);
});

api.get("/events/:slug/submissions.csv", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const submissions = await repo.listSubmissions(bundle.event.id);
  return new Response(submissionsToCsv(submissions), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="submissions-${bundle.event.slug}.csv"`,
      "cache-control": "no-store",
    },
  });
});

api.post("/events/:slug/submissions/:submissionId/decision", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");

  const submission = await repo.getSubmissionById(c.req.param("submissionId"));
  if (!submission || submission.eventId !== bundle.event.id) {
    return errorResponse(404, "submission_not_found", "No submission with that id for this event.");
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = SubmissionDecisionRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Decision is invalid.", parsed.error.issues);
  }

  try {
    const result = await repo.decideSubmission({
      submissionId: submission.id,
      decision: parsed.data.decision,
      now: new Date().toISOString(),
    });
    const body: SubmissionDecisionResponse = result;
    return c.json(body);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_decision_transition") {
      return errorResponse(
        409,
        "invalid_decision_transition",
        "Accepted proposals can only be approved again. Cancel the live session before changing the decision.",
      );
    }
    throw error;
  }
});

api.post("/events/:slug/submissions/:submissionId/feedback-draft", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");

  const submission = await repo.getSubmissionById(c.req.param("submissionId"));
  if (!submission || submission.eventId !== bundle.event.id) {
    return errorResponse(404, "submission_not_found", "No submission with that id for this event.");
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = FeedbackDraftRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Feedback request is invalid.", parsed.error.issues);
  }

  const primary = submission.speakers[0];
  const draft = await draftDecisionFeedback(
    {
      eventName: bundle.event.name,
      speakerName: primary?.name ?? "there",
      talkTitle: submission.title,
      talkAbstract: submission.abstract,
      decision: parsed.data.decision,
      reasoning: parsed.data.reasoning,
    },
    { apiKey: c.env.ANTHROPIC_API_KEY, model: c.env.ANTHROPIC_MODEL },
  );

  if (draft.providerEvidence) {
    const evidence = draft.providerEvidence;
    const occurredAt = new Date().toISOString();
    const canonical = JSON.stringify({
      provider: "anthropic",
      requestId: evidence.requestId,
      model: evidence.model,
      purpose: "decision_feedback_draft",
      usage: evidence.usage,
    });
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const evidenceSha256 = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const usage = evidence.usage;
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO ai_usage_events (
         id, provider, provider_request_id, model, purpose, occurred_at,
         input_tokens, cache_creation_input_tokens, cache_creation_5m_input_tokens,
         cache_creation_1h_input_tokens, cache_read_input_tokens, output_tokens,
         evidence_sha256, measurement
       ) VALUES (?1, 'anthropic', ?2, ?3, 'decision_feedback_draft', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'provider_reported')`,
    ).bind(
      randomId("aiu"),
      evidence.requestId,
      evidence.model,
      occurredAt,
      usage.inputTokens,
      usage.cacheCreationInputTokens,
      usage.cacheCreation5mInputTokens,
      usage.cacheCreation1hInputTokens,
      usage.cacheReadInputTokens,
      usage.outputTokens,
      evidenceSha256,
    ).run();
  }

  const { providerEvidence: _privateProviderEvidence, ...publicDraft } = draft;
  const body: FeedbackDraftResponse = publicDraft;
  return c.json(body);
});

api.get("/admin/ai-usage", organizerAuth, async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT provider, provider_request_id, model, purpose, occurred_at,
            input_tokens, cache_creation_input_tokens,
            cache_creation_5m_input_tokens, cache_creation_1h_input_tokens,
            cache_read_input_tokens, output_tokens, evidence_sha256, measurement
       FROM ai_usage_events
      ORDER BY occurred_at ASC, provider_request_id ASC`,
  ).all();
  return c.json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    privacy: "Provider counters only; prompts, reviewer notes, and generated content are not stored.",
    events: result.results ?? [],
  });
});

api.get("/events/:slug/counts", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const counts: EventCounts = await repo.countsForEvent(bundle.event.id);
  return c.json(counts);
});

api.get("/events/:slug/agenda", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const body: OrganizerAgendaResponse = await repo.getOrganizerAgenda(bundle.event.id);
  return c.json(body);
});

api.post("/events/:slug/sessions", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = CreateDirectSessionRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Session is invalid.", parsed.error.issues);
  }
  const data = parsed.data;
  if (data.trackId && !bundle.tracks.some((track) => track.id === data.trackId)) {
    return errorResponse(422, "validation_error", "Unknown track for this event.");
  }

  const speakerIds = [...new Set(data.speakerIds)];
  const speakers = await Promise.all(speakerIds.map((id) => repo.getSpeakerById(id)));
  if (speakers.some((speaker) => !speaker || speaker.eventId !== bundle.event.id)) {
    return errorResponse(422, "validation_error", "One or more speakers do not belong to this event.");
  }

  const session = await repo.createDirectSession({
    id: randomId("ses"),
    eventId: bundle.event.id,
    title: data.title,
    abstract: data.abstract,
    format: data.format,
    trackId: data.trackId ?? null,
    speakerIds,
    now: new Date().toISOString(),
  });
  const body: CreateDirectSessionResponse = { session };
  return c.json(body, 201);
});

api.put("/events/:slug/sessions/:sessionId/slot", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const agenda = await repo.getOrganizerAgenda(bundle.event.id);
  if (!agenda.sessions.some((session) => session.id === c.req.param("sessionId"))) {
    return errorResponse(404, "session_not_found", "No session with that id for this event.");
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = AgendaSlotRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Agenda placement is invalid.", parsed.error.issues);
  }
  if (!bundle.rooms.some((room) => room.id === parsed.data.roomId)) {
    return errorResponse(422, "validation_error", "Unknown room for this event.");
  }

  const body: OrganizerAgendaResponse = await repo.upsertAgendaSlot({
    id: randomId("slot"),
    eventId: bundle.event.id,
    sessionId: c.req.param("sessionId"),
    roomId: parsed.data.roomId,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    now: new Date().toISOString(),
  });
  return c.json(body);
});

api.get("/events/:slug/communications/preview", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const kind = CommunicationKind.safeParse(c.req.query("kind") ?? "reminder");
  if (!kind.success) {
    return errorResponse(422, "validation_error", "Communication kind must be reminder or session_update.");
  }
  const speakerId = c.req.query("speakerId") ?? "";
  const portal = await repo.getSpeakerPortalByToken(speakerId);
  if (!portal || portal.event.id !== bundle.event.id) {
    return errorResponse(404, "speaker_not_found", "No speaker with that id for this event.");
  }

  const pending = portal.tasks.filter((item) => item.task.status !== "complete");
  const origin = new URL(c.req.url).origin;
  const portalUrl = `${origin}/speaker/${encodeURIComponent(portal.speaker.id)}`;
  const session = portal.sessions.find((item) => item.startsAt && item.endsAt) ?? portal.sessions[0];
  let subject: string;
  let bodyMd: string;
  if (kind.data === "reminder") {
    subject = `Action needed for ${bundle.event.name}: ${pending.length} item(s) outstanding`;
    const taskLines = pending.length
      ? pending.map((item) => `- ${item.definition.label}`).join("\n")
      : "- Nothing outstanding — you are all set.";
    bodyMd = `Hi ${portal.speaker.name},\n\nHere is your onboarding checklist for ${bundle.event.name}:\n\n${taskLines}\n\nReview your profile, files, and tasks in the speaker portal: ${portalUrl}\n\nThanks!\nThe ${bundle.event.name} team`;
  } else if (session) {
    const when = session.startsAt
      ? new Intl.DateTimeFormat("en", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: bundle.event.timezone,
        }).format(new Date(session.startsAt))
      : "a time to be confirmed";
    subject = `Your session at ${bundle.event.name}: ${session.title}`;
    bodyMd = `Hi ${portal.speaker.name},\n\nYour session **${session.title}** is scheduled for ${when}${session.roomName ? ` in ${session.roomName}` : ""}.\n\nA calendar file is ready below. Please arrive 20 minutes early for tech check.\n\nThe ${bundle.event.name} team`;
  } else {
    subject = `Program update from ${bundle.event.name}`;
    bodyMd = `Hi ${portal.speaker.name},\n\nYour program details are still being finalized. We will send your session time and room as soon as they are confirmed.\n\nThe ${bundle.event.name} team`;
  }

  const body: CommunicationPreviewResponse = {
    kind: kind.data,
    speakerId: portal.speaker.id,
    speakerName: portal.speaker.name,
    toEmail: portal.speaker.email,
    subject,
    bodyMd,
    pendingTaskCount: pending.length,
    icsUrl:
      kind.data === "session_update" && session?.startsAt && session.endsAt
        ? `/api/public/events/${encodeURIComponent(bundle.event.slug)}/sessions/${encodeURIComponent(session.id)}/calendar.ics`
        : null,
  };
  return c.json(body);
});

api.post("/events/:slug/communications/simulate", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = SimulateCommunicationRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Communication is invalid.", parsed.error.issues);
  }
  const speaker = await repo.getSpeakerById(parsed.data.speakerId);
  if (!speaker || speaker.eventId !== bundle.event.id) {
    return errorResponse(404, "speaker_not_found", "No speaker with that id for this event.");
  }
  const now = new Date().toISOString();
  const messageId = randomId("msg");
  await repo.simulateCommunication({
    messageId,
    attemptId: randomId("del"),
    eventId: bundle.event.id,
    speakerId: speaker.id,
    toEmail: speaker.email,
    subject: parsed.data.subject,
    bodyMd: parsed.data.bodyMd,
    now,
  });
  const body: SimulateCommunicationResponse = {
    messageId,
    status: "sent_simulated",
    deliveredAt: now,
  };
  return c.json(body, 201);
});

api.get("/public/events/:slug/sessions/:sessionId/calendar.ics", async (c) => {
  const repo = createRepo(c.env);
  const [bundle, schedule] = await Promise.all([
    repo.getEventBySlug(c.req.param("slug")),
    repo.getPublicSchedule(c.req.param("slug")),
  ]);
  if (!bundle || !schedule) return errorResponse(404, "event_not_found", "No event with that slug.");
  const slot = schedule.slots.find((item) => item.session.id === c.req.param("sessionId"));
  if (!slot) return errorResponse(404, "session_not_scheduled", "That session has no published placement.");

  const ics = buildCalendarInvite({
    uid: `${slot.session.id}@speakerops`,
    eventName: bundle.event.name,
    sessionTitle: slot.session.title,
    description: slot.session.abstract,
    location: slot.room?.name ?? bundle.event.venue ?? "Room TBA",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    generatedAt: new Date().toISOString(),
  });
  const filename = `${slot.session.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "session"}.ics`;
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "public, max-age=60",
    },
  });
});

// The submission walkthrough lives in R2 rather than the git repository. This
// stable public URL keeps the handoff tied to the deployed open-source project
// without committing a multi-megabyte binary to source control.
api.on(["GET", "HEAD"], "/public/walkthrough.mp4", async (c) => {
  if (c.req.method === "HEAD") {
    const object = await c.env.BUCKET.head(WALKTHROUGH_R2_KEY);
    if (!object) return errorResponse(404, "walkthrough_missing", "The submission walkthrough has not been published.");
    return new Response(null, { headers: walkthroughHeaders(object) });
  }

  const object = await c.env.BUCKET.get(WALKTHROUGH_R2_KEY);
  if (!object) return errorResponse(404, "walkthrough_missing", "The submission walkthrough has not been published.");
  return new Response(object.body, { headers: walkthroughHeaders(object) });
});

// ---------------------------------------------------------------------------
// Speaker assets: R2 upload round trip
// ---------------------------------------------------------------------------

api.post("/speakers/:speakerId/assets", organizerAuth, async (c) => {
  return uploadSpeakerAsset(c, c.req.param("speakerId"));
});

api.get("/assets/:assetId", async (c) => {
  const asset = await createRepo(c.env).getSpeakerAssetById(c.req.param("assetId"));
  if (!asset) return errorResponse(404, "asset_not_found", "No asset with that id.");

  const object = await c.env.BUCKET.get(asset.r2Key);
  if (!object) {
    return errorResponse(404, "object_missing", "Asset record exists but the stored object is gone.");
  }

  return new Response(object.body, {
    headers: {
      "content-type": asset.contentType,
      "content-length": String(asset.sizeBytes),
      "content-disposition": `inline; filename="${asset.filename.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=60",
      etag: object.httpEtag,
    },
  });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

api.onError((err, _c) => {
  console.error("api error:", err);
  return errorResponse(500, "internal", "Internal error.");
});
