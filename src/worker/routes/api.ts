import { Hono, type Context } from "hono";
import pkg from "../../../package.json";
import {
  AssetKind,
  AgendaSlotRequest,
  UpdateSessionRequest,
  SessionContentApprovalRequest,
  type SessionVersionsResponse,
  CfpSubmissionRequest,
  CfpDraftRequest,
  type CfpDraftResponse,
  CommunicationKind,
  type CommunicationPreviewResponse,
  CreateDirectSessionRequest,
  type CreateDirectSessionResponse,
  type CreateSubmissionResponse,
  type EventCounts,
  type EvaluationWorkspaceResponse,
  type EventsListResponse,
  CreateEventRequest,
  UpdateEventSettingsRequest,
  CreateTrackRequest,
  CreateRoomRequest,
  CreateFormFieldRequest,
  type HealthResponse,
  type OrganizerAgendaResponse,
  type PublishAgendaResponse,
  type OrganizerSpeakersResponse,
  CreateOrganizerSpeakerRequest,
  UpdateOrganizerSpeakerRequest,
  type OrganizerSpeakerMutationResponse,
  ImportOrganizerSpeakersRequest,
  type ImportOrganizerSpeakersResponse,
  CreateSpeakerTaskRequest,
  type CreateSpeakerTaskResponse,
  BulkTaskReminderRequest,
  type BulkTaskReminderResponse,
  BulkAssetDownloadRequest,
  CreateAssetCommentRequest,
  type AssetCommentResponse,
  BulkCommunicationRequest,
  type BulkCommunicationResponse,
  type PublicScheduleResponse,
  type PublicSessionsResponse,
  type PublicSpeakersResponse,
  SubmissionDecisionRequest,
  type SubmissionDecisionResponse,
  FeedbackDraftRequest,
  ScheduleNoticeDraftRequest,
  type ScheduleNoticeDraftResponse,
  type FeedbackDraftResponse,
  type SpeakerPortalResponse,
  SimulateCommunicationRequest,
  type SimulateCommunicationResponse,
  type SubmissionsListResponse,
  type UploadAssetResponse,
  UpdateSpeakerProfileRequest,
  UpdateSpeakerTaskRequest,
  UpdateSpeakerProposalRequest,
  SaveEvaluationRoundRequest,
  SaveRoundReviewerRequest,
  SaveAssignmentsRequest,
  SubmitReviewRequest,
  type ReviewerQueueResponse,
  type OutboxResponse,
  type Speaker,
  type SpeakerAsset,
} from "../../shared/contracts";
import { canEditSpeakerProposal, isCfpOpen, speakerProposalLockReason } from "../../shared/domain/cfp";
import { reviewResultsToCsv, submissionsToCsv } from "../../shared/domain/csv";
import { buildCalendarCollection, buildCalendarInvite } from "../../shared/domain/ics";
import { missingRequiredFields, pruneAnswers } from "../../shared/domain/rules";
import { parseSpeakerCsv } from "../../shared/domain/speakerCsv";
import { buildStoreZip } from "../../shared/domain/zip";
import { randomId } from "../../shared/ids";
import type { Env } from "../env";
import { organizerAuth } from "../lib/auth";
import { errorResponse } from "../lib/http";
import { createRepo } from "../repo/factory";
import { draftDecisionFeedback, type ProviderEvidence } from "../integrations/decisionFeedback";
import { draftScheduleNotice, formatSlotWindow } from "../integrations/scheduleNotice";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const WALKTHROUGH_R2_KEY = "submission/lectern-walkthrough-final.mp4";
const WALKTHROUGH_FILENAME = "lectern-walkthrough-final.mp4";

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

async function saveCfpDraft(c: Context<{ Bindings: Env }>, token: string) {
  const slug = c.req.param("slug") ?? "";
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(slug);
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  if (!bundle.cfp || !bundle.cfp.form.allowDrafts) {
    return errorResponse(409, "drafts_unavailable", "This call for speakers does not accept drafts.");
  }
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = CfpDraftRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Draft is invalid.", parsed.error.issues);
  }
  const saved = await repo.saveCfpDraft({
    token,
    eventId: bundle.event.id,
    formId: bundle.cfp.form.id,
    draft: parsed.data,
    now: new Date().toISOString(),
  });
  const body: CfpDraftResponse = {
    ...saved,
    resumeUrl: `/e/${encodeURIComponent(slug)}/cfp?draft=${encodeURIComponent(token)}`,
  };
  return c.json(body);
}

function runtimeAiConfig(env: Env): { apiKey?: string; model?: string } {
  if (env.AI_RUNTIME_MODE !== "enabled") return {};
  return { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL };
}

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
  const taskId = typeof form.get("taskId") === "string" && String(form.get("taskId")).trim()
    ? String(form.get("taskId")).trim() : null;
  const sessionId = typeof form.get("sessionId") === "string" && String(form.get("sessionId")).trim()
    ? String(form.get("sessionId")).trim() : null;
  const portal = await repo.getSpeakerPortalByToken(speakerId);
  if (taskId && !portal?.tasks.some(({ task }) => task.id === taskId)) {
    return errorResponse(422, "task_not_found", "The selected task does not belong to this speaker.");
  }
  if (sessionId && !portal?.sessions.some((session) => session.id === sessionId)) {
    return errorResponse(422, "session_not_found", "The selected session does not belong to this speaker.");
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
    taskId,
    sessionId,
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

function xmlText(value: string): string {
  return escapeHtml(value);
}

function publicProgramXml(
  kind: string,
  schedule: PublicScheduleResponse,
  sessions: PublicSessionsResponse,
  speakers: PublicSpeakersResponse,
): string | null {
  if (kind === "speakers" || kind === "gallery") {
    return `<?xml version="1.0" encoding="UTF-8"?><speakers event="${xmlText(speakers.event.name)}">${speakers.speakers.map((speaker) => `<speaker id="${xmlText(speaker.id)}"><name>${xmlText(speaker.name)}</name><title>${xmlText(speaker.title ?? "")}</title><company>${xmlText(speaker.company ?? "")}</company><bio>${xmlText(speaker.bio ?? "")}</bio></speaker>`).join("")}</speakers>`;
  }
  if (kind === "sessions") {
    return `<?xml version="1.0" encoding="UTF-8"?><sessions event="${xmlText(sessions.event.name)}">${sessions.sessions.map((session) => `<session id="${xmlText(session.id)}" format="${xmlText(session.format)}"><title>${xmlText(session.title)}</title><description>${xmlText(session.abstract)}</description><track>${xmlText(session.track?.name ?? "")}</track>${session.speakers.map((speaker) => `<speaker role="${xmlText(speaker.role)}">${xmlText(speaker.name)}</speaker>`).join("")}</session>`).join("")}</sessions>`;
  }
  if (kind === "schedule" || kind === "itinerary") {
    return `<?xml version="1.0" encoding="UTF-8"?><schedule event="${xmlText(schedule.event.name)}" timezone="${xmlText(schedule.timezone)}">${schedule.slots.map((slot) => `<slot id="${xmlText(slot.id)}" starts-at="${xmlText(slot.startsAt)}" ends-at="${xmlText(slot.endsAt)}"><room>${xmlText(slot.room?.name ?? "")}</room><session id="${xmlText(slot.session.id)}">${xmlText(slot.session.title)}</session></slot>`).join("")}</schedule>`;
  }
  return null;
}

function safeCssColor(value: string | null): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#eef2ff";
}

interface EmbedOptions {
  color: string;
  track: string | null;
  showDescription: boolean;
  showCompany: boolean;
}

function embedOptions(c: Context<{ Bindings: Env }>): EmbedOptions {
  const requested = c.req.query("color") ?? "";
  return {
    color: /^#[0-9a-fA-F]{6}$/.test(requested) ? requested : "#4338ca",
    track: c.req.query("track")?.trim() || null,
    showDescription: c.req.query("description") !== "0",
    showCompany: c.req.query("company") !== "0",
  };
}

function filterSchedule(data: PublicScheduleResponse, track: string | null): PublicScheduleResponse {
  return track ? { ...data, slots: data.slots.filter((slot) => slot.session.track?.id === track) } : data;
}

function filterSessions(data: PublicSessionsResponse, track: string | null): PublicSessionsResponse {
  return track ? { ...data, sessions: data.sessions.filter((session) => session.track?.id === track) } : data;
}

function filterSpeakers(data: PublicSpeakersResponse, schedule: PublicScheduleResponse, track: string | null): PublicSpeakersResponse {
  if (!track) return data;
  const ids = new Set(schedule.slots.filter((slot) => slot.session.track?.id === track).flatMap((slot) => slot.session.speakers.map((speaker) => speaker.id)));
  return { ...data, speakers: data.speakers.filter((speaker) => ids.has(speaker.id)) };
}

function embedDocument(title: string, body: string, interactive = false, color = "#4338ca"): Response {
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
    .speaker { display: flex; gap: 12px; align-items: flex-start; }
    .speaker-body { display: grid; gap: 4px; min-width: 0; }
    .speaker-name { font-size: 15px; font-weight: 700; }
    .avatar { border-radius: 999px; flex-shrink: 0; height: 48px; object-fit: cover; width: 48px; }
    .avatar-initials { align-items: center; background: #eef2ff; color: ${color}; display: flex; font-size: 15px;
                       font-weight: 700; justify-content: center; }
    .day { border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 13px; font-weight: 700; margin: 16px 0 2px;
           padding-bottom: 6px; }
    .day:first-of-type { margin-top: 4px; }
    .time { color: ${color}; font-size: 12px; font-weight: 700; letter-spacing: .02em; }
    .group { color: #71717a; font-size: 12px; font-weight: 700; letter-spacing: .04em; margin: 16px 0 2px;
             text-transform: uppercase; }
    .group:first-of-type { margin-top: 4px; }
    .controls { display: grid; gap: 8px; grid-template-columns: minmax(160px, 1fr) repeat(3, minmax(110px, auto)); margin: 0 0 14px; }
    .control { border: 1px solid #d4d4d8; border-radius: 8px; color: #18181b; font: inherit; min-width: 0; padding: 8px 10px; }
    .count { color: #71717a; font-size: 12px; margin: -5px 0 12px; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .tab { background: #fff; border: 1px solid #d4d4d8; border-radius: 999px; color: #3f3f46; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; padding: 6px 12px; }
    .tab[aria-selected="true"] { background: ${color}; border-color: ${color}; color: #fff; }
    .gallery { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
    .gallery .speaker { min-height: 150px; }
    .gallery .avatar { height: 64px; width: 64px; }
    .action { background: #fff; border: 1px solid #d4d4d8; border-radius: 999px; color: #3f3f46; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; padding: 5px 10px; }
    .action[aria-pressed="true"] { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
    .detail { border-top: 1px solid #e4e4e7; margin-top: 10px; padding-top: 10px; }
    .session-link { border-left: 2px solid #c7d2fe; margin-top: 8px; padding-left: 9px; }
    details summary { color: ${color}; cursor: pointer; font-size: 12px; font-weight: 700; margin-top: 8px; }
    @media (max-width: 520px) { .wrap { padding: 12px; } .row { display: grid; justify-content: start; } }
  </style>
</head>
<body><main class="wrap">${body}</main>${interactive ? `<script>
const items=[...document.querySelectorAll('[data-search]')];
const count=document.querySelector('[data-count]');
function filter(){
 const q=(document.querySelector('[data-query]')?.value||'').toLowerCase();
 const track=document.querySelector('[data-track]')?.value||'';
 const format=document.querySelector('[data-format]')?.value||'';
 const room=document.querySelector('[data-room]')?.value||'';
 let visible=0;
 for(const item of items){const show=(!q||item.dataset.search.includes(q))&&(!track||item.dataset.track===track)&&(!format||item.dataset.format===format)&&(!room||item.dataset.room===room);item.hidden=!show;if(show)visible++;}
 if(count) count.textContent=visible+' result'+(visible===1?'':'s');
}
document.querySelectorAll('[data-filter]').forEach((node)=>node.addEventListener('input',filter));filter();
const dayButtons=[...document.querySelectorAll('[data-day-button]')];
const dayPanels=[...document.querySelectorAll('[data-day-panel]')];
for(const button of dayButtons)button.addEventListener('click',()=>{for(const candidate of dayButtons)candidate.setAttribute('aria-selected',String(candidate===button));for(const panel of dayPanels)panel.hidden=panel.dataset.dayPanel!==button.dataset.dayButton;});
const itinerary=document.querySelector('[data-itinerary]');
if(itinerary){
 const key='lectern.itinerary.'+itinerary.dataset.itinerary;
 let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
 const buttons=[...document.querySelectorAll('[data-save-id]')];const personal=document.querySelector('[data-personal]');const exportLink=document.querySelector('[data-export]');
 function draw(){for(const button of buttons){const on=saved.includes(button.dataset.saveId);button.setAttribute('aria-pressed',String(on));button.textContent=on?'★ Saved':'☆ Save';button.closest('[data-session-card]').hidden=Boolean(personal?.checked&&!on)}if(count)count.textContent=saved.length+' saved';if(exportLink){exportLink.hidden=saved.length===0;exportLink.href='/api/public/events/'+encodeURIComponent(itinerary.dataset.itinerary)+'/itinerary.ics?sessions='+encodeURIComponent(saved.join(','));}}
 for(const button of buttons)button.addEventListener('click',()=>{const id=button.dataset.saveId;saved=saved.includes(id)?saved.filter((value)=>value!==id):[...saved,id];localStorage.setItem(key,JSON.stringify(saved));draw()});personal?.addEventListener('change',draw);document.querySelector('[data-clear]')?.addEventListener('click',()=>{saved=[];localStorage.setItem(key,'[]');draw()});draw();
}
</script>` : ""}</body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
        // img-src 'self' is required or headshots silently vanish: with
        // default-src 'none' the browser blocks headshots. Interactive embeds
        // opt into only their generated inline filter script; no external code.
        "content-security-policy":
          `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; ${interactive ? "script-src 'unsafe-inline';" : ""} base-uri 'none'; frame-ancestors *`,
      },
    },
  );
}

/** "Wednesday, October 14" — the day header on the schedule embed. */
function formatEmbedDay(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

/** Initials for the speaker embed's no-headshot tile. */
function embedInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
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

/**
 * Schedule: the agenda as an attendee reads it — grouped by day, ordered by
 * time, showing only what is actually placed. Distinct on purpose from the
 * sessions embed, which is the catalogue.
 */
export function renderScheduleEmbed(data: PublicScheduleResponse, options: EmbedOptions = { color: "#4338ca", track: null, showDescription: true, showCompany: true }): Response {
  let body: string;
  if (data.slots.length === 0) {
    body = `<div class="empty">Schedule coming soon.</div>`;
  } else {
    const byDay = new Map<string, typeof data.slots>();
    for (const slot of data.slots) {
      const day = formatEmbedDay(slot.startsAt, data.timezone);
      byDay.set(day, [...(byDay.get(day) ?? []), slot]);
    }
    const days = [...byDay.entries()];
    const tabs = `<div class="tabs">${days.map(([day], index) => `<button type="button" class="tab" data-day-button="${escapeHtml(day)}" aria-selected="${index === 0}">${escapeHtml(day)}</button>`).join("")}</div>`;
    body = tabs + days
      .map(([day, slots], index) => {
        const items = slots
          .map((slot) => {
            const track = slot.session.track;
            const starts = formatEmbedTime(slot.startsAt, data.timezone);
            const ends = formatEmbedTime(slot.endsAt, data.timezone);
            return `<details class="item">
  <summary><span class="time">${escapeHtml(starts)}</span> · ${escapeHtml(slot.session.title)}</summary>
  <div class="detail">
  <div class="row">
    <p class="title">${escapeHtml(slot.session.title)}</p>
    ${track ? `<span class="pill" style="background:${safeCssColor(track.color)}; color:#18181b">${escapeHtml(track.name)}</span>` : ""}
  </div>
  <div class="meta"><span class="time">${escapeHtml(starts)}-${escapeHtml(ends)}</span>${slot.room ? ` · ${escapeHtml(slot.room.name)}` : ""} · ${escapeHtml(slot.session.format)} · ${sessionSpeakers(slot.session.speakers)}</div>
  ${options.showDescription ? `<p class="abstract">${escapeHtml(slot.session.abstract)}</p>` : ""}
  </div>
</details>`;
          })
          .join("");
        return `<section data-day-panel="${escapeHtml(day)}" ${index === 0 ? "" : "hidden"}><h2 class="day">${escapeHtml(day)}</h2><div class="stack">${items}</div></section>`;
      })
      .join("");
  }

  return embedDocument(
    `${data.event.name} schedule`,
    `<header class="header"><div class="eyebrow">Schedule</div><h1>${escapeHtml(data.event.name)}</h1><div class="subtle">By day and time · ${escapeHtml(data.timezone)}</div></header>${body}`,
    true,
    options.color,
  );
}

/**
 * Sessions: the full catalogue grouped by track, including talks that have
 * no slot yet. An attendee browsing topics wants this; an attendee planning
 * their day wants the schedule.
 */
export function renderSessionsEmbed(data: PublicSessionsResponse, schedule: PublicScheduleResponse, options: EmbedOptions = { color: "#4338ca", track: null, showDescription: true, showCompany: true }): Response {
  let body: string;
  if (data.sessions.length === 0) {
    body = `<div class="empty">Sessions coming soon.</div>`;
  } else {
    const tracks = [...new Set(data.sessions.map((session) => session.track?.name ?? "Unassigned track"))].sort();
    const formats = [...new Set(data.sessions.map((session) => session.format))].sort();
    const slotBySession = new Map(schedule.slots.map((slot) => [slot.session.id, slot]));
    const rooms = [...new Set(schedule.slots.map((slot) => slot.room?.name).filter((room): room is string => Boolean(room)))].sort();
    const items = data.sessions
      .map((session) => {
        const track = session.track?.name ?? "Unassigned track";
        const slot = slotBySession.get(session.id);
        const room = slot?.room?.name ?? "Room pending";
        const when = slot ? `${formatEmbedDay(slot.startsAt, schedule.timezone)} · ${formatEmbedTime(slot.startsAt, schedule.timezone)}-${formatEmbedTime(slot.endsAt, schedule.timezone)}` : "Time pending";
        const speakerSearch = session.speakers.map((speaker) => `${speaker.name} ${speaker.title ?? ""} ${options.showCompany ? speaker.company ?? "" : ""}`).join(" ");
        return `<article class="item" data-search="${escapeHtml(`${session.title} ${speakerSearch}`.toLowerCase())}" data-track="${escapeHtml(track)}" data-format="${escapeHtml(session.format)}" data-room="${escapeHtml(room)}">
  <p class="title">${escapeHtml(session.title)}</p>
  <div class="meta"><span class="pill" style="background:${safeCssColor(session.track?.color ?? null)}">${escapeHtml(track)}</span> · ${escapeHtml(session.format)} · ${escapeHtml(when)} · ${escapeHtml(room)} · ${session.speakers.map((speaker) => escapeHtml([speaker.name, speaker.title, options.showCompany ? speaker.company : null].filter(Boolean).join(", "))).join("; ") || "Speakers TBA"}</div>
  ${options.showDescription ? `<p class="abstract">${escapeHtml(session.abstract.slice(0, 180))}${session.abstract.length > 180 ? "…" : ""}</p>` : ""}
  ${options.showDescription && session.abstract.length > 180 ? `<details><summary>Show more</summary><p class="abstract">${escapeHtml(session.abstract)}</p></details>` : ""}
</article>`;
      }).join("");
    body = `<div class="controls"><input class="control" data-filter data-query type="search" placeholder="Search titles or speakers" aria-label="Search sessions" /><select class="control" data-filter data-track aria-label="Filter by track"><option value="">All tracks</option>${tracks.map((track) => `<option>${escapeHtml(track)}</option>`).join("")}</select><select class="control" data-filter data-format aria-label="Filter by format"><option value="">All formats</option>${formats.map((format) => `<option>${escapeHtml(format)}</option>`).join("")}</select><select class="control" data-filter data-room aria-label="Filter by room"><option value="">All rooms</option>${rooms.map((room) => `<option>${escapeHtml(room)}</option>`).join("")}</select></div><div class="count" data-count></div><section class="stack">${items}</section>`;
  }

  return embedDocument(
    `${data.event.name} sessions`,
    `<header class="header"><div class="eyebrow">Sessions</div><h1>${escapeHtml(data.event.name)}</h1><div class="subtle">Search and filter the full catalogue</div></header>${body}`,
    true,
    options.color,
  );
}

export function renderSpeakersEmbed(data: PublicSpeakersResponse, schedule: PublicScheduleResponse, gallery = false, options: EmbedOptions = { color: "#4338ca", track: null, showDescription: true, showCompany: true }): Response {
  const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
  const speakers = [...data.speakers].sort((a, b) => surname(a.name).localeCompare(surname(b.name)) || a.name.localeCompare(b.name));
  const items =
    speakers.length === 0
      ? `<div class="empty">Speakers coming soon.</div>`
      : speakers
          .map(
            (speaker) => {
              const sessions = schedule.slots.filter((slot) => slot.session.speakers.some((candidate) => candidate.id === speaker.id));
              return `<details class="item speaker" data-search="${escapeHtml(speaker.name.toLowerCase())}" data-track="" data-format="" data-room="">
  <summary class="speaker">
  ${
    speaker.headshotUrl
      ? `<img class="avatar" src="${escapeHtml(speaker.headshotUrl)}" alt="${escapeHtml(speaker.name)} headshot" loading="lazy" />`
      : `<span class="avatar avatar-initials" aria-hidden="true">${escapeHtml(embedInitials(speaker.name))}</span>`
  }
  <div class="speaker-body">
    <div class="speaker-name">${escapeHtml(speaker.name)}</div>
    <div class="meta">${escapeHtml([speaker.title, options.showCompany ? speaker.company : null].filter(Boolean).join(", ") || "Speaker")}${speaker.location ? ` · ${escapeHtml(speaker.location)}` : ""}</div>
  </div>
  </summary>
  <div class="detail">${options.showDescription ? (speaker.bio ? `<p class="abstract">${escapeHtml(speaker.bio)}</p>` : `<p class="abstract">Bio coming soon.</p>`) : ""}<div class="group">Sessions (${sessions.length})</div>${sessions.length ? sessions.map((slot) => `<div class="session-link"><div class="title">${escapeHtml(slot.session.title)}</div><div class="meta">${escapeHtml(formatEmbedDay(slot.startsAt, schedule.timezone))} · ${escapeHtml(formatEmbedTime(slot.startsAt, schedule.timezone))}-${escapeHtml(formatEmbedTime(slot.endsAt, schedule.timezone))} · ${escapeHtml(slot.room?.name ?? "Room pending")}</div></div>`).join("") : `<div class="subtle">No scheduled sessions.</div>`}</div>
</details>`;
            },
          )
          .join("");

  return embedDocument(
    `${data.event.name} ${gallery ? "speaker gallery" : "speakers"}`,
    `<header class="header"><div class="eyebrow">${gallery ? "Speaker gallery" : "Speakers"}</div><h1>${escapeHtml(data.event.name)}</h1></header><div class="controls"><input class="control" data-filter data-query type="search" placeholder="Search speakers" aria-label="Search speakers" /></div><div class="count" data-count></div><section class="${gallery ? "gallery" : "stack"}">${items}</section>`,
    true,
    options.color,
  );
}

export function renderItineraryEmbed(data: PublicScheduleResponse, options: EmbedOptions = { color: "#4338ca", track: null, showDescription: true, showCompany: true }): Response {
  const days = [...new Set(data.slots.map((slot) => formatEmbedDay(slot.startsAt, data.timezone)))];
  const cards = data.slots.map((slot) => `<article class="item" data-session-card>
    <div class="row"><p class="title">${escapeHtml(slot.session.title)}</p><button class="action" type="button" data-save-id="${escapeHtml(slot.session.id)}" aria-pressed="false">☆ Save</button></div>
    <div class="meta">${slot.session.track ? `<span class="pill" style="background:${safeCssColor(slot.session.track.color)}">${escapeHtml(slot.session.track.name)}</span> · ` : ""}${escapeHtml(formatEmbedDay(slot.startsAt, data.timezone))} · ${escapeHtml(formatEmbedTime(slot.startsAt, data.timezone))}-${escapeHtml(formatEmbedTime(slot.endsAt, data.timezone))} · ${escapeHtml(slot.room?.name ?? "Room pending")} · ${slot.session.speakers.map((speaker) => escapeHtml([speaker.name, speaker.title, speaker.company].filter(Boolean).join(", "))).join("; ")}</div>
    ${options.showDescription ? `<p class="abstract">${escapeHtml(slot.session.abstract)}</p>` : ""}
  </article>`).join("");
  const body = `<section data-itinerary="${escapeHtml(data.event.slug)}"><div class="controls"><label class="control"><input type="checkbox" data-personal /> My saved schedule only</label><a class="control" data-export hidden>Export saved .ics</a><button class="control" type="button" data-clear>Clear saved</button></div><div class="count" data-count></div><div class="subtle">${days.length} event day${days.length === 1 ? "" : "s"} · stored only in this browser</div><section class="stack" style="margin-top:12px">${cards}</section></section>`;
  return embedDocument(`${data.event.name} itinerary`, `<header class="header"><div class="eyebrow">Schedule itinerary</div><h1>${escapeHtml(data.event.name)}</h1></header>${body}`, true, options.color);
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
    service: "lectern",
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
  return c.json(filterSchedule(body, embedOptions(c).track));
});

api.get("/public/events/:slug/sessions", async (c) => {
  const body = await createRepo(c.env).getPublicSessions(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  return c.json(filterSessions(body, embedOptions(c).track));
});

api.get("/public/events/:slug/speakers", async (c) => {
  const repo = createRepo(c.env);
  const [body, schedule] = await Promise.all([repo.getPublicSpeakers(c.req.param("slug")), repo.getPublicSchedule(c.req.param("slug"))]);
  if (!body || !schedule) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  return c.json(filterSpeakers(body, schedule, options.track));
});

async function publicXmlResponse(c: Context<{ Bindings: Env }>, widget: string) {
  const repo = createRepo(c.env);
  const slug = c.req.param("slug") ?? "";
  const [schedule, sessions, speakers] = await Promise.all([
    repo.getPublicSchedule(slug),
    repo.getPublicSessions(slug),
    repo.getPublicSpeakers(slug),
  ]);
  if (!schedule || !sessions || !speakers) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  const xml = publicProgramXml(
    widget,
    filterSchedule(schedule, options.track),
    filterSessions(sessions, options.track),
    filterSpeakers(speakers, schedule, options.track),
  );
  if (!xml) return errorResponse(404, "widget_not_found", "Choose schedule, sessions, speakers, itinerary, or gallery.");
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=60" } });
}

api.get("/public/events/:slug/schedule.xml", (c) => publicXmlResponse(c, "schedule"));
api.get("/public/events/:slug/sessions.xml", (c) => publicXmlResponse(c, "sessions"));
api.get("/public/events/:slug/speakers.xml", (c) => publicXmlResponse(c, "speakers"));
api.get("/public/events/:slug/itinerary.xml", (c) => publicXmlResponse(c, "itinerary"));
api.get("/public/events/:slug/gallery.xml", (c) => publicXmlResponse(c, "gallery"));

api.get("/events/:slug/speakers", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const body: OrganizerSpeakersResponse = {
    event: {
      id: bundle.event.id, slug: bundle.event.slug, name: bundle.event.name,
      tagline: bundle.event.tagline, startsOn: bundle.event.startsOn,
      endsOn: bundle.event.endsOn, timezone: bundle.event.timezone,
    },
    speakers: await repo.getOrganizerSpeakers(bundle.event.id),
  };
  return c.json(body);
});

api.post("/events/:slug/speakers", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateOrganizerSpeakerRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Speaker is invalid.", parsed.error.issues);
  try {
    const speaker = await repo.createOrganizerSpeaker({
      ...parsed.data, id: randomId("spk"), eventId: bundle.event.id, now: new Date().toISOString(),
    });
    const body: OrganizerSpeakerMutationResponse = { speaker };
    return c.json(body, 201);
  } catch (caught) {
    if (caught instanceof Error && /UNIQUE constraint failed/.test(caught.message)) {
      return errorResponse(409, "speaker_exists", "A speaker with that email already exists for this event.");
    }
    throw caught;
  }
});

api.post("/events/:slug/speakers/import", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = ImportOrganizerSpeakersRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "CSV import is invalid.", parsed.error.issues);
  let rows;
  try { rows = parseSpeakerCsv(parsed.data.csv); }
  catch (caught) { return errorResponse(422, "csv_invalid", caught instanceof Error ? caught.message : "CSV is invalid."); }
  const body: ImportOrganizerSpeakersResponse = await repo.importOrganizerSpeakers({
    eventId: bundle.event.id,
    rows: rows.map((row) => ({ ...row, id: randomId("spk") })),
    now: new Date().toISOString(),
  });
  return c.json(body);
});

api.post("/events/:slug/speaker-tasks", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateSpeakerTaskRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Task is invalid.", parsed.error.issues);
  const speakerIds = [...new Set(parsed.data.speakerIds)];
  try {
    const body: CreateSpeakerTaskResponse = await repo.createSpeakerTask({
      definitionId: randomId("taskdef"), eventId: bundle.event.id,
      title: parsed.data.title, instructions: parsed.data.instructions, dueAt: parsed.data.dueAt,
      speakerIds, speakerTaskIds: speakerIds.map(() => randomId("task")), now: new Date().toISOString(),
    });
    return c.json(body, 201);
  } catch (caught) {
    if (caught instanceof Error && caught.message === "speaker_not_found") {
      return errorResponse(422, "speaker_not_found", "One or more selected speakers do not belong to this event.");
    }
    throw caught;
  }
});

api.post("/events/:slug/speaker-tasks/remind", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = BulkTaskReminderRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Reminder selection is invalid.", parsed.error.issues);
  const speakerIds = [...new Set(parsed.data.speakerIds)];
  const body: BulkTaskReminderResponse = await repo.sendBulkTaskReminders({
    eventId: bundle.event.id, speakerIds,
    messageIds: speakerIds.map(() => randomId("msg")), attemptIds: speakerIds.map(() => randomId("del")),
    now: new Date().toISOString(),
  });
  return c.json(body);
});

api.post("/events/:slug/communications/bulk", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = BulkCommunicationRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Bulk message is invalid.", parsed.error.issues);
  const selected = new Set(parsed.data.speakerIds);
  const recipients = (await repo.getOrganizerSpeakers(bundle.event.id)).filter((speaker) => selected.has(speaker.id));
  if (recipients.length !== selected.size) return errorResponse(422, "speaker_not_found", "One or more selected speakers do not belong to this event.");
  const now = new Date().toISOString();
  for (const speaker of recipients) {
    await repo.simulateCommunication({
      messageId: randomId("msg"), attemptId: randomId("del"), eventId: bundle.event.id,
      speakerId: speaker.id, toEmail: speaker.email, subject: parsed.data.subject,
      bodyMd: parsed.data.bodyMd, now,
    });
  }
  const body: BulkCommunicationResponse = { sent: recipients.length, recipientEmails: recipients.map((speaker) => speaker.email) };
  return c.json(body);
});

api.patch("/events/:slug/speakers/:speakerId", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = UpdateOrganizerSpeakerRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Speaker is invalid.", parsed.error.issues);
  try {
    const speaker = await repo.updateOrganizerSpeaker({
      ...parsed.data, id: c.req.param("speakerId"), eventId: bundle.event.id, now: new Date().toISOString(),
    });
    const body: OrganizerSpeakerMutationResponse = { speaker };
    return c.json(body);
  } catch (caught) {
    if (caught instanceof Error && caught.message === "speaker_not_found") {
      return errorResponse(404, "speaker_not_found", "No speaker with that id for this event.");
    }
    throw caught;
  }
});

api.get("/embeds/events/:slug/schedule", async (c) => {
  const body = await createRepo(c.env).getPublicSchedule(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  return renderScheduleEmbed(filterSchedule(body, options.track), options);
});

api.get("/embeds/events/:slug/sessions", async (c) => {
  const repo = createRepo(c.env);
  const [body, schedule] = await Promise.all([repo.getPublicSessions(c.req.param("slug")), repo.getPublicSchedule(c.req.param("slug"))]);
  if (!body || !schedule) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  return renderSessionsEmbed(filterSessions(body, options.track), filterSchedule(schedule, options.track), options);
});

api.get("/embeds/events/:slug/speakers", async (c) => {
  const repo = createRepo(c.env);
  const [body, schedule] = await Promise.all([repo.getPublicSpeakers(c.req.param("slug")), repo.getPublicSchedule(c.req.param("slug"))]);
  if (!body || !schedule) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  return renderSpeakersEmbed(filterSpeakers(body, schedule, options.track), filterSchedule(schedule, options.track), false, options);
});

api.get("/embeds/events/:slug/gallery", async (c) => {
  const repo = createRepo(c.env);
  const [body, schedule] = await Promise.all([repo.getPublicSpeakers(c.req.param("slug")), repo.getPublicSchedule(c.req.param("slug"))]);
  if (!body || !schedule) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  return renderSpeakersEmbed(filterSpeakers(body, schedule, options.track), filterSchedule(schedule, options.track), true, options);
});

api.get("/embeds/events/:slug/itinerary", async (c) => {
  const body = await createRepo(c.env).getPublicSchedule(c.req.param("slug"));
  if (!body) return errorResponse(404, "event_not_found", "No event with that slug.");
  const options = embedOptions(c);
  return renderItineraryEmbed(filterSchedule(body, options.track), options);
});

api.get("/docs", (c) =>
  c.json({
    name: "Lectern API",
    version: pkg.version,
    basePath: "/api",
    auth: {
      public: "Public event routes require no auth and never include speaker emails or organizer-only review data. Speaker and asset links are scoped capability URLs.",
      organizer: "Bearer passcode in the Authorization header.",
    },
    endpoints: [
      { method: "GET", path: "/health", auth: "public", purpose: "Worker, version, backend, D1/R2 checks." },
      { method: "GET", path: "/events", auth: "public", purpose: "List public events." },
      { method: "POST", path: "/events", auth: "organizer", purpose: "Create an event with a CFP and evaluation plan." },
      { method: "PATCH", path: "/events/:slug", auth: "organizer", purpose: "Update CFP open/close settings." },
      { method: "POST", path: "/events/:slug/tracks", auth: "organizer", purpose: "Create an event-scoped track." },
      { method: "POST", path: "/events/:slug/rooms", auth: "organizer", purpose: "Create an event-scoped agenda room." },
      { method: "POST", path: "/events/:slug/cfp/fields", auth: "organizer", purpose: "Add a validated CFP field and optional conditional rule." },
      { method: "GET", path: "/events/:slug", auth: "public", purpose: "Event bundle for event and CFP pages." },
      { method: "GET", path: "/public/events/:slug/schedule", auth: "public", purpose: "Iframe-safe schedule JSON." },
      { method: "GET", path: "/public/events/:slug/sessions", auth: "public", purpose: "Iframe-safe sessions JSON." },
      { method: "GET", path: "/public/events/:slug/speakers", auth: "public", purpose: "Iframe-safe speaker gallery JSON." },
      { method: "GET", path: "/public/events/:slug/:widget.xml", auth: "public", purpose: "Configured schedule, sessions, speakers, itinerary, or gallery XML feed." },
      { method: "GET", path: "/public/events/:slug/agenda.ics", auth: "public", purpose: "Whole published agenda as RFC 5545 calendar data." },
      { method: "GET", path: "/embeds/events/:slug/schedule", auth: "public", purpose: "Drop-in schedule iframe HTML." },
      { method: "GET", path: "/embeds/events/:slug/sessions", auth: "public", purpose: "Drop-in sessions iframe HTML." },
      { method: "GET", path: "/embeds/events/:slug/speakers", auth: "public", purpose: "Drop-in speaker gallery iframe HTML." },
      { method: "GET", path: "/embeds/events/:slug/gallery", auth: "public", purpose: "Searchable photo-grid speaker gallery with session drill-down." },
      { method: "GET", path: "/embeds/events/:slug/itinerary", auth: "public", purpose: "Anonymous personal itinerary iframe with persistence and calendar export." },
      { method: "POST", path: "/events/:slug/submissions", auth: "public", purpose: "Submit a CFP proposal." },
      { method: "GET", path: "/speaker-portal/:token", auth: "speaker link", purpose: "Speaker portal bundle; demo tokens currently map to seeded speaker ids." },
      { method: "PATCH", path: "/speaker-portal/:token/profile", auth: "speaker link", purpose: "Update the linked speaker's public profile." },
      { method: "PATCH", path: "/speaker-portal/:token/proposals/:submissionId", auth: "speaker link", purpose: "Edit the linked speaker's undecided proposal while its CFP is open." },
      { method: "PUT", path: "/speaker-portal/:token/tasks/:taskId", auth: "speaker link", purpose: "Complete or reopen a linked speaker task." },
      { method: "POST", path: "/speaker-portal/:token/assets", auth: "speaker link", purpose: "Upload the linked speaker's headshot, slides, or document to R2." },
      { method: "GET", path: "/events/:slug/submissions", auth: "organizer", purpose: "Organizer submissions list." },
      { method: "POST", path: "/events/:slug/speakers", auth: "organizer", purpose: "Add a speaker directly to the event roster." },
      { method: "POST", path: "/events/:slug/speakers/import", auth: "organizer", purpose: "Validate and upsert an event-scoped speaker CSV." },
      { method: "POST", path: "/events/:slug/speaker-tasks", auth: "organizer", purpose: "Create and assign a custom speaker deliverable." },
      { method: "POST", path: "/events/:slug/speaker-tasks/remind", auth: "organizer", purpose: "Record bulk reminders for selected incomplete speakers." },
      { method: "POST", path: "/events/:slug/communications/bulk", auth: "organizer", purpose: "Record a free-form bulk communication and per-recipient receipts." },
      { method: "GET", path: "/events/:slug/evaluations", auth: "organizer", purpose: "Round setup, reviewer progress, assignments, and weighted results." },
      { method: "POST", path: "/events/:slug/evaluations/rounds", auth: "organizer", purpose: "Create an evaluation round and its weighted scorecard." },
      { method: "PUT", path: "/events/:slug/evaluations/rounds/:roundId", auth: "organizer", purpose: "Update an evaluation round and its weighted scorecard." },
      { method: "PUT", path: "/events/:slug/evaluations/rounds/:roundId/reviewers", auth: "organizer", purpose: "Add or update a round reviewer and assignment cap." },
      { method: "PUT", path: "/events/:slug/evaluations/rounds/:roundId/assignments", auth: "organizer", purpose: "Replace one reviewer's exact assignments for a round." },
      { method: "POST", path: "/events/:slug/evaluations/rounds/:roundId/auto-distribute", auth: "organizer", purpose: "Round-robin unassigned proposals without exceeding reviewer caps." },
      { method: "POST", path: "/events/:slug/evaluations/rounds/:roundId/reviewers/:email/nudge", auth: "organizer", purpose: "Deliver or simulate a reviewer reminder and persist its receipt." },
      { method: "GET", path: "/events/:slug/evaluations.csv", auth: "organizer", purpose: "Export weighted review results with spreadsheet formula guarding." },
      { method: "GET", path: "/reviewer/:token", auth: "reviewer link", purpose: "Return only that reviewer's assigned proposals in open rounds; blind rounds omit speaker identity." },
      { method: "PUT", path: "/reviewer/:token/rounds/:roundId/submissions/:submissionId", auth: "reviewer link", purpose: "Submit or update the assigned proposal's scorecard, recommendation, and comments." },
      { method: "POST", path: "/reviewer/:token/rounds/:roundId/submissions/:submissionId/recuse", auth: "reviewer link", purpose: "Recuse from an assigned proposal and remove it from the actionable queue." },
      { method: "GET", path: "/reviewer/:token", auth: "reviewer link", purpose: "Reviewer-scoped queue containing only assigned submissions in open rounds." },
      { method: "GET", path: "/events/:slug/submissions.csv", auth: "organizer", purpose: "Submissions export as CSV (Excel-friendly)." },
      { method: "POST", path: "/events/:slug/submissions/:submissionId/feedback-draft", auth: "organizer", purpose: "Draft the decision email (acceptance, waitlist, or rejection) from the organizer's own reasoning; AI-assisted when a key is configured, deterministic template otherwise. Acceptances carry the speaker's portal link and onboarding checklist. Never auto-sends." },
      { method: "POST", path: "/events/:slug/submissions/:submissionId/decision", auth: "organizer", purpose: "Approve, waitlist, or deny a proposal; approval creates one idempotent session. An optional reasoning note is persisted as a committee review, filed under an optional reviewerName — one decider by default, named voices stack when a team weighs in." },
      { method: "POST", path: "/events/:slug/sessions/:sessionId/schedule-notice-draft", auth: "organizer", purpose: "Draft the email telling a slotted session's speakers their confirmed day, time, and room — AI-personalized from an organizer note, slot facts guaranteed verbatim. Never auto-sends." },
      { method: "GET", path: "/events/:slug/counts", auth: "organizer", purpose: "Organizer dashboard counts." },
      { method: "GET", path: "/airtable/status", auth: "organizer", purpose: "Airtable mirror connectivity, schema, mapped record counts, and last sync run." },
      { method: "POST", path: "/airtable/events/:slug/sync", auth: "organizer", purpose: "Idempotently mirror one event into Airtable; re-running updates in place. ?dedupe=1&prune=1 available." },
      { method: "GET", path: "/admin/ping", auth: "organizer", purpose: "Passcode verification (204)." },
      { method: "GET", path: "/admin/ai-usage", auth: "organizer", purpose: "Provider-reported AI usage events for the reimbursement audit." },
      { method: "GET", path: "/events/:slug/agenda", auth: "organizer", purpose: "Sessions, placements, and computed room/speaker conflicts." },
      { method: "POST", path: "/events/:slug/agenda/publish", auth: "organizer", purpose: "Publish the reviewed agenda with a durable receipt." },
      { method: "POST", path: "/events/:slug/sessions", auth: "organizer", purpose: "Add an invited or sponsor session directly, without a submission." },
      { method: "PATCH", path: "/events/:slug/sessions/:sessionId", auth: "organizer", purpose: "Retitle or reword a session in the published program; the source submission keeps what the speaker pitched." },
      { method: "GET", path: "/events/:slug/sessions/:sessionId/versions", auth: "organizer", purpose: "List restorable session-content versions." },
      { method: "POST", path: "/events/:slug/sessions/:sessionId/versions/:versionId/restore", auth: "organizer", purpose: "Restore an earlier session-content version without losing the replaced copy." },
      { method: "PATCH", path: "/events/:slug/sessions/:sessionId/content-approval", auth: "organizer", purpose: "Approve or return content and gate public program visibility." },
      { method: "PUT", path: "/events/:slug/sessions/:sessionId/slot", auth: "organizer", purpose: "Create or move a session placement and recompute conflicts." },
      { method: "GET", path: "/events/:slug/communications/preview", auth: "organizer", purpose: "Render a task reminder or session-update email preview." },
      { method: "GET", path: "/events/:slug/communications", auth: "organizer", purpose: "List persistent simulated and real delivery receipts for the event outbox." },
      { method: "POST", path: "/events/:slug/communications/simulate", auth: "organizer", purpose: "Deliver through the configured transport and persist the provider receipt; simulated by default." },
      { method: "POST", path: "/events/:slug/assets/download.zip", auth: "organizer", purpose: "Download selected current speaker files as a valid ZIP." },
      { method: "POST", path: "/events/:slug/assets/:assetId/comments", auth: "organizer", purpose: "Add a durable organizer comment to a speaker file." },
      { method: "GET", path: "/public/events/:slug/sessions/:sessionId/calendar.ics", auth: "public", purpose: "Download a scheduled session as an RFC 5545 calendar file." },
      { method: "GET", path: "/public/events/:slug/itinerary.ics?sessions=id,id", auth: "public", purpose: "Export an attendee's selected scheduled sessions as one RFC 5545 calendar." },
      { method: "POST", path: "/speakers/:speakerId/assets", auth: "organizer", purpose: "Upload a speaker asset to R2." },
      { method: "GET", path: "/assets/:assetId", auth: "asset link", purpose: "Stream a stored asset." },
    ],
    embeds: {
      schedule:
        '<iframe src="/api/embeds/events/horizon-2026/schedule" title="Horizon Dev Summit schedule" width="100%" height="640" loading="lazy"></iframe>',
      sessions:
        '<iframe src="/api/embeds/events/horizon-2026/sessions" title="Horizon Dev Summit sessions" width="100%" height="640" loading="lazy"></iframe>',
      speakers:
        '<iframe src="/api/embeds/events/horizon-2026/speakers" title="Horizon Dev Summit speakers" width="100%" height="640" loading="lazy"></iframe>',
      gallery:
        '<iframe src="/api/embeds/events/horizon-2026/gallery" title="Horizon Dev Summit speaker gallery" width="100%" height="640" loading="lazy"></iframe>',
      itinerary:
        '<iframe src="/api/embeds/events/horizon-2026/itinerary" title="Horizon Dev Summit itinerary" width="100%" height="640" loading="lazy"></iframe>',
    },
  }),
);

// ---------------------------------------------------------------------------
// Public: CFP submission (the write half of the golden path)
// ---------------------------------------------------------------------------

api.post("/events/:slug/drafts", async (c) => saveCfpDraft(c, randomId("draft")));

api.put("/events/:slug/drafts/:token", async (c) => {
  const token = c.req.param("token").trim();
  if (!token) return errorResponse(404, "draft_not_found", "No proposal draft with that link.");
  return saveCfpDraft(c, token);
});

api.get("/events/:slug/drafts/:token", async (c) => {
  const slug = c.req.param("slug");
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(slug);
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const draft = await repo.getCfpDraft(bundle.event.id, token);
  if (!draft) return errorResponse(404, "draft_not_found", "No proposal draft with that link.");
  const body: CfpDraftResponse = {
    ...draft,
    resumeUrl: `/e/${encodeURIComponent(slug)}/cfp?draft=${encodeURIComponent(token)}`,
  };
  return c.json(body);
});

api.post("/events/:slug/submissions", async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug") ?? "");
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
    coSpeakers: data.coSpeakers.map((speaker) => ({ ...speaker, id: randomId("spk") })),
    speakerId: randomId("spk"),
    submissionId: randomId("sub"),
    now,
  });

  const primary = submission.speakers[0];
  if (primary) {
    await repo.simulateCommunication({
      messageId: randomId("msg"),
      attemptId: randomId("del"),
      eventId: bundle.event.id,
      speakerId: primary.speakerId,
      toEmail: primary.email,
      subject: `Proposal received: ${submission.title}`,
      bodyMd: `Hi ${primary.name},\n\nWe received “${submission.title}” for ${bundle.event.name}.\n\nTrack its status and make edits from your speaker portal.`,
      now,
    });
  }

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

api.patch("/speaker-portal/:token/proposals/:submissionId", async (c) => {
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  const portal = await repo.getSpeakerPortalByToken(token);
  if (!portal) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");

  const proposal = portal.proposals.find((item) => item.id === c.req.param("submissionId"));
  if (!proposal) {
    return errorResponse(404, "submission_not_found", "No proposal with that id belongs to this speaker.");
  }
  const now = new Date().toISOString();
  if (!portal.cfp || !canEditSpeakerProposal(portal.cfp.form, proposal.status, now)) {
    const message = portal.cfp
      ? speakerProposalLockReason(portal.cfp.form, proposal.status, now) ?? "Editing is locked."
      : "Editing is locked because this call for speakers is unavailable.";
    return errorResponse(409, "submission_locked", message);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = UpdateSpeakerProposalRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Proposal is invalid.", parsed.error.issues);
  }
  const ctx = { format: proposal.format, answers: parsed.data.answers };
  const missing = missingRequiredFields(portal.cfp.fields, portal.cfp.rules, ctx);
  if (missing.length > 0) {
    return errorResponse(
      422,
      "validation_error",
      `Missing required field(s): ${missing.map((field) => field.label).join(", ")}.`,
      missing.map((field) => ({ path: ["answers", field.key], message: "Required" })),
    );
  }

  const body: SpeakerPortalResponse = await repo.updateSpeakerProposal({
    speakerId: portal.speaker.id,
    submissionId: proposal.id,
    title: parsed.data.title,
    abstract: parsed.data.abstract,
    answers: pruneAnswers(portal.cfp.fields, portal.cfp.rules, ctx),
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

api.post("/speaker-portal/:token/assets/:assetId/comments", async (c) => {
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  const portal = await repo.getSpeakerPortalByToken(token);
  if (!portal) return errorResponse(404, "portal_not_found", "No speaker portal for that link.");
  if (!portal.assets.some((asset) => asset.id === c.req.param("assetId"))) {
    return errorResponse(404, "asset_not_found", "No file with that id for this speaker.");
  }
  let raw: unknown;
  try { raw = await c.req.json(); }
  catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateAssetCommentRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Comment is invalid.", parsed.error.issues);
  await repo.createAssetComment({
    id: randomId("acomment"), assetId: c.req.param("assetId"),
    authorRole: "speaker", authorName: portal.speaker.name,
    body: parsed.data.body, now: new Date().toISOString(),
  });
  const body: SpeakerPortalResponse = (await repo.getSpeakerPortalByToken(token))!;
  return c.json(body, 201);
});

// ---------------------------------------------------------------------------
// Reviewer capability queue
// ---------------------------------------------------------------------------

api.get("/reviewer/:token", async (c) => {
  const queue = await createRepo(c.env).getReviewerQueue(c.req.param("token").trim());
  if (!queue) return errorResponse(404, "reviewer_not_found", "No reviewer queue for that link.");
  return c.json(queue);
});

api.put("/reviewer/:token/rounds/:roundId/submissions/:submissionId", async (c) => {
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  const queue = await repo.getReviewerQueue(token);
  if (!queue) return errorResponse(404, "reviewer_not_found", "No reviewer queue for that link.");
  const assignment = queue.assignments.find((item) =>
    item.roundId === c.req.param("roundId") && item.id === c.req.param("submissionId"));
  if (!assignment) return errorResponse(404, "assignment_not_found", "That submission is not assigned to this reviewer.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = SubmitReviewRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Scorecard is invalid.", parsed.error.issues);
  const invalid = assignment.criteria.find((criterion) => {
    const score = parsed.data.scores[criterion.key];
    return typeof score !== "number" || score < 1 || score > criterion.maxScore;
  });
  if (invalid) {
    return errorResponse(422, "validation_error", `${invalid.label} must be scored from 1 to ${invalid.maxScore}.`);
  }
  await repo.submitReviewerScorecard({
    id: randomId("rev"), token, roundId: assignment.roundId, submissionId: assignment.id,
    ...parsed.data, now: new Date().toISOString(),
  });
  const body: ReviewerQueueResponse | null = await repo.getReviewerQueue(token);
  return c.json(body);
});

api.post("/reviewer/:token/rounds/:roundId/submissions/:submissionId/recuse", async (c) => {
  const token = c.req.param("token").trim();
  const repo = createRepo(c.env);
  await repo.submitReviewerScorecard({
    id: randomId("rev"), token, roundId: c.req.param("roundId"),
    submissionId: c.req.param("submissionId"), scores: {}, recommendation: "accept",
    comment: "Reviewer recused due to a conflict of interest.", recuse: true,
    now: new Date().toISOString(),
  });
  const body = await repo.getReviewerQueue(token);
  return c.json(body);
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

api.get("/events/:slug/evaluations", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  try {
    const body: EvaluationWorkspaceResponse = await repo.getEvaluationWorkspace(bundle.event.id);
    return c.json(body);
  } catch (error) {
    if (error instanceof Error && error.message === "evaluation_plan_not_found") {
      return errorResponse(409, "evaluation_plan_not_found", "This event has no evaluation plan yet.");
    }
    throw error;
  }
});

api.post("/events", organizerAuth, async (c) => {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateEventRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Event is invalid.", parsed.error.issues);
  if (parsed.data.endsOn < parsed.data.startsOn) return errorResponse(422, "validation_error", "Event end date must not be before its start date.");
  try {
    const event = await createRepo(c.env).createEvent({ ...parsed.data, eventId: randomId("evt"), formId: randomId("form"), planId: randomId("plan"), now: new Date().toISOString() });
    return c.json(event, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return errorResponse(409, "slug_taken", "That event slug is already in use.");
    throw error;
  }
});

api.patch("/events/:slug", organizerAuth, async (c) => {
  const repo = createRepo(c.env); const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown; try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = UpdateEventSettingsRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Event settings are invalid.", parsed.error.issues);
  return c.json(await repo.updateEventSettings({ eventId: bundle.event.id, ...parsed.data, now: new Date().toISOString() }));
});

api.post("/events/:slug/tracks", organizerAuth, async (c) => {
  const repo = createRepo(c.env); const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown; try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateTrackRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Track is invalid.", parsed.error.issues);
  return c.json(await repo.createTrack({ id: randomId("track"), eventId: bundle.event.id, ...parsed.data }), 201);
});

api.post("/events/:slug/rooms", organizerAuth, async (c) => {
  const repo = createRepo(c.env); const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown; try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateRoomRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Room is invalid.", parsed.error.issues);
  return c.json(await repo.createRoom({ id: randomId("room"), eventId: bundle.event.id, ...parsed.data }), 201);
});

api.post("/events/:slug/cfp/fields", organizerAuth, async (c) => {
  const repo = createRepo(c.env); const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  if (!bundle.cfp) return errorResponse(409, "cfp_unavailable", "This event has no call for speakers.");
  let raw: unknown; try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateFormFieldRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Form field is invalid.", parsed.error.issues);
  if (bundle.cfp.fields.some((field) => field.key === parsed.data.key)) return errorResponse(409, "field_key_taken", "That field key already exists.");
  if (parsed.data.fieldType === "select" && (!parsed.data.options || parsed.data.options.length < 2)) return errorResponse(422, "validation_error", "Select fields need at least two options.");
  const source = parsed.data.condition?.sourceFieldKey;
  if (source && source !== "format" && !bundle.cfp.fields.some((field) => field.key === source)) return errorResponse(422, "validation_error", "Conditional source field is unknown.");
  return c.json(await repo.createFormField({ id: randomId("field"), ruleId: parsed.data.condition ? randomId("rule") : null, eventId: bundle.event.id, formId: bundle.cfp.form.id, ...parsed.data }), 201);
});

api.get("/events/:slug/evaluations.csv", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const workspace = await repo.getEvaluationWorkspace(bundle.event.id);
  return new Response(reviewResultsToCsv(workspace), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="review-results-${bundle.event.slug}.csv"`,
      "cache-control": "no-store",
    },
  });
});

async function saveRound(c: Context<{ Bindings: Env }>): Promise<Response> {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug") ?? "");
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = SaveEvaluationRoundRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Round is invalid.", parsed.error.issues);
  const workspace = await repo.getEvaluationWorkspace(bundle.event.id);
  const roundId = c.req.param("roundId") || randomId("round");
  await repo.saveEvaluationRound({
    eventId: bundle.event.id, planId: workspace.plan.id, roundId, data: parsed.data,
    criterionIds: parsed.data.criteria.map(() => randomId("crit")),
  });
  return c.json(await repo.getEvaluationWorkspace(bundle.event.id), c.req.param("roundId") ? 200 : 201);
}

api.post("/events/:slug/evaluations/rounds", organizerAuth, saveRound);
api.put("/events/:slug/evaluations/rounds/:roundId", organizerAuth, saveRound);

api.put("/events/:slug/evaluations/rounds/:roundId/reviewers", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = SaveRoundReviewerRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Reviewer is invalid.", parsed.error.issues);
  await repo.saveRoundReviewer({
    roundId: c.req.param("roundId"), ...parsed.data, token: randomId("reviewer"),
    now: new Date().toISOString(),
  });
  return c.json(await repo.getEvaluationWorkspace(bundle.event.id));
});

api.put("/events/:slug/evaluations/rounds/:roundId/assignments", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = SaveAssignmentsRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Assignments are invalid.", parsed.error.issues);
  try {
    await repo.saveAssignments({ roundId: c.req.param("roundId"), ...parsed.data, now: new Date().toISOString() });
  } catch (error) {
    if (error instanceof Error && error.message === "assignment_cap_exceeded") {
      return errorResponse(422, "assignment_cap_exceeded", "Selection exceeds this reviewer's assignment cap.");
    }
    throw error;
  }
  return c.json(await repo.getEvaluationWorkspace(bundle.event.id));
});

api.post("/events/:slug/evaluations/rounds/:roundId/auto-distribute", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  await repo.autoDistributeAssignments(c.req.param("roundId"), new Date().toISOString());
  return c.json(await repo.getEvaluationWorkspace(bundle.event.id));
});

api.post("/events/:slug/evaluations/rounds/:roundId/reviewers/:email/nudge", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const workspace = await repo.getEvaluationWorkspace(bundle.event.id);
  const round = workspace.rounds.find((item) => item.id === c.req.param("roundId"));
  const reviewer = round?.reviewers.find((item) => item.email === decodeURIComponent(c.req.param("email")));
  if (!reviewer) return errorResponse(404, "reviewer_not_found", "No reviewer with that email in this round.");
  const now = new Date().toISOString();
  const messageId = randomId("msg");
  const delivery = await repo.simulateCommunication({
    messageId, attemptId: randomId("del"), eventId: bundle.event.id, speakerId: null,
    toEmail: reviewer.email, subject: `${round!.name}: ${reviewer.assigned - reviewer.complete} review(s) outstanding`,
    bodyMd: `Hi ${reviewer.name},\n\nPlease complete your assigned reviews for ${bundle.event.name}.\n\nReviewer queue: ${new URL(c.req.url).origin}/review/${reviewer.token}`,
    now,
  });
  const body: SimulateCommunicationResponse = {
    messageId,
    status: delivery.messageStatus,
    mode: delivery.mode,
    deliveredAt: delivery.status === "success" ? now : null,
    providerId: delivery.providerId,
    error: delivery.error,
  };
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
      reasoning: parsed.data.reasoning,
      reviewerName: parsed.data.reviewerName,
      sessionTitle: parsed.data.sessionTitle,
      sessionAbstract: parsed.data.sessionAbstract,
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

  // Acceptances carry the speaker's portal link and the exact onboarding
  // checklist the system will derive at commit time — same table the
  // acceptance batch reads, so the email can never promise a different list.
  let portalUrl: string | undefined;
  let onboardingTasks: string[] | undefined;
  if (parsed.data.decision === "approve") {
    portalUrl = primary ? `${new URL(c.req.url).origin}/speaker/${primary.speakerId}` : undefined;
    const taskRows = await c.env.DB.prepare(
      `SELECT label FROM task_definitions
       WHERE event_id = ?1 AND applies_to = 'accepted_speakers'
       ORDER BY sort_order, label`,
    )
      .bind(bundle.event.id)
      .all<{ label: string }>();
    onboardingTasks = (taskRows.results ?? []).map((row) => row.label);
  }

  const draft = await draftDecisionFeedback(
    {
      eventName: bundle.event.name,
      speakerName: primary?.name ?? "there",
      talkTitle: submission.title,
      talkAbstract: submission.abstract,
      decision: parsed.data.decision,
      reasoning: parsed.data.reasoning,
      portalUrl,
      onboardingTasks,
    },
    runtimeAiConfig(c.env),
  );

  await recordAiUsageEvent(c.env, "decision_feedback_draft", draft.providerEvidence);

  const { providerEvidence: _privateProviderEvidence, ...publicDraft } = draft;
  const body: FeedbackDraftResponse = publicDraft;
  return c.json(body);
});

/** Provider-reported usage into the tamper-evident reimbursement ledger. */
async function recordAiUsageEvent(
  env: Env,
  purpose: string,
  evidence: ProviderEvidence | undefined,
): Promise<void> {
  if (!evidence) return;
  const occurredAt = new Date().toISOString();
  const canonical = JSON.stringify({
    provider: "anthropic",
    requestId: evidence.requestId,
    model: evidence.model,
    purpose,
    usage: evidence.usage,
  });
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const evidenceSha256 = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const usage = evidence.usage;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO ai_usage_events (
       id, provider, provider_request_id, model, purpose, occurred_at,
       input_tokens, cache_creation_input_tokens, cache_creation_5m_input_tokens,
       cache_creation_1h_input_tokens, cache_read_input_tokens, output_tokens,
       evidence_sha256, measurement
     ) VALUES (?1, 'anthropic', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'provider_reported')`,
  ).bind(
    randomId("aiu"),
    evidence.requestId,
    evidence.model,
    purpose,
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

/**
 * Draft the schedule notice for a slotted session's speakers. Deliberate,
 * never fired by dragging: the organizer asks, reviews, edits, and sends.
 * Slot facts are formatted server-side in the event timezone and guaranteed
 * into the draft whatever the model does.
 */
api.post("/events/:slug/sessions/:sessionId/schedule-notice-draft", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = ScheduleNoticeDraftRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Schedule notice request is invalid.", parsed.error.issues);
  }

  const sessionId = c.req.param("sessionId");
  const sessionRow = await c.env.DB.prepare(
    "SELECT id, event_id, title FROM sessions WHERE id = ?1",
  )
    .bind(sessionId)
    .first<{ id: string; event_id: string; title: string }>();
  if (!sessionRow || sessionRow.event_id !== bundle.event.id) {
    return errorResponse(404, "session_not_found", "No session with that id for this event.");
  }

  const slot = await c.env.DB.prepare(
    "SELECT room_id, starts_at, ends_at FROM agenda_slots WHERE session_id = ?1",
  )
    .bind(sessionId)
    .first<{ room_id: string | null; starts_at: string; ends_at: string }>();
  if (!slot) {
    return errorResponse(
      409,
      "session_not_scheduled",
      "Place the session on the agenda first — a schedule notice needs a confirmed slot.",
    );
  }

  const speakersRes = await c.env.DB.prepare(
    `SELECT sp.id, sp.name, sp.email
     FROM session_speakers ss
     JOIN speakers sp ON sp.id = ss.speaker_id
     WHERE ss.session_id = ?1
     ORDER BY ss.sort_order`,
  )
    .bind(sessionId)
    .all<{ id: string; name: string; email: string }>();
  const recipients = (speakersRes.results ?? []).map((row) => ({
    speakerId: row.id,
    name: row.name,
    email: row.email,
  }));
  if (recipients.length === 0) {
    return errorResponse(409, "no_speakers", "Attach a speaker to the session before sending a notice.");
  }

  const origin = new URL(c.req.url).origin;
  const room = slot.room_id ? bundle.rooms.find((candidate) => candidate.id === slot.room_id) : undefined;
  const slotSummary = formatSlotWindow(slot.starts_at, slot.ends_at, bundle.event.timezone);
  const scheduleUrl = `${origin}/e/${encodeURIComponent(bundle.event.slug)}`;
  const icsUrl = `${origin}/api/public/events/${encodeURIComponent(bundle.event.slug)}/sessions/${encodeURIComponent(sessionId)}/calendar.ics`;

  const draft = await draftScheduleNotice(
    {
      eventName: bundle.event.name,
      talkTitle: sessionRow.title,
      speakerNames: recipients.map((recipient) => recipient.name),
      slotSummary,
      roomName: room?.name ?? null,
      scheduleUrl,
      icsUrl,
      note: parsed.data.note,
    },
    runtimeAiConfig(c.env),
  );

  await recordAiUsageEvent(c.env, "schedule_notice_draft", draft.providerEvidence);

  const { providerEvidence: _privateEvidence, ...publicDraft } = draft;
  const body: ScheduleNoticeDraftResponse = {
    ...publicDraft,
    slotSummary,
    scheduleUrl,
    icsUrl,
    recipients,
  };
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

api.post("/events/:slug/agenda/publish", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const slug = c.req.param("slug");
  const bundle = await repo.getEventBySlug(slug);
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const agendaPublishedAt = await repo.publishAgenda(bundle.event.id, new Date().toISOString());
  const body: PublishAgendaResponse = {
    agendaPublishedAt,
    publicScheduleUrl: `/e/${encodeURIComponent(slug)}#schedule`,
  };
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

/**
 * Retitle or reword a session in the published program. The submission is
 * untouched, so the record always shows both what the speaker pitched and
 * what the program calls it.
 */
api.patch("/events/:slug/sessions/:sessionId", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return errorResponse(400, "bad_json", "Request body must be JSON.");
  }
  const parsed = UpdateSessionRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Session details are invalid.", parsed.error.issues);
  }

  try {
    const session = await repo.updateSession({
      sessionId: c.req.param("sessionId"),
      eventId: bundle.event.id,
      title: parsed.data.title,
      abstract: parsed.data.abstract,
      now: new Date().toISOString(),
    });
    return c.json({ session });
  } catch (error) {
    if (error instanceof Error && error.message === "session_not_found") {
      return errorResponse(404, "session_not_found", "No session with that id for this event.");
    }
    throw error;
  }
});

api.get("/events/:slug/sessions/:sessionId/versions", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  try {
    const body: SessionVersionsResponse = {
      versions: await repo.listSessionVersions(bundle.event.id, c.req.param("sessionId")),
    };
    return c.json(body);
  } catch (error) {
    if (error instanceof Error && error.message === "session_not_found") {
      return errorResponse(404, "session_not_found", "No session with that id for this event.");
    }
    throw error;
  }
});

api.post("/events/:slug/sessions/:sessionId/versions/:versionId/restore", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  try {
    const session = await repo.restoreSessionVersion({
      eventId: bundle.event.id,
      sessionId: c.req.param("sessionId"),
      versionId: c.req.param("versionId"),
      snapshotId: randomId("sver"),
      now: new Date().toISOString(),
    });
    return c.json({ session });
  } catch (error) {
    if (error instanceof Error && error.message === "session_not_found") {
      return errorResponse(404, "session_not_found", "No session with that id for this event.");
    }
    if (error instanceof Error && error.message === "version_not_found") {
      return errorResponse(404, "version_not_found", "No saved version with that id for this session.");
    }
    throw error;
  }
});

api.patch("/events/:slug/sessions/:sessionId/content-approval", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); }
  catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = SessionContentApprovalRequest.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(422, "validation_error", "Content approval status is invalid.", parsed.error.issues);
  }
  try {
    const session = await repo.updateSessionContentApproval({
      eventId: bundle.event.id,
      sessionId: c.req.param("sessionId"),
      status: parsed.data.status,
      now: new Date().toISOString(),
    });
    return c.json({ session });
  } catch (error) {
    if (error instanceof Error && error.message === "session_not_found") {
      return errorResponse(404, "session_not_found", "No session with that id for this event.");
    }
    throw error;
  }
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

api.get("/events/:slug/communications", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const body: OutboxResponse = { messages: await repo.listMessages(bundle.event.id) };
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
  const delivery = await repo.simulateCommunication({
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
    status: delivery.messageStatus,
    mode: delivery.mode,
    deliveredAt: delivery.status === "success" ? now : null,
    providerId: delivery.providerId,
    error: delivery.error,
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
    uid: `${slot.session.id}@lectern`,
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

api.get("/public/events/:slug/agenda.ics", async (c) => {
  const loaded = await createRepo(c.env).getPublicSchedule(c.req.param("slug"));
  if (!loaded) return errorResponse(404, "event_not_found", "No event with that slug.");
  const schedule = filterSchedule(loaded, embedOptions(c).track);
  const generatedAt = new Date().toISOString();
  const calendar = buildCalendarCollection(schedule.slots.map((slot) => ({
    uid: `${slot.session.id}@lectern`,
    eventName: schedule.event.name,
    sessionTitle: slot.session.title,
    description: slot.session.abstract,
    location: slot.room?.name ?? "Room pending",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    generatedAt,
  })));
  return new Response(calendar, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${schedule.event.slug}-agenda.ics"`,
      "cache-control": "public, max-age=60",
    },
  });
});

api.get("/public/events/:slug/itinerary.ics", async (c) => {
  const schedule = await createRepo(c.env).getPublicSchedule(c.req.param("slug"));
  if (!schedule) return errorResponse(404, "event_not_found", "No event with that slug.");
  const requested = (c.req.query("sessions") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (requested.length === 0 || requested.length > 50) {
    return errorResponse(422, "validation_error", "Choose between 1 and 50 session ids.");
  }
  const selected = schedule.slots.filter((slot) => requested.includes(slot.session.id));
  if (selected.length !== new Set(requested).size) {
    return errorResponse(404, "session_not_found", "One or more selected sessions are not scheduled for this event.");
  }
  const generatedAt = new Date().toISOString();
  const calendar = buildCalendarCollection(selected.map((slot) => ({
    uid: `${slot.session.id}@lectern`,
    eventName: schedule.event.name,
    sessionTitle: slot.session.title,
    description: slot.session.abstract,
    location: slot.room?.name ?? "Room pending",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    generatedAt,
  })));
  return new Response(calendar, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${schedule.event.slug}-my-itinerary.ics"`,
      "cache-control": "private, no-store",
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

api.post("/events/:slug/assets/download.zip", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  let raw: unknown;
  try { raw = await c.req.json(); }
  catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = BulkAssetDownloadRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Choose between 1 and 50 files.", parsed.error.issues);
  const ids = [...new Set(parsed.data.assetIds)];
  const records: Array<{ asset: SpeakerAsset; speaker: Speaker }> = [];
  for (const id of ids) {
    const asset = await repo.getSpeakerAssetById(id);
    if (!asset) return errorResponse(404, "asset_not_found", "One or more selected files do not belong to this event.");
    const speaker = await repo.getSpeakerById(asset.speakerId);
    if (!speaker || speaker.eventId !== bundle.event.id) return errorResponse(404, "asset_not_found", "One or more selected files do not belong to this event.");
    records.push({ asset, speaker });
  }
  const totalBytes = records.reduce((sum, record) => sum + record.asset.sizeBytes, 0);
  if (totalBytes > 50 * 1024 * 1024) return errorResponse(413, "archive_too_large", "Select at most 50 MB of files per ZIP.");

  const files: Array<{ name: string; data: Uint8Array; modifiedAt: Date }> = [];
  for (const [index, { asset, speaker }] of records.entries()) {
    const object = await c.env.BUCKET.get(asset.r2Key);
    if (!object) return errorResponse(404, "object_missing", "One or more selected file objects are unavailable.");
    const safeSpeaker = speaker.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || speaker.id;
    const safeFile = asset.filename.replace(/[^A-Za-z0-9._-]+/g, "_") || `file-${index + 1}`;
    files.push({
      name: `${safeSpeaker}/v${asset.versionNumber}-${safeFile}`,
      data: new Uint8Array(await object.arrayBuffer()),
      modifiedAt: new Date(asset.uploadedAt),
    });
  }
  const archive = buildStoreZip(files);
  return new Response(archive, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(archive.byteLength),
      "content-disposition": `attachment; filename="${bundle.event.slug}-speaker-files.zip"`,
      "cache-control": "no-store",
    },
  });
});

api.post("/events/:slug/assets/:assetId/comments", organizerAuth, async (c) => {
  const repo = createRepo(c.env);
  const bundle = await repo.getEventBySlug(c.req.param("slug"));
  if (!bundle) return errorResponse(404, "event_not_found", "No event with that slug.");
  const asset = await repo.getSpeakerAssetById(c.req.param("assetId"));
  const speaker = asset ? await repo.getSpeakerById(asset.speakerId) : null;
  if (!asset || !speaker || speaker.eventId !== bundle.event.id) {
    return errorResponse(404, "asset_not_found", "No file with that id for this event.");
  }
  let raw: unknown;
  try { raw = await c.req.json(); }
  catch { return errorResponse(400, "bad_json", "Request body must be JSON."); }
  const parsed = CreateAssetCommentRequest.safeParse(raw);
  if (!parsed.success) return errorResponse(422, "validation_error", "Comment is invalid.", parsed.error.issues);
  const body: AssetCommentResponse = { comment: await repo.createAssetComment({
    id: randomId("acomment"), assetId: asset.id,
    authorRole: "organizer", authorName: "Event team",
    body: parsed.data.body, now: new Date().toISOString(),
  }) };
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
