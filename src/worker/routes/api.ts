import { Hono } from "hono";
import pkg from "../../../package.json";
import {
  AssetKind,
  CfpSubmissionRequest,
  type CreateSubmissionResponse,
  type EventCounts,
  type EventsListResponse,
  type HealthResponse,
  type SubmissionsListResponse,
  type UploadAssetResponse,
} from "../../shared/contracts";
import { isCfpOpen } from "../../shared/domain/cfp";
import { missingRequiredFields, pruneAnswers } from "../../shared/domain/rules";
import { randomId } from "../../shared/ids";
import type { Env } from "../env";
import { organizerAuth } from "../lib/auth";
import { errorResponse } from "../lib/http";
import { createRepo } from "../repo/factory";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const api = new Hono<{ Bindings: Env }>();

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
// Organizer (passcode-gated)
// ---------------------------------------------------------------------------

api.get("/admin/ping", organizerAuth, (c) => c.body(null, 204));

api.get("/events/:slug/submissions", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const submissions = await repo.listSubmissions(bundle.event.id);
  const body: SubmissionsListResponse = { submissions };
  return c.json(body);
});

api.get("/events/:slug/counts", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const counts: EventCounts = await repo.countsForEvent(bundle.event.id);
  return c.json(counts);
});

// ---------------------------------------------------------------------------
// Speaker assets: R2 upload round trip
// ---------------------------------------------------------------------------

api.post("/speakers/:speakerId/assets", organizerAuth, async (c) => {
  const speakerId = c.req.param("speakerId");
  const repo = createRepo(c.env);

  const speaker = await repo.getSpeakerById(speakerId);
  if (!speaker) return errorResponse(404, "speaker_not_found", "No speaker with that id.");

  let form: FormData;
  try {
    form = await c.req.raw.formData();
  } catch {
    return errorResponse(400, "bad_request", "Expected multipart/form-data with a 'file' part.");
  }

  // workers-types declares FormData.get as string-only; the runtime returns a
  // real File for file parts, so narrow through unknown.
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
  const safeName =
    file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || `upload-${assetId}.bin`;
  const r2Key = `speakers/${speakerId}/${assetId}/${safeName}`;
  const contentType = file.type || "application/octet-stream";

  await c.env.BUCKET.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType },
  });

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
