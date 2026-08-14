import type {
  AgendaSlot,
  AssetComment,
  ConditionalRule,
  Event,
  EventBundle,
  EventCounts,
  EventSummary,
  EvaluationWorkspaceResponse,
  Form,
  FormField,
  OrganizerAgendaResponse,
  OrganizerSpeakersResponse,
  OrganizerSession,
  PublicScheduleResponse,
  PublicSession,
  PublicSessionsResponse,
  PublicSessionSpeaker,
  PublicSpeaker,
  PortalFormSummary,
  PublicSpeakersResponse,
  ResourcePage,
  Room,
  Session,
  SessionVersion,
  Speaker,
  SpeakerAsset,
  SpeakerTask,
  SpeakerPortalProposal,
  ReviewerQueueResponse,
  OutboxMessage,
  SubmissionListItem,
  SubmissionReviewView,
  SubmissionSpeakerView,
  SubmissionStatus,
  TaskDefinition,
  Track,
  CfpDraftRequest as CfpDraftRequestType,
} from "../../../shared/contracts";
import { CfpDraftRequest } from "../../../shared/contracts";
import type {
  CreateCfpFormInput,
  CreateDirectSessionInput,
  CreateCfpSubmissionInput,
  CreateSpeakerAssetInput,
  DecideSubmissionInput,
  SpeakerPortalBundle,
  SpeakerPortalSession,
  LecternRepo,
  SimulateCommunicationInput,
  SubmissionDecisionResult,
  UpdateSessionInput,
  RestoreSessionVersionInput,
  UpdateSessionContentApprovalInput,
  UpsertAgendaSlotInput,
  UpdateSpeakerProfileInput,
  UpdateSpeakerTaskInput,
  UpdateSpeakerProposalInput,
  SaveEvaluationRoundInput,
  SaveRoundReviewerInput,
  SaveAssignmentsInput,
  SubmitReviewerScorecardInput,
  SubmitTaskFormInput,
  CreateEventInput,
  UpdateEventSettingsInput,
  CreateTrackInput,
  CreatePortalFormInput,
  CreateRoomInput,
  CreateFormFieldInput,
  SaveCfpDraftInput,
  CreateOrganizerSpeakerInput,
  UpdateOrganizerSpeakerInput,
  ImportOrganizerSpeakersInput,
  CreateSpeakerTaskInput,
  BulkTaskReminderInput,
  CreateAssetCommentInput,
  NotifySubmissionAdminsInput,
  NotifySubmissionAdminsResult,
  QueueDraftCloseRemindersResult,
} from "../types";
import { randomId } from "../../../shared/ids";
import { buildDirectSession, buildSessionFromSubmission } from "../../../shared/domain/acceptance";
import { shouldRemindDraft } from "../../../shared/domain/draftReminders";
import { canApplyDecision, reviewerIdentity, statusForDecision } from "../../../shared/domain/decisions";
import { findScheduleConflicts } from "../../../shared/domain/schedule";
import { summarizeReviewScores } from "../../../shared/domain/reviews";
import { createEmailDelivery, type EmailDelivery } from "../../integrations/emailDelivery";

// ---------------------------------------------------------------------------
// Row shapes (snake_case, exactly as stored)
// ---------------------------------------------------------------------------

interface EventRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  starts_on: string;
  ends_on: string;
  timezone: string;
  venue: string | null;
  website_url: string | null;
  submission_max: number | null;
  agenda_published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackRow {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
}

interface RoomRow {
  id: string;
  event_id: string;
  name: string;
  capacity: number | null;
  sort_order: number;
}

interface FormRow {
  id: string;
  event_id: string;
  kind: string;
  title: string;
  welcome_text: string | null;
  thank_you_text: string | null;
  is_open: number;
  opens_at: string | null;
  closes_at: string | null;
  max_speakers_per_submission: number;
  allow_drafts: number;
  submission_limit: number | null;
  notify_emails: string | null;
  created_at: string;
  updated_at: string;
}

interface FormFieldRow {
  id: string;
  form_id: string;
  key: string;
  label: string;
  field_type: string;
  required: number;
  sort_order: number;
  help_text: string | null;
  options_json: string | null;
}

interface ConditionalRuleRow {
  id: string;
  form_id: string;
  source_field_key: string;
  operator: string;
  values_json: string;
  action: string;
  target_field_key: string;
}

interface SpeakerRow {
  id: string;
  event_id: string;
  email: string;
  name: string;
  company: string | null;
  title: string | null;
  bio: string | null;
  location: string | null;
  socials_json: string | null;
  workflow_status: string;
  logistics_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SubmissionRow {
  id: string;
  reference_code: string | null;
  event_id: string;
  form_id: string | null;
  track_id: string | null;
  title: string;
  abstract: string;
  format: string;
  status: string;
  answers_json: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SubmissionSpeakerLinkRow {
  submission_id: string;
  role: string;
  sort_order: number;
  speaker_id: string;
  name: string;
  email: string;
  company: string | null;
  role_label: string | null;
  bio: string | null;
}

interface SessionRow {
  id: string;
  event_id: string;
  source_submission_id: string | null;
  track_id: string | null;
  title: string;
  abstract: string;
  format: string;
  status: string;
  origin: string;
  content_approval_status: string;
  created_at: string;
  updated_at: string;
}

interface OrganizerSessionRow extends SessionRow {
  track_name: string | null;
  version_count: number;
}

interface SessionVersionRow {
  id: string;
  session_id: string;
  title: string;
  abstract: string;
  editor: string;
  created_at: string;
}

interface AgendaSlotRow {
  id: string;
  event_id: string;
  session_id: string;
  room_id: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

interface SpeakerAssetRow {
  id: string;
  speaker_id: string;
  kind: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  task_id: string | null;
  session_id: string | null;
  version_number: number;
  uploaded_at: string;
}

interface AssetCommentRow {
  id: string;
  asset_id: string;
  author_role: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface PublicSessionRow {
  id: string;
  title: string;
  abstract: string;
  format: string;
  status: string;
  origin: string;
  track_id: string | null;
  track_name: string | null;
  track_color: string | null;
}

interface PublicSessionSpeakerRow {
  session_id: string;
  speaker_id: string;
  role: string;
  sort_order: number;
  name: string;
  company: string | null;
  title: string | null;
}

interface PublicScheduleSlotRow {
  id: string;
  starts_at: string;
  ends_at: string;
  room_id: string | null;
  room_name: string | null;
  session_id: string;
}

interface SpeakerPortalSessionRow {
  id: string;
  title: string;
  abstract: string;
  format: string;
  starts_at: string | null;
  ends_at: string | null;
  room_name: string | null;
}

interface TaskDefinitionRow {
  id: string;
  event_id: string;
  key: string;
  label: string;
  description: string | null;
  applies_to: string;
  due_at: string | null;
  sort_order: number;
  form_id?: string | null;
}

interface SpeakerTaskRow {
  id: string;
  event_id: string;
  speaker_id: string;
  task_definition_id: string;
  status: string;
  completed_at: string | null;
  updated_at: string;
}

interface ResourcePageRow {
  id: string;
  event_id: string;
  slug: string;
  title: string;
  body_md: string;
  embed_html: string | null;
  is_published: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mappers (snake_case rows -> camelCase contracts)
// ---------------------------------------------------------------------------

function parseJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * forms.notify_emails holds a JSON array of admin addresses — the customer's
 * "What admins should be notified when a new submission is received?" chips.
 * Anything that is not a usable address is dropped and nobody hears about it:
 * an unset, empty, or malformed list simply notifies no one.
 */
function parseNotifyEmails(raw: string | null): string[] {
  const parsed = parseJson<unknown>(raw, null);
  if (!Array.isArray(parsed)) return [];
  const addresses = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== "string") continue;
    const email = entry.trim().toLowerCase();
    if (email.includes("@")) addresses.add(email);
  }
  return [...addresses];
}

function mapEvent(r: EventRow): Event {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    timezone: r.timezone,
    venue: r.venue,
    websiteUrl: r.website_url,
    submissionMax: r.submission_max ?? null,
    agendaPublishedAt: r.agenda_published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapEventSummary(r: EventRow): EventSummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    timezone: r.timezone,
  };
}

function mapTrack(r: TrackRow): Track {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    description: r.description,
    color: r.color,
    sortOrder: r.sort_order,
  };
}

function mapRoom(r: RoomRow): Room {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    capacity: r.capacity,
    sortOrder: r.sort_order,
  };
}

function mapForm(r: FormRow): Form {
  return {
    id: r.id,
    eventId: r.event_id,
    kind: "cfp",
    title: r.title,
    welcomeText: r.welcome_text,
    thankYouText: r.thank_you_text,
    isOpen: r.is_open === 1,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    maxSpeakersPerSubmission: r.max_speakers_per_submission,
    allowDrafts: r.allow_drafts === 1,
    submissionLimit: r.submission_limit ?? null,
    notifyEmails: parseJson<string[]>(r.notify_emails, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapFormField(r: FormFieldRow): FormField {
  return {
    id: r.id,
    formId: r.form_id,
    key: r.key,
    label: r.label,
    fieldType: r.field_type as FormField["fieldType"],
    required: r.required === 1,
    sortOrder: r.sort_order,
    helpText: r.help_text,
    options: parseJson<string[] | null>(r.options_json, null),
  };
}

function mapRule(r: ConditionalRuleRow): ConditionalRule {
  return {
    id: r.id,
    formId: r.form_id,
    sourceFieldKey: r.source_field_key,
    operator: r.operator as ConditionalRule["operator"],
    values: parseJson<string[]>(r.values_json, []),
    action: r.action as ConditionalRule["action"],
    targetFieldKey: r.target_field_key,
  };
}

function mapSpeaker(r: SpeakerRow): Speaker {
  return {
    id: r.id,
    eventId: r.event_id,
    email: r.email,
    name: r.name,
    company: r.company,
    title: r.title,
    bio: r.bio,
    location: r.location,
    workflowStatus: r.workflow_status as Speaker["workflowStatus"],
    logisticsNotes: r.logistics_notes,
    socials: parseJson<Speaker["socials"]>(r.socials_json, null),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPublicSpeaker(r: SpeakerRow & { headshot_asset_id?: string | null }): PublicSpeaker {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    title: r.title,
    bio: r.bio,
    location: r.location,
    socials: parseJson<PublicSpeaker["socials"]>(r.socials_json, null),
    headshotUrl: r.headshot_asset_id ? `/api/assets/${r.headshot_asset_id}` : null,
  };
}

function mapPublicSessionSpeaker(r: PublicSessionSpeakerRow): PublicSessionSpeaker {
  return {
    id: r.speaker_id,
    name: r.name,
    company: r.company,
    title: r.title,
    role: r.role as PublicSessionSpeaker["role"],
    sortOrder: r.sort_order,
  };
}

function mapPublicSession(
  r: PublicSessionRow,
  speakers: PublicSessionSpeaker[],
): PublicSession {
  return {
    id: r.id,
    title: r.title,
    abstract: r.abstract,
    format: r.format as PublicSession["format"],
    status: r.status as PublicSession["status"],
    origin: r.origin as PublicSession["origin"],
    track: r.track_id
      ? { id: r.track_id, name: r.track_name ?? "Track", color: r.track_color }
      : null,
    speakers,
  };
}

function mapAsset(r: SpeakerAssetRow): SpeakerAsset {
  return {
    id: r.id,
    speakerId: r.speaker_id,
    kind: r.kind as SpeakerAsset["kind"],
    filename: r.filename,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    r2Key: r.r2_key,
    taskId: r.task_id,
    sessionId: r.session_id,
    versionNumber: r.version_number,
    uploadedAt: r.uploaded_at,
  };
}

function mapAssetComment(r: AssetCommentRow): AssetComment {
  return {
    id: r.id,
    assetId: r.asset_id,
    authorRole: r.author_role as AssetComment["authorRole"],
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at,
  };
}

function mapPortalSession(r: SpeakerPortalSessionRow): SpeakerPortalSession {
  return {
    id: r.id,
    title: r.title,
    abstract: r.abstract,
    format: r.format as SpeakerPortalSession["format"],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    roomName: r.room_name,
  };
}

function mapTaskDefinition(r: TaskDefinitionRow): TaskDefinition {
  return {
    id: r.id,
    eventId: r.event_id,
    key: r.key,
    label: r.label,
    description: r.description,
    appliesTo: r.applies_to as TaskDefinition["appliesTo"],
    dueAt: r.due_at,
    sortOrder: r.sort_order,
    formId: r.form_id ?? null,
  };
}

function mapSpeakerTask(r: SpeakerTaskRow): SpeakerTask {
  return {
    id: r.id,
    eventId: r.event_id,
    speakerId: r.speaker_id,
    taskDefinitionId: r.task_definition_id,
    status: r.status as SpeakerTask["status"],
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
  };
}

function mapResourcePage(r: ResourcePageRow): ResourcePage {
  return {
    id: r.id,
    eventId: r.event_id,
    slug: r.slug,
    title: r.title,
    bodyMd: r.body_md,
    embedHtml: r.embed_html,
    isPublished: r.is_published === 1,
    updatedAt: r.updated_at,
  };
}

interface ReviewRow {
  submission_id: string;
  reviewer_name: string;
  recommendation: string;
  overall_comment: string | null;
  submitted_at: string;
}

function mapReviewView(r: ReviewRow): SubmissionReviewView {
  return {
    reviewerName: r.reviewer_name,
    recommendation: r.recommendation as SubmissionReviewView["recommendation"],
    comment: r.overall_comment,
    submittedAt: r.submitted_at,
  };
}

function mapSubmissionListItem(
  r: SubmissionRow & { track_name: string | null },
  speakers: SubmissionSpeakerView[],
  reviews: SubmissionReviewView[],
): SubmissionListItem {
  return {
    id: r.id,
    referenceCode: r.reference_code,
    eventId: r.event_id,
    formId: r.form_id,
    trackId: r.track_id,
    title: r.title,
    abstract: r.abstract,
    format: r.format as SubmissionListItem["format"],
    status: r.status as SubmissionListItem["status"],
    answers: parseJson<Record<string, unknown>>(r.answers_json, {}),
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    speakers,
    trackName: r.track_name,
    reviews,
  };
}

function mapSession(r: SessionRow): Session {
  return {
    id: r.id,
    eventId: r.event_id,
    sourceSubmissionId: r.source_submission_id,
    trackId: r.track_id,
    title: r.title,
    abstract: r.abstract,
    format: r.format as Session["format"],
    status: r.status as Session["status"],
    origin: r.origin as Session["origin"],
    contentApprovalStatus: r.content_approval_status as Session["contentApprovalStatus"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAgendaSlot(r: AgendaSlotRow): AgendaSlot {
  return {
    id: r.id,
    eventId: r.event_id,
    sessionId: r.session_id,
    roomId: r.room_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const ALL_STATUSES: SubmissionStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
];

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class D1Repo implements LecternRepo {
  constructor(
    private readonly db: D1Database,
    private readonly emailDelivery: EmailDelivery = createEmailDelivery({}),
  ) {}

  private async getPublicProgram(slug: string): Promise<{
    event: EventRow;
    sessions: PublicSession[];
    slots: PublicScheduleResponse["slots"];
  } | null> {
    const event = await this.db
      .prepare("SELECT * FROM events WHERE slug = ?")
      .bind(slug)
      .first<EventRow>();
    if (!event) return null;

    const [sessionRes, speakerRes, slotRes] = await this.db.batch([
      this.db
        .prepare(
          `SELECT s.id, s.title, s.abstract, s.format, s.status, s.origin,
                  t.id AS track_id, t.name AS track_name, t.color AS track_color
           FROM sessions s
           LEFT JOIN tracks t ON t.id = s.track_id
           WHERE s.event_id = ? AND s.status = 'confirmed' AND s.content_approval_status = 'approved'
           ORDER BY COALESCE(t.sort_order, 999), s.title`,
        )
        .bind(event.id),
      this.db
        .prepare(
          `SELECT ss.session_id, ss.speaker_id, ss.role, ss.sort_order,
                  sp.name, sp.company, sp.title
           FROM session_speakers ss
           JOIN sessions s ON s.id = ss.session_id
           JOIN speakers sp ON sp.id = ss.speaker_id
           WHERE s.event_id = ? AND s.status = 'confirmed' AND s.content_approval_status = 'approved'
           ORDER BY ss.session_id, ss.sort_order`,
        )
        .bind(event.id),
      this.db
        .prepare(
          `SELECT a.id, a.starts_at, a.ends_at, a.room_id, r.name AS room_name, a.session_id
           FROM agenda_slots a
           JOIN sessions s ON s.id = a.session_id
           LEFT JOIN rooms r ON r.id = a.room_id
           WHERE a.event_id = ? AND s.status = 'confirmed' AND s.content_approval_status = 'approved'
           ORDER BY a.starts_at, COALESCE(r.sort_order, 999), s.title`,
        )
        .bind(event.id),
    ]);

    const speakerRows = (speakerRes?.results ?? []) as unknown as PublicSessionSpeakerRow[];
    const speakersBySession = new Map<string, PublicSessionSpeaker[]>();
    for (const row of speakerRows) {
      const list = speakersBySession.get(row.session_id) ?? [];
      list.push(mapPublicSessionSpeaker(row));
      speakersBySession.set(row.session_id, list);
    }

    const sessions = ((sessionRes?.results ?? []) as unknown as PublicSessionRow[]).map((row) =>
      mapPublicSession(row, speakersBySession.get(row.id) ?? []),
    );
    const sessionsById = new Map(sessions.map((session) => [session.id, session]));

    const slots = ((slotRes?.results ?? []) as unknown as PublicScheduleSlotRow[]).flatMap(
      (row) => {
        const session = sessionsById.get(row.session_id);
        if (!session) return [];
        return [
          {
            id: row.id,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            room: row.room_id ? { id: row.room_id, name: row.room_name ?? "Room" } : null,
            session,
          },
        ];
      },
    );

    return { event, sessions, slots };
  }

  async health(): Promise<boolean> {
    const row = await this.db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return row?.ok === 1;
  }

  async createEvent(input: CreateEventInput): Promise<EventBundle> {
    await this.db.batch([
      this.db.prepare(
        `INSERT INTO events
         (id, slug, name, tagline, description, starts_on, ends_on, timezone, venue,
          website_url, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, NULL, NULL, ?, ?)`,
      ).bind(input.eventId, input.slug, input.name, input.startsOn, input.endsOn,
        input.timezone, input.now, input.now),
      this.db.prepare(
        `INSERT INTO forms
         (id, event_id, kind, title, welcome_text, thank_you_text, is_open,
          opens_at, closes_at, max_speakers_per_submission, allow_drafts, created_at, updated_at)
         VALUES (?, ?, 'cfp', 'Call for Speakers', NULL, NULL, 1, NULL, NULL, 3, 1, ?, ?)`,
      ).bind(input.formId, input.eventId, input.now, input.now),
      this.db.prepare(
        "INSERT INTO evaluation_plans (id, event_id, name, description, created_at) VALUES (?, ?, 'Program Committee Review', NULL, ?)",
      ).bind(input.planId, input.eventId, input.now),
    ]);
    const bundle = await this.getEventBySlug(input.slug);
    if (!bundle) throw new Error("event_not_found");
    return bundle;
  }

  async updateEventSettings(input: UpdateEventSettingsInput): Promise<EventBundle> {
    await this.db.batch([
      this.db.prepare(
        // Scoped to one form: with several calls running, the settings panel
        // edits the primary (or named) form, never every form at once.
        `UPDATE forms SET is_open = ?1, opens_at = ?2, closes_at = ?3, updated_at = ?4
         WHERE id = COALESCE(?6, (SELECT id FROM forms WHERE event_id = ?5 AND kind = 'cfp' ORDER BY created_at, id LIMIT 1))`,
      ).bind(input.cfpIsOpen ? 1 : 0, input.cfpOpensAt, input.cfpClosesAt, input.now, input.eventId, input.formId ?? null),
      this.db.prepare("UPDATE events SET updated_at = ? WHERE id = ?").bind(input.now, input.eventId),
    ]);
    const row = await this.db.prepare("SELECT slug FROM events WHERE id = ?").bind(input.eventId).first<{ slug: string }>();
    const bundle = row ? await this.getEventBySlug(row.slug) : null;
    if (!bundle) throw new Error("event_not_found");
    return bundle;
  }

  async createTrack(input: CreateTrackInput): Promise<EventBundle> {
    await this.db.prepare(
      `INSERT INTO tracks (id, event_id, name, description, color, sort_order)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tracks WHERE event_id = ?))`,
    ).bind(input.id, input.eventId, input.name, input.description, input.color, input.eventId).run();
    const row = await this.db.prepare("SELECT slug FROM events WHERE id = ?").bind(input.eventId).first<{ slug: string }>();
    const bundle = row ? await this.getEventBySlug(row.slug) : null;
    if (!bundle) throw new Error("event_not_found");
    return bundle;
  }

  async createRoom(input: CreateRoomInput): Promise<EventBundle> {
    await this.db.prepare(
      `INSERT INTO rooms (id, event_id, name, capacity, sort_order)
       VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM rooms WHERE event_id = ?))`,
    ).bind(input.id, input.eventId, input.name, input.capacity, input.eventId).run();
    const row = await this.db.prepare("SELECT slug FROM events WHERE id = ?").bind(input.eventId).first<{ slug: string }>();
    const bundle = row ? await this.getEventBySlug(row.slug) : null;
    if (!bundle) throw new Error("event_not_found");
    return bundle;
  }

  async createFormField(input: CreateFormFieldInput): Promise<EventBundle> {
    const statements = [this.db.prepare(
      `INSERT INTO form_fields
       (id, form_id, key, label, field_type, required, sort_order, help_text, options_json)
       VALUES (?, ?, ?, ?, ?, ?,
         (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM form_fields WHERE form_id = ?), ?, ?)`,
    ).bind(input.id, input.formId, input.key, input.label, input.fieldType,
      input.required ? 1 : 0, input.formId, input.helpText,
      input.options ? JSON.stringify(input.options) : null)];
    if (input.condition && input.ruleId) {
      statements.push(this.db.prepare(
        `INSERT INTO conditional_rules
         (id, form_id, source_field_key, operator, values_json, action, target_field_key)
         VALUES (?, ?, ?, ?, ?, 'show', ?)`,
      ).bind(input.ruleId, input.formId, input.condition.sourceFieldKey,
        input.condition.operator, JSON.stringify(input.condition.values), input.key));
    }
    await this.db.batch(statements);
    const row = await this.db.prepare("SELECT slug FROM events WHERE id = ?").bind(input.eventId).first<{ slug: string }>();
    const bundle = row ? await this.getEventBySlug(row.slug) : null;
    if (!bundle) throw new Error("event_not_found");
    return bundle;
  }

  async listEvents(): Promise<EventSummary[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, slug, name, tagline, starts_on, ends_on, timezone FROM events ORDER BY starts_on",
      )
      .all<Pick<EventRow, "id" | "slug" | "name" | "tagline" | "starts_on" | "ends_on" | "timezone">>();
    return results.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      timezone: r.timezone,
    }));
  }

  async getEventBySlug(slug: string, cfpFormId?: string): Promise<EventBundle | null> {
    const event = await this.db
      .prepare("SELECT * FROM events WHERE slug = ?")
      .bind(slug)
      .first<EventRow>();
    if (!event) return null;

    const [tracksRes, roomsRes, summariesRes, formRes] = await this.db.batch([
      this.db.prepare("SELECT * FROM tracks WHERE event_id = ? ORDER BY sort_order").bind(event.id),
      this.db.prepare("SELECT * FROM rooms WHERE event_id = ? ORDER BY sort_order").bind(event.id),
      this.db.prepare(
        `SELECT f.id, f.title, f.is_open, f.opens_at, f.closes_at,
                (SELECT COUNT(*) FROM submissions s WHERE s.form_id = f.id) AS submission_count,
                (SELECT COUNT(*) FROM cfp_drafts d WHERE d.form_id = f.id) AS draft_count
         FROM forms f
         WHERE f.event_id = ?1 AND f.kind = 'cfp'
         ORDER BY f.created_at, f.id`,
      ).bind(event.id),
      this.db
        // The primary form is the oldest, kept stable so /cfp never moves;
        // a caller may target any other form on the event by id.
        .prepare(
          cfpFormId
            ? "SELECT * FROM forms WHERE event_id = ?1 AND kind = 'cfp' AND id = ?2"
            : "SELECT * FROM forms WHERE event_id = ?1 AND kind = 'cfp' ORDER BY created_at, id LIMIT 1",
        )
        .bind(...(cfpFormId ? [event.id, cfpFormId] : [event.id])),
    ]);

    const tracks = (tracksRes?.results ?? []) as unknown as TrackRow[];
    const rooms = (roomsRes?.results ?? []) as unknown as RoomRow[];
    const summaryRows = (summariesRes?.results ?? []) as unknown as {
      id: string; title: string; is_open: number; opens_at: string | null;
      closes_at: string | null; submission_count: number; draft_count: number;
    }[];
    const cfpForms = summaryRows.map((row, index) => ({
      id: row.id,
      title: row.title,
      isOpen: row.is_open === 1,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      submissionCount: row.submission_count,
      draftCount: row.draft_count,
      isPrimary: index === 0,
    }));
    const formRow = ((formRes?.results ?? []) as unknown as FormRow[])[0];

    let cfp: EventBundle["cfp"] = null;
    if (formRow) {
      const [fieldsRes, rulesRes, lengthRes] = await this.db.batch([
        this.db
          .prepare("SELECT * FROM form_fields WHERE form_id = ? ORDER BY sort_order")
          .bind(formRow.id),
        this.db.prepare("SELECT * FROM conditional_rules WHERE form_id = ?").bind(formRow.id),
        this.db
          .prepare("SELECT * FROM form_length_rules WHERE form_id = ? ORDER BY sort_order")
          .bind(formRow.id),
      ]);
      cfp = {
        form: mapForm(formRow),
        fields: ((fieldsRes?.results ?? []) as unknown as FormFieldRow[]).map(mapFormField),
        rules: ((rulesRes?.results ?? []) as unknown as ConditionalRuleRow[]).map(mapRule),
        lengthRules: ((lengthRes?.results ?? []) as unknown as {
          id: string; form_id: string; label: string;
          field_keys_json: string; max_chars: number; sort_order: number;
        }[]).map((row) => ({
          id: row.id,
          formId: row.form_id,
          label: row.label,
          fieldKeys: parseJson<string[]>(row.field_keys_json, []),
          maxChars: row.max_chars,
          sortOrder: row.sort_order,
        })),
      };
    }

    return {
      event: mapEvent(event),
      tracks: tracks.map(mapTrack),
      rooms: rooms.map(mapRoom),
      cfp,
      cfpForms,
    };
  }

  async getPublicSchedule(slug: string): Promise<PublicScheduleResponse | null> {
    const program = await this.getPublicProgram(slug);
    if (!program) return null;
    return {
      event: mapEventSummary(program.event),
      timezone: program.event.timezone,
      slots: program.slots,
    };
  }

  async getPublicSessions(slug: string): Promise<PublicSessionsResponse | null> {
    const program = await this.getPublicProgram(slug);
    if (!program) return null;
    return {
      event: mapEventSummary(program.event),
      sessions: program.sessions,
    };
  }

  async getPublicSpeakers(slug: string): Promise<PublicSpeakersResponse | null> {
    const event = await this.db
      .prepare("SELECT * FROM events WHERE slug = ?")
      .bind(slug)
      .first<EventRow>();
    if (!event) return null;

    // The headshot is whichever one the speaker uploaded most recently; the
    // correlated subquery keeps this a single round trip.
    const { results } = await this.db
      .prepare(
        `SELECT sp.*,
                (SELECT sa.id
                   FROM speaker_assets sa
                  WHERE sa.speaker_id = sp.id AND sa.kind = 'headshot'
                  ORDER BY sa.uploaded_at DESC
                  LIMIT 1) AS headshot_asset_id
         FROM speakers sp
         WHERE EXISTS (
           SELECT 1
           FROM session_speakers ss
           JOIN sessions s ON s.id = ss.session_id
           WHERE ss.speaker_id = sp.id
             AND s.event_id = ?
             AND s.status = 'confirmed'
             AND s.content_approval_status = 'approved'
         )
         ORDER BY sp.name`,
      )
      .bind(event.id)
      .all<SpeakerRow & { headshot_asset_id: string | null }>();

    return {
      event: mapEventSummary(event),
      speakers: results.map(mapPublicSpeaker),
    };
  }

  async getOrganizerSpeakers(eventId: string): Promise<OrganizerSpeakersResponse["speakers"]> {
    const [speakersRes, assetsRes, tasksRes, commentsRes] = await this.db.batch([
      this.db.prepare(
        `SELECT sp.*,
          (SELECT sa.id FROM speaker_assets sa WHERE sa.speaker_id = sp.id AND sa.kind = 'headshot' ORDER BY sa.uploaded_at DESC LIMIT 1) AS headshot_asset_id,
          (SELECT COUNT(*) FROM speaker_tasks st WHERE st.speaker_id = sp.id) AS total_tasks,
          (SELECT COUNT(*) FROM speaker_tasks st WHERE st.speaker_id = sp.id AND st.status = 'complete') AS completed_tasks
         FROM speakers sp WHERE sp.event_id = ? ORDER BY sp.name`,
      ).bind(eventId),
      this.db.prepare(
        `SELECT sa.* FROM speaker_assets sa JOIN speakers sp ON sp.id = sa.speaker_id
         WHERE sp.event_id = ? ORDER BY sa.uploaded_at DESC`,
      ).bind(eventId),
      this.db.prepare(
        `SELECT st.id, st.event_id, st.speaker_id, st.task_definition_id, st.status,
          st.completed_at, st.updated_at, td.id AS definition_id, td.key, td.label, td.description,
          td.applies_to, td.due_at, td.sort_order, td.form_id
         FROM speaker_tasks st JOIN task_definitions td ON td.id = st.task_definition_id
         WHERE st.event_id = ? ORDER BY td.due_at, td.sort_order`,
      ).bind(eventId),
      this.db.prepare(
        `SELECT ac.* FROM asset_comments ac
         JOIN speaker_assets sa ON sa.id = ac.asset_id
         JOIN speakers sp ON sp.id = sa.speaker_id
         WHERE sp.event_id = ? ORDER BY ac.created_at, ac.id`,
      ).bind(eventId),
    ]);
    const assets = ((assetsRes?.results ?? []) as unknown as SpeakerAssetRow[]).map(mapAsset);
    const comments = ((commentsRes?.results ?? []) as unknown as AssetCommentRow[]).map(mapAssetComment);
    const taskRows = (tasksRes?.results ?? []) as unknown as Array<SpeakerTaskRow & {
      definition_id: string; key: string; label: string; description: string | null;
      applies_to: string; due_at: string | null; sort_order: number; form_id: string | null;
    }>;
    return ((speakersRes?.results ?? []) as unknown as Array<SpeakerRow & {
      headshot_asset_id: string | null; total_tasks: number; completed_tasks: number;
    }>).map((row) => ({
      ...mapPublicSpeaker(row),
      email: row.email,
      workflowStatus: row.workflow_status as OrganizerSpeakersResponse["speakers"][number]["workflowStatus"],
      logisticsNotes: row.logistics_notes,
      totalTasks: Number(row.total_tasks),
      completedTasks: Number(row.completed_tasks),
      assets: assets.filter((asset) => asset.speakerId === row.id),
      assetComments: comments.filter((comment) => assets.some((asset) => asset.speakerId === row.id && asset.id === comment.assetId)),
      tasks: taskRows.filter((task) => task.speaker_id === row.id).map((task) => ({
        task: mapSpeakerTask(task),
        definition: {
          id: task.definition_id, eventId: task.event_id, key: task.key, label: task.label,
          description: task.description, appliesTo: task.applies_to as TaskDefinition["appliesTo"],
          formId: task.form_id ?? null,
          dueAt: task.due_at, sortOrder: task.sort_order,
        },
      })),
    }));
  }

  async createOrganizerSpeaker(input: CreateOrganizerSpeakerInput): Promise<Speaker> {
    await this.db.prepare(
      `INSERT INTO speakers
       (id, event_id, email, name, company, title, bio, location, socials_json,
        workflow_status, logistics_notes, created_at, updated_at)
       VALUES (?1, ?2, lower(?3), ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?9, ?10, ?10)`,
    ).bind(input.id, input.eventId, input.email, input.name, input.company, input.title,
      input.bio, input.workflowStatus, input.logisticsNotes, input.now).run();
    const speaker = await this.getSpeakerById(input.id);
    if (!speaker) throw new Error("speaker_not_found");
    return speaker;
  }

  async updateOrganizerSpeaker(input: UpdateOrganizerSpeakerInput): Promise<Speaker> {
    const result = await this.db.prepare(
      `UPDATE speakers SET name = ?1, company = ?2, title = ?3, bio = ?4,
        workflow_status = ?5, logistics_notes = ?6, updated_at = ?7
       WHERE id = ?8 AND event_id = ?9`,
    ).bind(input.name, input.company, input.title, input.bio, input.workflowStatus,
      input.logisticsNotes, input.now, input.id, input.eventId).run();
    if (!result.meta.changes) throw new Error("speaker_not_found");
    const speaker = await this.getSpeakerById(input.id);
    if (!speaker) throw new Error("speaker_not_found");
    return speaker;
  }

  async importOrganizerSpeakers(input: ImportOrganizerSpeakersInput): Promise<{ imported: number; updated: number; total: number }> {
    if (input.rows.length === 0) return { imported: 0, updated: 0, total: 0 };
    const placeholders = input.rows.map(() => "?").join(",");
    const existing = await this.db.prepare(
      `SELECT lower(email) AS email FROM speakers WHERE event_id = ? AND lower(email) IN (${placeholders})`,
    ).bind(input.eventId, ...input.rows.map((row) => row.email.toLowerCase())).all<{ email: string }>();
    const existingEmails = new Set(existing.results.map((row) => row.email));
    await this.db.batch(input.rows.map((row) => this.db.prepare(
      `INSERT INTO speakers
       (id, event_id, email, name, company, title, bio, location, socials_json,
        workflow_status, logistics_notes, created_at, updated_at)
       VALUES (?1, ?2, lower(?3), ?4, ?5, ?6, ?7, NULL, NULL, 'invited', NULL, ?8, ?8)
       ON CONFLICT(event_id, email) DO UPDATE SET
        name = excluded.name,
        company = COALESCE(excluded.company, speakers.company),
        title = COALESCE(excluded.title, speakers.title),
        bio = COALESCE(excluded.bio, speakers.bio),
        updated_at = excluded.updated_at`,
    ).bind(row.id, input.eventId, row.email, row.name, row.company, row.title, row.bio, input.now)));
    const updated = input.rows.filter((row) => existingEmails.has(row.email.toLowerCase())).length;
    return { imported: input.rows.length - updated, updated, total: input.rows.length };
  }

  async createSpeakerTask(input: CreateSpeakerTaskInput): Promise<{ definition: TaskDefinition; assigned: number }> {
    const valid = await this.db.prepare(
      `SELECT id FROM speakers WHERE event_id = ? AND id IN (${input.speakerIds.map(() => "?").join(",")})`,
    ).bind(input.eventId, ...input.speakerIds).all<{ id: string }>();
    const speakerIds = valid.results.map((row) => row.id);
    if (speakerIds.length !== new Set(input.speakerIds).size) throw new Error("speaker_not_found");
    await this.db.batch([
      this.db.prepare(
        `INSERT INTO task_definitions (id, event_id, key, label, description, applies_to, due_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, 'all_speakers', ?6, 100)`,
      ).bind(input.definitionId, input.eventId, `custom_${input.taskType}_${input.definitionId}`, input.title,
        input.instructions, input.dueAt),
      ...speakerIds.map((speakerId, index) => this.db.prepare(
        `INSERT INTO speaker_tasks (id, event_id, speaker_id, task_definition_id, status, completed_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', NULL, ?5)`,
      ).bind(input.speakerTaskIds[index], input.eventId, speakerId, input.definitionId, input.now)),
    ]);
    return {
      definition: {
        id: input.definitionId, eventId: input.eventId, key: `custom_${input.taskType}_${input.definitionId}`,
        label: input.title, description: input.instructions, appliesTo: "all_speakers",
        dueAt: input.dueAt, sortOrder: 100, formId: null,
      },
      assigned: speakerIds.length,
    };
  }

  /**
   * Portal forms reuse the CFP's form engine: a form of kind 'portal', its
   * fields, and a task definition that points at it. Assigning it to speakers
   * is the same speaker_tasks write every other task uses.
   */
  async createPortalForm(input: CreatePortalFormInput): Promise<{ formId: string; definitionId: string; assigned: number }> {
    const valid = await this.db.prepare(
      `SELECT id FROM speakers WHERE event_id = ? AND id IN (${input.speakerIds.map(() => "?").join(",")})`,
    ).bind(input.eventId, ...input.speakerIds).all<{ id: string }>();
    const speakerIds = valid.results.map((row) => row.id);
    if (speakerIds.length !== new Set(input.speakerIds).size) throw new Error("speaker_not_found");

    await this.db.batch([
      this.db.prepare(
        `INSERT INTO forms (id, event_id, kind, title, welcome_text, thank_you_text, is_open,
                            opens_at, closes_at, max_speakers_per_submission, allow_drafts, created_at, updated_at)
         VALUES (?1, ?2, 'portal', ?3, ?4, NULL, 1, NULL, ?5, 1, 0, ?6, ?6)`,
      ).bind(input.formId, input.eventId, input.title, input.instructions, input.dueAt, input.now),
      ...input.fields.map((field, index) => this.db.prepare(
        `INSERT INTO form_fields (id, form_id, key, label, field_type, required, sort_order, help_text, options_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(field.id, input.formId, field.key, field.label, field.fieldType,
        field.required ? 1 : 0, index, field.helpText,
        field.options ? JSON.stringify(field.options) : null)),
      this.db.prepare(
        `INSERT INTO task_definitions (id, event_id, key, label, description, applies_to, due_at, sort_order, form_id)
         VALUES (?1, ?2, ?3, ?4, ?5, 'all_speakers', ?6, 100, ?7)`,
      ).bind(input.definitionId, input.eventId, `form_${input.definitionId}`, input.title,
        input.instructions, input.dueAt, input.formId),
      ...speakerIds.map((speakerId, index) => this.db.prepare(
        `INSERT INTO speaker_tasks (id, event_id, speaker_id, task_definition_id, status, completed_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', NULL, ?5)`,
      ).bind(input.speakerTaskIds[index], input.eventId, speakerId, input.definitionId, input.now)),
    ]);
    return { formId: input.formId, definitionId: input.definitionId, assigned: speakerIds.length };
  }

  async listPortalForms(eventId: string): Promise<PortalFormSummary[]> {
    const [formsRes, fieldsRes, countsRes, responsesRes] = await this.db.batch([
      this.db.prepare(
        `SELECT f.id AS form_id, f.title, f.closes_at, td.id AS definition_id, td.description
         FROM forms f
         JOIN task_definitions td ON td.form_id = f.id
         WHERE f.event_id = ?1 AND f.kind = 'portal'
         ORDER BY f.created_at DESC`,
      ).bind(eventId),
      this.db.prepare(
        `SELECT ff.* FROM form_fields ff
         JOIN forms f ON f.id = ff.form_id
         WHERE f.event_id = ?1 AND f.kind = 'portal'
         ORDER BY ff.form_id, ff.sort_order`,
      ).bind(eventId),
      this.db.prepare(
        `SELECT st.task_definition_id,
                COUNT(*) AS assigned,
                SUM(CASE WHEN st.status = 'complete' THEN 1 ELSE 0 END) AS completed
         FROM speaker_tasks st
         JOIN task_definitions td ON td.id = st.task_definition_id
         WHERE td.event_id = ?1 AND td.form_id IS NOT NULL
         GROUP BY st.task_definition_id`,
      ).bind(eventId),
      this.db.prepare(
        `SELECT r.task_definition_id, r.speaker_id, r.answers_json, r.submitted_at, sp.name AS speaker_name
         FROM task_form_responses r
         JOIN speakers sp ON sp.id = r.speaker_id
         WHERE sp.event_id = ?1
         ORDER BY r.submitted_at DESC`,
      ).bind(eventId),
    ]);

    const fields = ((fieldsRes?.results ?? []) as unknown as FormFieldRow[]).map(mapFormField);
    const counts = new Map<string, { assigned: number; completed: number }>();
    for (const row of (countsRes?.results ?? []) as unknown as {
      task_definition_id: string; assigned: number; completed: number;
    }[]) counts.set(row.task_definition_id, { assigned: row.assigned, completed: row.completed ?? 0 });

    const responses = new Map<string, PortalFormSummary["responses"]>();
    for (const row of (responsesRes?.results ?? []) as unknown as {
      task_definition_id: string; speaker_id: string; speaker_name: string;
      answers_json: string; submitted_at: string;
    }[]) {
      const list = responses.get(row.task_definition_id) ?? [];
      list.push({
        speakerId: row.speaker_id,
        speakerName: row.speaker_name,
        answers: parseJson<Record<string, unknown>>(row.answers_json, {}),
        submittedAt: row.submitted_at,
      });
      responses.set(row.task_definition_id, list);
    }

    return ((formsRes?.results ?? []) as unknown as {
      form_id: string; title: string; closes_at: string | null;
      definition_id: string; description: string | null;
    }[]).map((row) => ({
      formId: row.form_id,
      definitionId: row.definition_id,
      title: row.title,
      instructions: row.description,
      dueAt: row.closes_at,
      fields: fields.filter((field) => field.formId === row.form_id),
      assigned: counts.get(row.definition_id)?.assigned ?? 0,
      completed: counts.get(row.definition_id)?.completed ?? 0,
      responses: responses.get(row.definition_id) ?? [],
    }));
  }

  async submitTaskForm(input: SubmitTaskFormInput): Promise<SpeakerPortalBundle> {
    const task = await this.db.prepare(
      `SELECT st.id, td.form_id FROM speaker_tasks st
       JOIN task_definitions td ON td.id = st.task_definition_id
       WHERE st.speaker_id = ?1 AND st.task_definition_id = ?2 AND td.form_id IS NOT NULL`,
    ).bind(input.speakerId, input.taskDefinitionId).first<{ id: string; form_id: string }>();
    if (!task) throw new Error("task_not_found");

    await this.db.batch([
      this.db.prepare(
        `INSERT INTO task_form_responses (id, task_definition_id, speaker_id, form_id, answers_json, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(task_definition_id, speaker_id) DO UPDATE SET
           answers_json = excluded.answers_json, submitted_at = excluded.submitted_at`,
      ).bind(input.responseId, input.taskDefinitionId, input.speakerId, task.form_id,
        JSON.stringify(input.answers), input.now),
      this.db.prepare(
        "UPDATE speaker_tasks SET status = 'complete', completed_at = ?1, updated_at = ?1 WHERE id = ?2",
      ).bind(input.now, task.id),
    ]);

    const portal = await this.getSpeakerPortalByToken(input.speakerId);
    if (!portal) throw new Error("Speaker portal disappeared after form submission.");
    return portal;
  }

  async updateSpeakerTaskDueDate(eventId: string, definitionId: string, dueAt: string | null): Promise<TaskDefinition> {
    const result = await this.db.prepare(
      "UPDATE task_definitions SET due_at = ?1 WHERE id = ?2 AND event_id = ?3",
    ).bind(dueAt, definitionId, eventId).run();
    if ((result.meta.changes ?? 0) === 0) throw new Error("task_definition_not_found");
    const row = await this.db.prepare(
      "SELECT * FROM task_definitions WHERE id = ?1 AND event_id = ?2",
    ).bind(definitionId, eventId).first<TaskDefinitionRow>();
    if (!row) throw new Error("task_definition_not_found");
    return mapTaskDefinition(row);
  }

  async sendBulkTaskReminders(input: BulkTaskReminderInput): Promise<{ queued: number; recipientEmails: string[] }> {
    const rows = await this.db.prepare(
      `SELECT sp.id, sp.name, sp.email, GROUP_CONCAT(td.label, '||') AS labels
       FROM speakers sp JOIN speaker_tasks st ON st.speaker_id = sp.id AND st.status <> 'complete'
       JOIN task_definitions td ON td.id = st.task_definition_id
       WHERE sp.event_id = ? AND sp.id IN (${input.speakerIds.map(() => "?").join(",")})
       GROUP BY sp.id ORDER BY sp.name`,
    ).bind(input.eventId, ...input.speakerIds).all<{ id: string; name: string; email: string; labels: string }>();
    const recipients = rows.results ?? [];
    if (recipients.length === 0) return { queued: 0, recipientEmails: [] };
    for (const [index, row] of recipients.entries()) {
      const labels = row.labels.split("||");
      await this.simulateCommunication({
        messageId: input.messageIds[index]!,
        attemptId: input.attemptIds[index]!,
        eventId: input.eventId,
        speakerId: row.id,
        toEmail: row.email,
        subject: "Reminder: speaker tasks need attention",
        bodyMd: `Hi ${row.name},\n\nPlease complete: ${labels.join(", ")}.\n\nOpen your speaker portal to finish these tasks.`,
        now: input.now,
      });
    }
    return { queued: recipients.length, recipientEmails: recipients.map((row) => row.email) };
  }

  async createCfpSubmission(input: CreateCfpSubmissionInput): Promise<SubmissionListItem> {
    const upsertSpeaker = async (speaker: CreateCfpSubmissionInput["speaker"], id: string) => {
      const row = await this.db.prepare(
        `INSERT INTO speakers (id, event_id, email, name, company, title, bio, location, socials_json, created_at, updated_at)
         VALUES (?1, ?2, lower(?3), ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?8)
         ON CONFLICT(event_id, email) DO UPDATE SET
           name = excluded.name,
           company = COALESCE(excluded.company, speakers.company),
           title = COALESCE(excluded.title, speakers.title),
           bio = COALESCE(excluded.bio, speakers.bio),
           updated_at = excluded.updated_at
         RETURNING id`,
      ).bind(
        id,
        input.eventId,
        speaker.email,
        speaker.name,
        speaker.company ?? null,
        speaker.title ?? null,
        speaker.bio ?? null,
        input.now,
      ).first<{ id: string }>();
      if (!row) throw new Error("Speaker upsert returned no row.");
      return row.id;
    };
    const primarySpeakerId = await upsertSpeaker(input.speaker, input.speakerId);
    const coSpeakerIds: string[] = [];
    for (const coSpeaker of input.coSpeakers) {
      coSpeakerIds.push(await upsertSpeaker(coSpeaker, coSpeaker.id));
    }

    await this.db.batch([
      this.db
        .prepare(
          // The reference code is the next number for this event, computed in
          // the same statement so concurrent submissions cannot collide.
          `INSERT INTO submissions (id, reference_code, event_id, form_id, track_id, title, abstract, format, status, answers_json, submitted_at, created_at, updated_at)
           VALUES (?1,
                   'SUB-' || (SELECT COUNT(*) + 1 FROM submissions WHERE event_id = ?2),
                   ?2, ?3, ?4, ?5, ?6, ?7, 'submitted', ?8, ?9, ?9, ?9)`,
        )
        .bind(
          input.submissionId,
          input.eventId,
          input.formId,
          input.trackId,
          input.title,
          input.abstract,
          input.format,
          JSON.stringify(input.answers),
          input.now,
        ),
      this.db.prepare(
          `INSERT INTO submission_speakers (submission_id, speaker_id, role, sort_order)
           VALUES (?1, ?2, 'primary', 0)`,
        ).bind(input.submissionId, primarySpeakerId),
      ...coSpeakerIds.map((speakerId, index) => this.db.prepare(
        `INSERT INTO submission_speakers (submission_id, speaker_id, role, sort_order)
         VALUES (?, ?, 'co_speaker', ?)`,
      ).bind(input.submissionId, speakerId, index + 1)),
    ]);

    const created = await this.getSubmissionById(input.submissionId);
    if (!created) throw new Error("Submission not found after insert.");
    return created;
  }

  async saveCfpDraft(input: SaveCfpDraftInput): Promise<{ token: string; savedAt: string; draft: CfpDraftRequestType }> {
    await this.db.prepare(
      `INSERT INTO cfp_drafts (token, event_id, form_id, payload_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(token) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at
       WHERE cfp_drafts.event_id = excluded.event_id AND cfp_drafts.form_id = excluded.form_id`,
    ).bind(input.token, input.eventId, input.formId, JSON.stringify(input.draft), input.now).run();
    return { token: input.token, savedAt: input.now, draft: input.draft };
  }

  async getCfpDraft(eventId: string, token: string): Promise<{ token: string; savedAt: string; draft: CfpDraftRequestType } | null> {
    const row = await this.db.prepare(
      "SELECT token, payload_json, updated_at FROM cfp_drafts WHERE event_id = ? AND token = ?",
    ).bind(eventId, token).first<{ token: string; payload_json: string; updated_at: string }>();
    if (!row) return null;
    const parsed = CfpDraftRequest.safeParse(parseJson<unknown>(row.payload_json, null));
    if (!parsed.success) return null;
    return { token: row.token, savedAt: row.updated_at, draft: parsed.data };
  }

  async listSubmissions(eventId: string): Promise<SubmissionListItem[]> {
    const [subsRes, linksRes, reviewsRes] = await this.db.batch([
      this.db
        .prepare(
          `SELECT s.*, t.name AS track_name
           FROM submissions s
           LEFT JOIN tracks t ON t.id = s.track_id
           WHERE s.event_id = ?
           ORDER BY s.submitted_at IS NULL, s.submitted_at DESC, s.id`,
        )
        .bind(eventId),
      this.db
        .prepare(
          `SELECT ss.submission_id, ss.role, ss.sort_order, sp.id AS speaker_id, sp.name, sp.email, sp.company, sp.title AS role_label, sp.bio
           FROM submission_speakers ss
           JOIN speakers sp ON sp.id = ss.speaker_id
           JOIN submissions s ON s.id = ss.submission_id
           WHERE s.event_id = ?
           ORDER BY ss.submission_id, ss.sort_order`,
        )
        .bind(eventId),
      this.db
        .prepare(
          `SELECT rv.submission_id, rv.reviewer_name, rv.recommendation, rv.overall_comment, rv.submitted_at
           FROM reviews rv
           JOIN submissions s ON s.id = rv.submission_id
           WHERE s.event_id = ?
           ORDER BY rv.submission_id, rv.submitted_at DESC`,
        )
        .bind(eventId),
    ]);

    const subs = (subsRes?.results ?? []) as unknown as (SubmissionRow & {
      track_name: string | null;
    })[];
    const links = (linksRes?.results ?? []) as unknown as SubmissionSpeakerLinkRow[];
    const reviewRows = (reviewsRes?.results ?? []) as unknown as ReviewRow[];

    const speakersBySubmission = new Map<string, SubmissionSpeakerView[]>();
    for (const link of links) {
      const list = speakersBySubmission.get(link.submission_id) ?? [];
      list.push({
        speakerId: link.speaker_id,
        role: link.role as SubmissionSpeakerView["role"],
        sortOrder: link.sort_order,
        name: link.name,
        email: link.email,
        company: link.company,
        roleLabel: link.role_label ?? null,
        bio: link.bio,
      });
      speakersBySubmission.set(link.submission_id, list);
    }

    const reviewsBySubmission = new Map<string, SubmissionReviewView[]>();
    for (const review of reviewRows) {
      const list = reviewsBySubmission.get(review.submission_id) ?? [];
      list.push(mapReviewView(review));
      reviewsBySubmission.set(review.submission_id, list);
    }

    return subs.map((row) =>
      mapSubmissionListItem(
        row,
        speakersBySubmission.get(row.id) ?? [],
        reviewsBySubmission.get(row.id) ?? [],
      ),
    );
  }

  async createCfpForm(input: CreateCfpFormInput): Promise<EventBundle> {
    await this.db.prepare(
      `INSERT INTO forms (id, event_id, kind, title, welcome_text, thank_you_text, is_open,
                          opens_at, closes_at, max_speakers_per_submission, allow_drafts,
                          submission_limit, created_at, updated_at)
       VALUES (?1, ?2, 'cfp', ?3, ?4, ?5, ?6, ?7, ?8, 3, ?9, ?10, ?11, ?11)`,
    ).bind(
      input.formId, input.eventId, input.title, input.welcomeText, input.thankYouText,
      input.isOpen ? 1 : 0, input.opensAt, input.closesAt, input.allowDrafts ? 1 : 0,
      input.submissionLimit, input.now,
    ).run();
    const row = await this.db.prepare("SELECT slug FROM events WHERE id = ?").bind(input.eventId).first<{ slug: string }>();
    const bundle = row ? await this.getEventBySlug(row.slug, input.formId) : null;
    if (!bundle) throw new Error("event_not_found");
    return bundle;
  }

  async countSubmitterProposals(eventId: string, email: string, formId?: string): Promise<number> {
    const row = await this.db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM submissions s
            JOIN submission_speakers ss ON ss.submission_id = s.id
            JOIN speakers sp ON sp.id = ss.speaker_id
          WHERE s.event_id = ?1 AND lower(sp.email) = ?2
            AND (?3 IS NULL OR s.form_id = ?3)
            AND s.status NOT IN ('withdrawn')) AS sent,
         (SELECT COUNT(*) FROM cfp_drafts d
          WHERE d.event_id = ?1
            AND (?3 IS NULL OR d.form_id = ?3)
            AND lower(json_extract(d.payload_json, '$.speaker.email')) = ?2) AS drafts`,
    ).bind(eventId, email.toLowerCase(), formId ?? null).first<{ sent: number; drafts: number }>();
    return (row?.sent ?? 0) + (row?.drafts ?? 0);
  }

  async getSubmissionById(id: string): Promise<SubmissionListItem | null> {
    const row = await this.db
      .prepare(
        `SELECT s.*, t.name AS track_name
         FROM submissions s
         LEFT JOIN tracks t ON t.id = s.track_id
         WHERE s.id = ?`,
      )
      .bind(id)
      .first<SubmissionRow & { track_name: string | null }>();
    if (!row) return null;

    const { results } = await this.db
      .prepare(
        `SELECT ss.submission_id, ss.role, ss.sort_order, sp.id AS speaker_id, sp.name, sp.email, sp.company, sp.title AS role_label, sp.bio
         FROM submission_speakers ss
         JOIN speakers sp ON sp.id = ss.speaker_id
         WHERE ss.submission_id = ?
         ORDER BY ss.sort_order`,
      )
      .bind(id)
      .all<SubmissionSpeakerLinkRow>();

    const speakers: SubmissionSpeakerView[] = results.map((link) => ({
      speakerId: link.speaker_id,
      role: link.role as SubmissionSpeakerView["role"],
      sortOrder: link.sort_order,
      name: link.name,
      email: link.email,
      company: link.company,
      roleLabel: link.role_label ?? null,
      bio: link.bio,
    }));

    const reviewsRes = await this.db
      .prepare(
        `SELECT submission_id, reviewer_name, recommendation, overall_comment, submitted_at
         FROM reviews WHERE submission_id = ? ORDER BY submitted_at DESC`,
      )
      .bind(id)
      .all<ReviewRow>();

    return mapSubmissionListItem(row, speakers, (reviewsRes.results ?? []).map(mapReviewView));
  }

  /**
   * When speakers land on the program, give them the event's onboarding
   * checklist. Runs inside the same batch as the acceptance so a speaker can
   * never be on the program without their tasks. Idempotent: the UNIQUE
   * (speaker_id, task_definition_id) constraint makes re-approval a no-op,
   * and the SELECT means events with no task definitions derive nothing.
   */
  private deriveAcceptedSpeakerTasks(
    eventId: string,
    speakerIds: readonly string[],
    now: string,
  ): D1PreparedStatement[] {
    return speakerIds.map((speakerId) =>
      this.db
        .prepare(
          `INSERT INTO speaker_tasks (id, event_id, speaker_id, task_definition_id, status, completed_at, updated_at)
           SELECT 'task_' || lower(hex(randomblob(8))), td.event_id, ?2, td.id, 'pending', NULL, ?3
             FROM task_definitions td
            WHERE td.event_id = ?1 AND td.applies_to = 'accepted_speakers'
           ON CONFLICT(speaker_id, task_definition_id) DO NOTHING`,
        )
        .bind(eventId, speakerId, now),
    );
  }

  /**
   * The organizer's reasoning, saved as a committee review so the WHY behind
   * a decision survives it. Upserts on the fixed organizer identity: deciding
   * again replaces the note rather than stacking duplicates. Events without
   * an evaluation round (demo-loaded conferences) get one lazily so the
   * reviews FK always has a home.
   */
  private async committeeNoteStatements(
    eventId: string,
    submissionId: string,
    decision: DecideSubmissionInput["decision"],
    reasoning: string | undefined,
    reviewerName: string | undefined,
    now: string,
  ): Promise<D1PreparedStatement[]> {
    const note = reasoning?.trim();
    if (!note) return [];
    const reviewer = reviewerIdentity(reviewerName);

    const statements: D1PreparedStatement[] = [];
    const existingRound = await this.db
      .prepare(
        `SELECT r.id FROM evaluation_rounds r
         JOIN evaluation_plans p ON p.id = r.plan_id
         WHERE p.event_id = ?1
         ORDER BY (r.status = 'open') DESC, r.round_number DESC
         LIMIT 1`,
      )
      .bind(eventId)
      .first<{ id: string }>();

    let roundId = existingRound?.id;
    if (!roundId) {
      const planId = `plan_${crypto.randomUUID().slice(0, 8)}`;
      roundId = `round_${crypto.randomUUID().slice(0, 8)}`;
      statements.push(
        this.db
          .prepare(
            `INSERT INTO evaluation_plans (id, event_id, name, description, created_at)
             VALUES (?1, ?2, 'Program decisions', 'Created automatically to hold organizer decision notes.', ?3)`,
          )
          .bind(planId, eventId, now),
        this.db
          .prepare(
            `INSERT INTO evaluation_rounds (id, plan_id, name, round_number, status, opens_at, closes_at)
             VALUES (?1, ?2, 'Decisions', 1, 'open', ?3, NULL)`,
          )
          .bind(roundId, planId, now),
      );
    }

    const recommendation =
      decision === "approve" ? "accept" : decision === "maybe" ? "waitlist" : "reject";
    statements.push(
      this.db
        .prepare(
          `INSERT INTO reviews
             (id, round_id, submission_id, reviewer_name, reviewer_email, scores_json, overall_comment, recommendation, submitted_at)
           VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6, ?7, ?8)
           ON CONFLICT(round_id, submission_id, reviewer_email) DO UPDATE SET
             reviewer_name = excluded.reviewer_name,
             overall_comment = excluded.overall_comment,
             recommendation = excluded.recommendation,
             submitted_at = excluded.submitted_at`,
        )
        .bind(
          `rev_${crypto.randomUUID().slice(0, 8)}`,
          roundId,
          submissionId,
          reviewer.name,
          reviewer.email,
          note,
          recommendation,
          now,
        ),
    );
    return statements;
  }

  async decideSubmission(input: DecideSubmissionInput): Promise<SubmissionDecisionResult> {
    const submission = await this.getSubmissionById(input.submissionId);
    if (!submission) throw new Error("submission_not_found");
    if (!canApplyDecision(submission.status, input.decision)) {
      throw new Error("invalid_decision_transition");
    }

    const noteStatements = await this.committeeNoteStatements(
      submission.eventId,
      submission.id,
      input.decision,
      input.reasoning,
      input.reviewerName,
      input.now,
    );

    const targetStatus = statusForDecision(input.decision);
    if (input.decision !== "approve") {
      await this.db.batch([
        this.db
          .prepare("UPDATE submissions SET status = ?1, updated_at = ?2 WHERE id = ?3")
          .bind(targetStatus, input.now, submission.id),
        ...noteStatements,
      ]);
      const updated = await this.getSubmissionById(submission.id);
      if (!updated) throw new Error("Submission disappeared after decision.");
      return { submission: updated, session: null, reusedSession: false };
    }

    const existing = await this.db
      .prepare("SELECT * FROM sessions WHERE source_submission_id = ?")
      .bind(submission.id)
      .first<SessionRow>();
    const built = buildSessionFromSubmission({
      submission,
      submissionSpeakers: submission.speakers.map((speaker) => ({
        submissionId: submission.id,
        speakerId: speaker.speakerId,
        role: speaker.role,
        sortOrder: speaker.sortOrder,
      })),
      sessionTitle: input.sessionTitle,
      sessionAbstract: input.sessionAbstract,
      now: input.now,
    });

    const statements = [
      this.db
        .prepare(
          `INSERT INTO sessions
             (id, event_id, source_submission_id, track_id, title, abstract, format, status, origin, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
           ON CONFLICT(source_submission_id) DO NOTHING`,
        )
        .bind(
          built.session.id,
          built.session.eventId,
          built.session.sourceSubmissionId,
          built.session.trackId,
          built.session.title,
          built.session.abstract,
          built.session.format,
          built.session.status,
          built.session.origin,
          built.session.createdAt,
          built.session.updatedAt,
        ),
      ...built.sessionSpeakers.map((speaker) =>
        this.db
          .prepare(
            `INSERT INTO session_speakers (session_id, speaker_id, role, sort_order)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(session_id, speaker_id) DO NOTHING`,
          )
          .bind(speaker.sessionId, speaker.speakerId, speaker.role, speaker.sortOrder),
      ),
      this.db
        .prepare("UPDATE submissions SET status = 'accepted', updated_at = ?1 WHERE id = ?2")
        .bind(input.now, submission.id),
      ...this.deriveAcceptedSpeakerTasks(
        built.session.eventId,
        built.sessionSpeakers.map((speaker) => speaker.speakerId),
        input.now,
      ),
      ...noteStatements,
    ];
    await this.db.batch(statements);

    const [updated, sessionRow] = await Promise.all([
      this.getSubmissionById(submission.id),
      this.db
        .prepare("SELECT * FROM sessions WHERE source_submission_id = ?")
        .bind(submission.id)
        .first<SessionRow>(),
    ]);
    if (!updated || !sessionRow) throw new Error("Acceptance did not create its session.");
    return {
      submission: updated,
      session: mapSession(sessionRow),
      reusedSession: existing !== null,
    };
  }

  async getOrganizerAgenda(eventId: string): Promise<OrganizerAgendaResponse> {
    const [sessionsRes, speakersRes, slotsRes] = await this.db.batch([
      this.db
        .prepare(
          `SELECT s.*, t.name AS track_name,
                  (SELECT COUNT(*) FROM session_versions sv WHERE sv.session_id = s.id) AS version_count
           FROM sessions s
           LEFT JOIN tracks t ON t.id = s.track_id
           WHERE s.event_id = ?
           ORDER BY s.status = 'cancelled', s.title`,
        )
        .bind(eventId),
      this.db
        .prepare(
          `SELECT ss.session_id, ss.speaker_id, ss.role, ss.sort_order,
                  sp.name, sp.company, sp.title
           FROM session_speakers ss
           JOIN sessions s ON s.id = ss.session_id
           JOIN speakers sp ON sp.id = ss.speaker_id
           WHERE s.event_id = ?
           ORDER BY ss.session_id, ss.sort_order`,
        )
        .bind(eventId),
      this.db
        .prepare("SELECT * FROM agenda_slots WHERE event_id = ? ORDER BY starts_at, room_id")
        .bind(eventId),
    ]);

    const speakerRows = (speakersRes?.results ?? []) as unknown as PublicSessionSpeakerRow[];
    const speakersBySession = new Map<string, PublicSessionSpeaker[]>();
    for (const row of speakerRows) {
      const speakers = speakersBySession.get(row.session_id) ?? [];
      speakers.push(mapPublicSessionSpeaker(row));
      speakersBySession.set(row.session_id, speakers);
    }

    const slots = ((slotsRes?.results ?? []) as unknown as AgendaSlotRow[]).map(mapAgendaSlot);
    const slotBySession = new Map(slots.map((slot) => [slot.sessionId, slot]));
    const sessions: OrganizerSession[] = (
      (sessionsRes?.results ?? []) as unknown as OrganizerSessionRow[]
    ).map((row) => ({
      ...mapSession(row),
      trackName: row.track_name,
      speakers: speakersBySession.get(row.id) ?? [],
      slot: slotBySession.get(row.id) ?? null,
      versionCount: Number(row.version_count ?? 0),
    }));
    const sessionSpeakers = speakerRows.map((row) => ({
      sessionId: row.session_id,
      speakerId: row.speaker_id,
      role: row.role as "primary" | "co_speaker",
      sortOrder: row.sort_order,
    }));

    return { sessions, conflicts: findScheduleConflicts(slots, sessionSpeakers) };
  }

  async createDirectSession(input: CreateDirectSessionInput): Promise<OrganizerSession> {
    const built = buildDirectSession({
      id: input.id,
      eventId: input.eventId,
      title: input.title,
      abstract: input.abstract,
      format: input.format,
      trackId: input.trackId,
      speakers: input.speakerIds.map((speakerId, index) => ({
        speakerId,
        role: index === 0 ? "primary" : "co_speaker",
        sortOrder: index,
      })),
      now: input.now,
    });

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO sessions
             (id, event_id, source_submission_id, track_id, title, abstract, format, status, origin, created_at, updated_at)
           VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, 'direct', ?8, ?8)`,
        )
        .bind(
          built.session.id,
          built.session.eventId,
          built.session.trackId,
          built.session.title,
          built.session.abstract,
          built.session.format,
          built.session.status,
          input.now,
        ),
      ...built.sessionSpeakers.map((speaker) =>
        this.db
          .prepare(
            `INSERT INTO session_speakers (session_id, speaker_id, role, sort_order)
             VALUES (?1, ?2, ?3, ?4)`,
          )
          .bind(speaker.sessionId, speaker.speakerId, speaker.role, speaker.sortOrder),
      ),
      // Invited speakers are on the program too — same onboarding checklist.
      ...this.deriveAcceptedSpeakerTasks(
        input.eventId,
        built.sessionSpeakers.map((speaker) => speaker.speakerId),
        input.now,
      ),
    ]);

    const agenda = await this.getOrganizerAgenda(input.eventId);
    const created = agenda.sessions.find((session) => session.id === input.id);
    if (!created) throw new Error("Direct session not found after insert.");
    return created;
  }

  /**
   * Retitle or reword a session in the program. Deliberately touches only the
   * session: the submission keeps what the speaker actually pitched, so
   * lineage always shows both the pitch and the published title.
   */
  async updateSession(input: UpdateSessionInput): Promise<OrganizerSession> {
    const current = await this.db
      .prepare("SELECT * FROM sessions WHERE id = ?1 AND event_id = ?2")
      .bind(input.sessionId, input.eventId)
      .first<SessionRow>();
    if (!current) throw new Error("session_not_found");

    if (current.title !== input.title || current.abstract !== input.abstract) {
      await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO session_versions (id, session_id, title, abstract, editor, created_at)
             VALUES (?1, ?2, ?3, ?4, 'Organizer', ?5)`,
          )
          .bind(`sver_${crypto.randomUUID().slice(0, 12)}`, input.sessionId, current.title, current.abstract, input.now),
        this.db
          .prepare(
            `UPDATE sessions SET title = ?1, abstract = ?2, updated_at = ?3
             WHERE id = ?4 AND event_id = ?5`,
          )
          .bind(input.title, input.abstract, input.now, input.sessionId, input.eventId),
      ]);
    }

    if (input.speakerIds !== undefined) {
      const uniqueSpeakerIds = [...new Set(input.speakerIds)];
      await this.db.batch([
        this.db.prepare("DELETE FROM session_speakers WHERE session_id = ?1").bind(input.sessionId),
        ...uniqueSpeakerIds.map((speakerId, index) => this.db
          .prepare(
            `INSERT INTO session_speakers (session_id, speaker_id, role, sort_order)
             VALUES (?1, ?2, ?3, ?4)`,
          )
          .bind(input.sessionId, speakerId, index === 0 ? "primary" : "co_speaker", index)),
        ...this.deriveAcceptedSpeakerTasks(input.eventId, uniqueSpeakerIds, input.now),
      ]);
    }

    const agenda = await this.getOrganizerAgenda(input.eventId);
    const updated = agenda.sessions.find((session) => session.id === input.sessionId);
    if (!updated) throw new Error("session_not_found");
    return updated;
  }

  async listSessionVersions(eventId: string, sessionId: string): Promise<SessionVersion[]> {
    const session = await this.db
      .prepare("SELECT id FROM sessions WHERE id = ?1 AND event_id = ?2")
      .bind(sessionId, eventId)
      .first<{ id: string }>();
    if (!session) throw new Error("session_not_found");
    const result = await this.db
      .prepare(
        `SELECT id, session_id, title, abstract, editor, created_at
         FROM session_versions WHERE session_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .bind(sessionId)
      .all<SessionVersionRow>();
    return (result.results ?? []).map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      abstract: row.abstract,
      editor: row.editor,
      createdAt: row.created_at,
    }));
  }

  async restoreSessionVersion(input: RestoreSessionVersionInput): Promise<OrganizerSession> {
    const [current, version] = await Promise.all([
      this.db
        .prepare("SELECT * FROM sessions WHERE id = ?1 AND event_id = ?2")
        .bind(input.sessionId, input.eventId)
        .first<SessionRow>(),
      this.db
        .prepare(
          `SELECT sv.* FROM session_versions sv
           JOIN sessions s ON s.id = sv.session_id
           WHERE sv.id = ?1 AND sv.session_id = ?2 AND s.event_id = ?3`,
        )
        .bind(input.versionId, input.sessionId, input.eventId)
        .first<SessionVersionRow>(),
    ]);
    if (!current) throw new Error("session_not_found");
    if (!version) throw new Error("version_not_found");
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO session_versions (id, session_id, title, abstract, editor, created_at)
           VALUES (?1, ?2, ?3, ?4, 'Organizer (before restore)', ?5)`,
        )
        .bind(input.snapshotId, input.sessionId, current.title, current.abstract, input.now),
      this.db
        .prepare(
          `UPDATE sessions SET title = ?1, abstract = ?2, updated_at = ?3
           WHERE id = ?4 AND event_id = ?5`,
        )
        .bind(version.title, version.abstract, input.now, input.sessionId, input.eventId),
    ]);
    const agenda = await this.getOrganizerAgenda(input.eventId);
    const restored = agenda.sessions.find((session) => session.id === input.sessionId);
    if (!restored) throw new Error("session_not_found");
    return restored;
  }

  async updateSessionContentApproval(input: UpdateSessionContentApprovalInput): Promise<OrganizerSession> {
    const result = await this.db
      .prepare(
        `UPDATE sessions SET content_approval_status = ?1, updated_at = ?2
         WHERE id = ?3 AND event_id = ?4`,
      )
      .bind(input.status, input.now, input.sessionId, input.eventId)
      .run();
    if (!result.meta.changes) throw new Error("session_not_found");
    const agenda = await this.getOrganizerAgenda(input.eventId);
    const updated = agenda.sessions.find((session) => session.id === input.sessionId);
    if (!updated) throw new Error("session_not_found");
    return updated;
  }

  async upsertAgendaSlot(input: UpsertAgendaSlotInput): Promise<OrganizerAgendaResponse> {
    await this.db
      .prepare(
        `INSERT INTO agenda_slots
           (id, event_id, session_id, room_id, starts_at, ends_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
         ON CONFLICT(session_id) DO UPDATE SET
           room_id = excluded.room_id,
           starts_at = excluded.starts_at,
           ends_at = excluded.ends_at,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.id,
        input.eventId,
        input.sessionId,
        input.roomId,
        input.startsAt,
        input.endsAt,
        input.now,
      )
      .run();
    return this.getOrganizerAgenda(input.eventId);
  }

  async publishAgenda(eventId: string, now: string): Promise<string> {
    const result = await this.db
      .prepare("UPDATE events SET agenda_published_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, eventId)
      .run();
    if (!result.meta.changes) throw new Error("event_not_found");
    return now;
  }

  async countsForEvent(eventId: string): Promise<EventCounts> {
    const [statusRes, sessionsRes, speakersRes] = await this.db.batch([
      this.db
        .prepare("SELECT status, COUNT(*) AS c FROM submissions WHERE event_id = ? GROUP BY status")
        .bind(eventId),
      this.db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE event_id = ?").bind(eventId),
      this.db.prepare("SELECT COUNT(*) AS c FROM speakers WHERE event_id = ?").bind(eventId),
    ]);

    const byStatus: Record<SubmissionStatus, number> = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      accepted: 0,
      rejected: 0,
      waitlisted: 0,
      withdrawn: 0,
    };
    let total = 0;
    for (const row of (statusRes?.results ?? []) as unknown as { status: string; c: number }[]) {
      if ((ALL_STATUSES as string[]).includes(row.status)) {
        byStatus[row.status as SubmissionStatus] = row.c;
        total += row.c;
      }
    }

    const sessions = ((sessionsRes?.results ?? []) as unknown as { c: number }[])[0]?.c ?? 0;
    const speakers = ((speakersRes?.results ?? []) as unknown as { c: number }[])[0]?.c ?? 0;

    return { submissions: total, submissionsByStatus: byStatus, sessions, speakers };
  }

  async getSpeakerById(id: string): Promise<Speaker | null> {
    const row = await this.db
      .prepare("SELECT * FROM speakers WHERE id = ?")
      .bind(id)
      .first<SpeakerRow>();
    return row ? mapSpeaker(row) : null;
  }

  async getSpeakerPortalByToken(token: string): Promise<SpeakerPortalBundle | null> {
    // Demo speaker links use the seeded speaker id as their stable token.
    const speaker = await this.db
      .prepare("SELECT * FROM speakers WHERE id = ?")
      .bind(token)
      .first<SpeakerRow>();
    if (!speaker) return null;

    const [eventRes, sessionsRes, proposalsRes, tasksRes, assetsRes, resourcesRes, commentsRes, coSpeakersRes, portalFieldsRes, formResponsesRes] = await this.db.batch([
      this.db
        .prepare(
          "SELECT id, slug, name, tagline, starts_on, ends_on, timezone FROM events WHERE id = ?",
        )
        .bind(speaker.event_id),
      this.db
        .prepare(
          `SELECT ses.id, ses.title, ses.abstract, ses.format,
                  slot.starts_at, slot.ends_at, rooms.name AS room_name
           FROM session_speakers ss
           JOIN sessions ses ON ses.id = ss.session_id
           LEFT JOIN agenda_slots slot ON slot.session_id = ses.id
           LEFT JOIN rooms ON rooms.id = slot.room_id
           WHERE ss.speaker_id = ?
           ORDER BY slot.starts_at IS NULL, slot.starts_at, ses.title`,
        )
        .bind(speaker.id),
      this.db
        .prepare(
          `SELECT s.*, t.name AS track_name
           FROM submission_speakers ss
           JOIN submissions s ON s.id = ss.submission_id
           LEFT JOIN tracks t ON t.id = s.track_id
           WHERE ss.speaker_id = ?
           ORDER BY s.submitted_at IS NULL, s.submitted_at DESC, s.created_at DESC`,
        )
        .bind(speaker.id),
      this.db
        .prepare(
          `SELECT st.*, td.id AS def_id, td.event_id AS def_event_id, td.key AS def_key,
                  td.label AS def_label, td.description AS def_description,
                  td.applies_to AS def_applies_to, td.due_at AS def_due_at, td.form_id AS def_form_id,
                  td.sort_order AS def_sort_order
           FROM speaker_tasks st
           JOIN task_definitions td ON td.id = st.task_definition_id
           WHERE st.speaker_id = ?
           ORDER BY td.sort_order`,
        )
        .bind(speaker.id),
      this.db.prepare("SELECT * FROM speaker_assets WHERE speaker_id = ? ORDER BY uploaded_at DESC").bind(speaker.id),
      this.db
        .prepare(
          "SELECT * FROM resource_pages WHERE event_id = ? AND is_published = 1 ORDER BY title",
        )
        .bind(speaker.event_id),
      this.db.prepare(
        `SELECT ac.* FROM asset_comments ac
         JOIN speaker_assets sa ON sa.id = ac.asset_id
         WHERE sa.speaker_id = ? ORDER BY ac.created_at, ac.id`,
      ).bind(speaker.id),
      this.db.prepare(
        `SELECT ss.submission_id, ss.sort_order, sp.name, sp.email, sp.company,
                sp.title AS role_label, sp.bio
         FROM submission_speakers ss
         JOIN speakers sp ON sp.id = ss.speaker_id
         WHERE ss.role = 'co_speaker'
           AND ss.submission_id IN (
             SELECT submission_id FROM submission_speakers WHERE speaker_id = ?
           )
         ORDER BY ss.submission_id, ss.sort_order`,
      ).bind(speaker.id),
      // Fields of every portal form this speaker has been assigned, and any
      // answers already saved, so a form task renders and resumes in one trip.
      this.db.prepare(
        `SELECT ff.* FROM form_fields ff
         WHERE ff.form_id IN (
           SELECT td.form_id FROM task_definitions td
           JOIN speaker_tasks st ON st.task_definition_id = td.id
           WHERE st.speaker_id = ? AND td.form_id IS NOT NULL
         )
         ORDER BY ff.form_id, ff.sort_order`,
      ).bind(speaker.id),
      this.db.prepare(
        "SELECT task_definition_id, answers_json FROM task_form_responses WHERE speaker_id = ?",
      ).bind(speaker.id),
    ]);

    const event = ((eventRes?.results ?? []) as unknown as EventRow[])[0];
    if (!event) return null;
    const eventBundle = await this.getEventBySlug(event.slug);

    const portalFields = ((portalFieldsRes?.results ?? []) as unknown as FormFieldRow[]).map(mapFormField);
    const formResponses = new Map<string, Record<string, unknown>>();
    for (const row of (formResponsesRes?.results ?? []) as unknown as {
      task_definition_id: string; answers_json: string;
    }[]) {
      formResponses.set(row.task_definition_id, parseJson<Record<string, unknown>>(row.answers_json, {}));
    }
    const tasks = ((tasksRes?.results ?? []) as unknown as (SpeakerTaskRow & {
      def_id: string;
      def_event_id: string;
      def_key: string;
      def_label: string;
      def_description: string | null;
      def_applies_to: string;
      def_form_id: string | null;
      def_due_at: string | null;
      def_sort_order: number;
    })[]).map((row) => ({
      task: mapSpeakerTask(row),
      definition: mapTaskDefinition({
        id: row.def_id,
        event_id: row.def_event_id,
        key: row.def_key,
        label: row.def_label,
        description: row.def_description,
        applies_to: row.def_applies_to,
        form_id: row.def_form_id,
        due_at: row.def_due_at,
        sort_order: row.def_sort_order,
      }),
      form: row.def_form_id
        ? { fields: portalFields.filter((field) => field.formId === row.def_form_id) }
        : null,
      formResponse: formResponses.get(row.def_id) ?? null,
    }));

    return {
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        tagline: event.tagline,
        startsOn: event.starts_on,
        endsOn: event.ends_on,
        timezone: event.timezone,
      },
      speaker: mapSpeaker(speaker),
      sessions: ((sessionsRes?.results ?? []) as unknown as SpeakerPortalSessionRow[]).map(
        mapPortalSession,
      ),
      proposals: (() => {
        const coSpeakersBySubmission = new Map<string, SpeakerPortalProposal["coSpeakers"]>();
        for (const row of (coSpeakersRes?.results ?? []) as unknown as {
          submission_id: string;
          name: string;
          email: string;
          company: string | null;
          role_label: string | null;
          bio: string | null;
        }[]) {
          const list = coSpeakersBySubmission.get(row.submission_id) ?? [];
          list.push({
            name: row.name,
            email: row.email,
            company: row.company,
            roleLabel: row.role_label,
            bio: row.bio,
          });
          coSpeakersBySubmission.set(row.submission_id, list);
        }
        return ((proposalsRes?.results ?? []) as unknown as (SubmissionRow & {
          track_name: string | null;
        })[]).map((row): SpeakerPortalProposal => ({
          id: row.id,
          title: row.title,
          abstract: row.abstract,
          format: row.format as SpeakerPortalProposal["format"],
          status: row.status as SpeakerPortalProposal["status"],
          answers: parseJson<Record<string, unknown>>(row.answers_json, {}),
          submittedAt: row.submitted_at,
          updatedAt: row.updated_at,
          trackName: row.track_name,
          coSpeakers: coSpeakersBySubmission.get(row.id) ?? [],
        }));
      })(),
      cfp: eventBundle?.cfp ?? null,
      tasks,
      assets: ((assetsRes?.results ?? []) as unknown as SpeakerAssetRow[]).map(mapAsset),
      assetComments: ((commentsRes?.results ?? []) as unknown as AssetCommentRow[]).map(mapAssetComment),
      resources: ((resourcesRes?.results ?? []) as unknown as ResourcePageRow[]).map(
        mapResourcePage,
      ),
    };
  }

  async updateSpeakerProfile(input: UpdateSpeakerProfileInput): Promise<SpeakerPortalBundle> {
    await this.db
      .prepare(
        `UPDATE speakers SET
           name = ?1, company = ?2, title = ?3, bio = ?4,
           location = ?5, socials_json = ?6, updated_at = ?7
         WHERE id = ?8`,
      )
      .bind(
        input.name,
        input.company,
        input.title,
        input.bio,
        input.location,
        input.socials ? JSON.stringify(input.socials) : null,
        input.now,
        input.speakerId,
      )
      .run();
    const portal = await this.getSpeakerPortalByToken(input.speakerId);
    if (!portal) throw new Error("speaker_not_found");
    return portal;
  }

  async updateSpeakerProposal(input: UpdateSpeakerProposalInput): Promise<SpeakerPortalBundle> {
    const result = await this.db
      .prepare(
        `UPDATE submissions
         SET title = ?1, abstract = ?2, answers_json = ?3, updated_at = ?4
         WHERE id = ?5
           AND EXISTS (
             SELECT 1 FROM submission_speakers ss
             WHERE ss.submission_id = submissions.id AND ss.speaker_id = ?6
           )`,
      )
      .bind(
        input.title,
        input.abstract,
        JSON.stringify(input.answers),
        input.now,
        input.submissionId,
        input.speakerId,
      )
      .run();
    if ((result.meta.changes ?? 0) === 0) throw new Error("submission_not_found");

    if (input.coSpeakers) {
      // Replace the co-presenter set; the primary row is never touched. Each
      // co-presenter upserts into speakers by (event_id, email) exactly like
      // the public submit path, so an existing person is reused, not duplicated.
      const eventRow = await this.db
        .prepare("SELECT event_id FROM submissions WHERE id = ?")
        .bind(input.submissionId)
        .first<{ event_id: string }>();
      if (!eventRow) throw new Error("submission_not_found");
      const coSpeakerIds: string[] = [];
      for (const coSpeaker of input.coSpeakers) {
        const row = await this.db.prepare(
          `INSERT INTO speakers (id, event_id, email, name, company, title, bio, location, socials_json, created_at, updated_at)
           VALUES (?1, ?2, lower(?3), ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?8)
           ON CONFLICT(event_id, email) DO UPDATE SET
             name = excluded.name,
             company = COALESCE(excluded.company, speakers.company),
             title = COALESCE(excluded.title, speakers.title),
             bio = COALESCE(excluded.bio, speakers.bio),
             updated_at = excluded.updated_at
           RETURNING id`,
        ).bind(
          randomId("spk"),
          eventRow.event_id,
          coSpeaker.email,
          coSpeaker.name,
          coSpeaker.company ?? null,
          coSpeaker.title ?? null,
          coSpeaker.bio ?? null,
          input.now,
        ).first<{ id: string }>();
        if (!row) throw new Error("Speaker upsert returned no row.");
        coSpeakerIds.push(row.id);
      }
      await this.db.batch([
        this.db.prepare(
          "DELETE FROM submission_speakers WHERE submission_id = ? AND role = 'co_speaker'",
        ).bind(input.submissionId),
        ...coSpeakerIds.map((speakerId, index) => this.db.prepare(
          `INSERT INTO submission_speakers (submission_id, speaker_id, role, sort_order)
           VALUES (?, ?, 'co_speaker', ?)`,
        ).bind(input.submissionId, speakerId, index + 1)),
      ]);
    }

    const portal = await this.getSpeakerPortalByToken(input.speakerId);
    if (!portal) throw new Error("Speaker portal disappeared after update.");
    return portal;
  }

  async getEvaluationWorkspace(eventId: string): Promise<EvaluationWorkspaceResponse> {
    const plan = await this.db
      .prepare("SELECT id, name FROM evaluation_plans WHERE event_id = ? ORDER BY created_at LIMIT 1")
      .bind(eventId)
      .first<{ id: string; name: string }>();
    if (!plan) throw new Error("evaluation_plan_not_found");

    const [roundsRes, criteriaRes, reviewersRes, reviewsRes] = await this.db.batch([
      this.db.prepare("SELECT * FROM evaluation_rounds WHERE plan_id = ? ORDER BY round_number").bind(plan.id),
      this.db.prepare(
        `SELECT rc.* FROM rubric_criteria rc
         WHERE rc.plan_id = ? ORDER BY rc.round_id, rc.sort_order`,
      ).bind(plan.id),
      this.db.prepare(
        `SELECT rr.*,
          (SELECT COUNT(*) FROM review_assignments ra
           WHERE ra.round_id = rr.round_id AND ra.reviewer_email = rr.reviewer_email) AS assigned,
          (SELECT COUNT(*) FROM review_assignments ra
           JOIN reviews rv ON rv.round_id = ra.round_id
             AND rv.submission_id = ra.submission_id
             AND rv.reviewer_email = ra.reviewer_email
             AND rv.recommendation <> 'abstain'
           WHERE ra.round_id = rr.round_id AND ra.reviewer_email = rr.reviewer_email) AS complete,
          (SELECT GROUP_CONCAT(ra.submission_id, ',') FROM review_assignments ra
           WHERE ra.round_id = rr.round_id AND ra.reviewer_email = rr.reviewer_email) AS submission_ids
         FROM round_reviewers rr
         JOIN evaluation_rounds er ON er.id = rr.round_id
         WHERE er.plan_id = ? ORDER BY rr.reviewer_name`,
      ).bind(plan.id),
      this.db.prepare(
        `SELECT rv.round_id, rv.submission_id, rv.scores_json
         FROM reviews rv JOIN evaluation_rounds er ON er.id = rv.round_id
         WHERE er.plan_id = ? AND rv.recommendation <> 'abstain'`,
      ).bind(plan.id),
    ]);

    const roundRows = (roundsRes?.results ?? []) as unknown as Array<{
      id: string; plan_id: string; name: string; round_number: number; status: string;
      opens_at: string | null; closes_at: string | null; blind_mode: number;
    }>;
    const criterionRows = (criteriaRes?.results ?? []) as unknown as Array<{
      id: string; round_id: string | null; key: string; label: string; max_score: number;
      weight: number; sort_order: number;
    }>;
    const reviewerRows = (reviewersRes?.results ?? []) as unknown as Array<{
      round_id: string; reviewer_name: string; reviewer_email: string; reviewer_token: string;
      assignment_cap: number; assigned: number; complete: number; submission_ids: string | null;
    }>;
    const reviewRows = (reviewsRes?.results ?? []) as unknown as Array<{
      round_id: string; submission_id: string; scores_json: string;
    }>;
    const submissions = await this.listSubmissions(eventId);

    const rounds = roundRows.map((round) => ({
      id: round.id,
      planId: round.plan_id,
      name: round.name,
      roundNumber: round.round_number,
      status: round.status as "pending" | "open" | "closed",
      opensAt: round.opens_at,
      closesAt: round.closes_at,
      blindMode: round.blind_mode === 1,
      criteria: criterionRows.filter((criterion) => criterion.round_id === round.id).map((criterion) => ({
        id: criterion.id,
        roundId: round.id,
        key: criterion.key,
        label: criterion.label,
        maxScore: criterion.max_score,
        weight: criterion.weight,
        sortOrder: criterion.sort_order,
      })),
      reviewers: reviewerRows.filter((reviewer) => reviewer.round_id === round.id).map((reviewer) => ({
        name: reviewer.reviewer_name,
        email: reviewer.reviewer_email,
        token: reviewer.reviewer_token,
        assignmentCap: reviewer.assignment_cap,
        assigned: reviewer.assigned,
        complete: reviewer.complete,
        submissionIds: reviewer.submission_ids ? reviewer.submission_ids.split(",") : [],
      })),
    }));

    const results = submissions.map((submission) => {
      const summary = summarizeReviewScores(reviewRows
        .filter((review) => review.submission_id === submission.id)
        .map((review) => {
          const criteria = rounds.find((round) => round.id === review.round_id)?.criteria ?? [];
          return {
            scores: parseJson<Record<string, unknown>>(review.scores_json, {}),
            criteria,
          };
        }));
      return {
        submissionId: submission.id,
        title: submission.title,
        trackName: submission.trackName,
        aggregate: summary.aggregate,
        completedReviews: summary.completedReviews,
      };
    });
    return { plan, rounds, submissions, results };
  }

  async saveEvaluationRound(input: SaveEvaluationRoundInput): Promise<void> {
    const owner = await this.db.prepare(
      "SELECT ep.id FROM evaluation_plans ep WHERE ep.id = ? AND ep.event_id = ?",
    ).bind(input.planId, input.eventId).first<{ id: string }>();
    if (!owner) throw new Error("evaluation_plan_not_found");
    const exists = await this.db.prepare("SELECT id FROM evaluation_rounds WHERE id = ?")
      .bind(input.roundId).first<{ id: string }>();
    const statements = [
      exists
        ? this.db.prepare(
            `UPDATE evaluation_rounds SET name = ?, round_number = ?, status = ?, opens_at = ?, closes_at = ?, blind_mode = ?
             WHERE id = ? AND plan_id = ?`,
          ).bind(input.data.name, input.data.roundNumber, input.data.status, input.data.opensAt,
            input.data.closesAt, input.data.blindMode ? 1 : 0, input.roundId, input.planId)
        : this.db.prepare(
            `INSERT INTO evaluation_rounds
             (id, plan_id, name, round_number, status, opens_at, closes_at, blind_mode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(input.roundId, input.planId, input.data.name, input.data.roundNumber,
            input.data.status, input.data.opensAt, input.data.closesAt, input.data.blindMode ? 1 : 0),
      this.db.prepare("DELETE FROM rubric_criteria WHERE round_id = ?").bind(input.roundId),
      ...input.data.criteria.map((criterion, index) => this.db.prepare(
        `INSERT INTO rubric_criteria
         (id, plan_id, round_id, key, label, description, max_score, weight, sort_order)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      ).bind(input.criterionIds[index], input.planId, input.roundId, criterion.key,
        criterion.label, criterion.maxScore, criterion.weight, index)),
    ];
    await this.db.batch(statements);
  }

  async saveRoundReviewer(input: SaveRoundReviewerInput): Promise<void> {
    await this.db.prepare(
      `INSERT INTO round_reviewers
       (round_id, reviewer_name, reviewer_email, reviewer_token, assignment_cap, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(round_id, reviewer_email) DO UPDATE SET
         reviewer_name = excluded.reviewer_name,
         assignment_cap = excluded.assignment_cap`,
    ).bind(input.roundId, input.name, input.email.toLowerCase(), input.token,
      input.assignmentCap, input.now).run();
  }

  async saveAssignments(input: SaveAssignmentsInput): Promise<void> {
    const reviewer = await this.db.prepare(
      "SELECT assignment_cap FROM round_reviewers WHERE round_id = ? AND reviewer_email = ?",
    ).bind(input.roundId, input.reviewerEmail.toLowerCase()).first<{ assignment_cap: number }>();
    if (!reviewer) throw new Error("reviewer_not_found");
    const uniqueIds = [...new Set(input.submissionIds)];
    if (uniqueIds.length > reviewer.assignment_cap) throw new Error("assignment_cap_exceeded");
    await this.db.batch([
      this.db.prepare("DELETE FROM review_assignments WHERE round_id = ? AND reviewer_email = ?")
        .bind(input.roundId, input.reviewerEmail.toLowerCase()),
      ...uniqueIds.map((submissionId) => this.db.prepare(
        `INSERT INTO review_assignments (round_id, reviewer_email, submission_id, assigned_at)
         SELECT ?, ?, s.id, ? FROM submissions s
         JOIN evaluation_rounds er ON er.id = ?
         JOIN evaluation_plans ep ON ep.id = er.plan_id AND ep.event_id = s.event_id
         WHERE s.id = ?`,
      ).bind(input.roundId, input.reviewerEmail.toLowerCase(), input.now, input.roundId, submissionId)),
    ]);
  }

  async autoDistributeAssignments(roundId: string, now: string): Promise<void> {
    const reviewers = await this.db.prepare(
      `SELECT reviewer_email, assignment_cap,
        (SELECT COUNT(*) FROM review_assignments ra WHERE ra.round_id = rr.round_id
          AND ra.reviewer_email = rr.reviewer_email) AS assigned
       FROM round_reviewers rr WHERE round_id = ? ORDER BY reviewer_email`,
    ).bind(roundId).all<{ reviewer_email: string; assignment_cap: number; assigned: number }>();
    const submissions = await this.db.prepare(
      `SELECT s.id FROM submissions s
       JOIN evaluation_rounds er ON er.id = ?
       JOIN evaluation_plans ep ON ep.id = er.plan_id AND ep.event_id = s.event_id
       WHERE s.status NOT IN ('draft','withdrawn')
         AND NOT EXISTS (SELECT 1 FROM review_assignments ra WHERE ra.round_id = ? AND ra.submission_id = s.id)
       ORDER BY s.submitted_at, s.id`,
    ).bind(roundId, roundId).all<{ id: string }>();
    const pool = (reviewers.results ?? []).map((reviewer) => ({ ...reviewer }));
    const statements: D1PreparedStatement[] = [];
    let cursor = 0;
    for (const submission of submissions.results ?? []) {
      let selected = -1;
      for (let offset = 0; offset < pool.length; offset += 1) {
        const index = (cursor + offset) % pool.length;
        if (pool[index]!.assigned < pool[index]!.assignment_cap) { selected = index; break; }
      }
      if (selected < 0) break;
      const reviewer = pool[selected]!;
      statements.push(this.db.prepare(
        "INSERT OR IGNORE INTO review_assignments (round_id, reviewer_email, submission_id, assigned_at) VALUES (?, ?, ?, ?)",
      ).bind(roundId, reviewer.reviewer_email, submission.id, now));
      reviewer.assigned += 1;
      cursor = (selected + 1) % pool.length;
    }
    if (statements.length > 0) await this.db.batch(statements);
  }

  async getReviewerQueue(token: string): Promise<ReviewerQueueResponse | null> {
    const reviewer = await this.db.prepare(
      "SELECT reviewer_name, reviewer_email, reviewer_token FROM round_reviewers WHERE reviewer_token = ?",
    ).bind(token).first<{ reviewer_name: string; reviewer_email: string; reviewer_token: string }>();
    if (!reviewer) return null;
    const [assignmentsRes, criteriaRes, speakersRes] = await this.db.batch([
      this.db.prepare(
        `SELECT ra.round_id, er.name AS round_name, er.blind_mode, s.*, t.name AS track_name,
                rv.scores_json, rv.overall_comment, rv.recommendation, rv.submitted_at AS review_submitted_at
         FROM review_assignments ra
         JOIN round_reviewers rr ON rr.round_id = ra.round_id AND rr.reviewer_email = ra.reviewer_email
         JOIN evaluation_rounds er ON er.id = ra.round_id
         JOIN submissions s ON s.id = ra.submission_id
         LEFT JOIN tracks t ON t.id = s.track_id
         LEFT JOIN reviews rv ON rv.round_id = ra.round_id AND rv.submission_id = ra.submission_id
           AND rv.reviewer_email = ra.reviewer_email
         WHERE ra.reviewer_email = ? AND rr.reviewer_token = ?
           AND (rv.recommendation IS NULL OR rv.recommendation <> 'abstain')
           AND er.status = 'open'
         ORDER BY er.round_number, s.title`,
      ).bind(reviewer.reviewer_email, token),
      this.db.prepare(
        `SELECT rc.* FROM rubric_criteria rc
         JOIN round_reviewers rr ON rr.round_id = rc.round_id
         WHERE rr.reviewer_email = ? AND rr.reviewer_token = ? ORDER BY rc.round_id, rc.sort_order`,
      ).bind(reviewer.reviewer_email, token),
      this.db.prepare(
        `SELECT ra.round_id, ss.submission_id, ss.role, ss.sort_order, sp.id AS speaker_id,
                sp.name, sp.email, sp.company, sp.title AS role_label, sp.bio
         FROM review_assignments ra
         JOIN submission_speakers ss ON ss.submission_id = ra.submission_id
         JOIN speakers sp ON sp.id = ss.speaker_id
         JOIN evaluation_rounds er ON er.id = ra.round_id AND er.blind_mode = 0
         JOIN round_reviewers rr ON rr.round_id = ra.round_id AND rr.reviewer_email = ra.reviewer_email
         WHERE rr.reviewer_email = ? AND rr.reviewer_token = ?
         ORDER BY ss.submission_id, ss.sort_order`,
      ).bind(reviewer.reviewer_email, token),
    ]);
    const assignments = (assignmentsRes?.results ?? []) as unknown as Array<SubmissionRow & {
      round_id: string; round_name: string; blind_mode: number; track_name: string | null;
      scores_json: string | null; overall_comment: string | null; recommendation: string | null;
      review_submitted_at: string | null;
    }>;
    const criteria = (criteriaRes?.results ?? []) as unknown as Array<{
      id: string; round_id: string; key: string; label: string; max_score: number; weight: number; sort_order: number;
    }>;
    const speakerRows = (speakersRes?.results ?? []) as unknown as Array<SubmissionSpeakerLinkRow & { round_id: string; role_label: string | null }>;
    return {
      reviewer: { name: reviewer.reviewer_name, email: reviewer.reviewer_email, token },
      assignments: assignments.map((row) => ({
        id: row.id,
        title: row.title,
        abstract: row.abstract,
        format: row.format as SpeakerPortalProposal["format"],
        status: row.status as SpeakerPortalProposal["status"],
        answers: parseJson<Record<string, unknown>>(row.answers_json, {}),
        submittedAt: row.submitted_at,
        updatedAt: row.updated_at,
        trackName: row.track_name,
        roundId: row.round_id,
        roundName: row.round_name,
        blindMode: row.blind_mode === 1,
        ...(row.blind_mode === 1 ? {} : { speakers: speakerRows
          .filter((speaker) => speaker.round_id === row.round_id && speaker.submission_id === row.id)
          .map((speaker) => ({
            speakerId: speaker.speaker_id, role: speaker.role as SubmissionSpeakerView["role"],
            sortOrder: speaker.sort_order, name: speaker.name, email: speaker.email,
            company: speaker.company, roleLabel: speaker.role_label ?? null, bio: speaker.bio,
          })) }),
        criteria: criteria.filter((criterion) => criterion.round_id === row.round_id).map((criterion) => ({
          id: criterion.id, roundId: row.round_id, key: criterion.key, label: criterion.label,
          maxScore: criterion.max_score, weight: criterion.weight, sortOrder: criterion.sort_order,
        })),
        existingReview: row.recommendation && row.review_submitted_at ? {
          scores: parseJson<Record<string, number>>(row.scores_json, {}),
          recommendation: row.recommendation as "accept" | "reject" | "waitlist" | "abstain",
          comment: row.overall_comment,
          submittedAt: row.review_submitted_at,
        } : null,
      })),
    };
  }

  async submitReviewerScorecard(input: SubmitReviewerScorecardInput): Promise<void> {
    const assignment = await this.db.prepare(
      `SELECT rr.reviewer_name, rr.reviewer_email
       FROM round_reviewers rr
       JOIN review_assignments ra ON ra.round_id = rr.round_id AND ra.reviewer_email = rr.reviewer_email
       JOIN evaluation_rounds er ON er.id = rr.round_id AND er.status = 'open'
       WHERE rr.reviewer_token = ? AND rr.round_id = ? AND ra.submission_id = ?`,
    ).bind(input.token, input.roundId, input.submissionId)
      .first<{ reviewer_name: string; reviewer_email: string }>();
    if (!assignment) throw new Error("review_assignment_not_found");
    await this.db.prepare(
      `INSERT INTO reviews
       (id, round_id, submission_id, reviewer_name, reviewer_email, scores_json,
        overall_comment, recommendation, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(round_id, submission_id, reviewer_email) DO UPDATE SET
         scores_json = excluded.scores_json, overall_comment = excluded.overall_comment,
         recommendation = excluded.recommendation, submitted_at = excluded.submitted_at`,
    ).bind(input.id, input.roundId, input.submissionId, assignment.reviewer_name,
      assignment.reviewer_email, JSON.stringify(input.scores), input.comment,
      input.recuse ? "abstain" : input.recommendation, input.now).run();
  }

  async updateSpeakerTask(input: UpdateSpeakerTaskInput): Promise<SpeakerPortalBundle> {
    const task = await this.db
      .prepare("SELECT id FROM speaker_tasks WHERE id = ?1 AND speaker_id = ?2")
      .bind(input.taskId, input.speakerId)
      .first<{ id: string }>();
    if (!task) throw new Error("task_not_found");

    await this.db
      .prepare(
        `UPDATE speaker_tasks SET status = ?1, completed_at = ?2, updated_at = ?3
         WHERE id = ?4 AND speaker_id = ?5`,
      )
      .bind(
        input.status,
        input.status === "complete" ? input.now : null,
        input.now,
        input.taskId,
        input.speakerId,
      )
      .run();
    const portal = await this.getSpeakerPortalByToken(input.speakerId);
    if (!portal) throw new Error("speaker_not_found");
    return portal;
  }

  async simulateCommunication(input: SimulateCommunicationInput) {
    await this.db.prepare(
      `INSERT INTO messages
         (id, event_id, template_id, speaker_id, to_email, subject, body_md, status, created_at)
       VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, 'queued', ?7)`,
    ).bind(
      input.messageId, input.eventId, input.speakerId, input.toEmail,
      input.subject, input.bodyMd, input.now,
    ).run();

    const delivery = await this.emailDelivery.send({
      messageId: input.messageId,
      toEmail: input.toEmail,
      subject: input.subject,
      bodyMd: input.bodyMd,
    });
    await this.db.batch([
      this.db.prepare("UPDATE messages SET status = ?1 WHERE id = ?2")
        .bind(delivery.messageStatus, input.messageId),
      this.db.prepare(
        `INSERT INTO delivery_attempts
           (id, message_id, attempted_at, mode, status, provider_id, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(
        input.attemptId, input.messageId, input.now, delivery.mode,
        delivery.status, delivery.providerId, delivery.error,
      ),
    ]);
    return delivery;
  }

  async queueDueTaskReminders(now: string, dueBefore: string): Promise<{ queued: number; taskIds: string[] }> {
    const rows = await this.db.prepare(
      `SELECT st.id AS task_id, st.event_id, sp.id AS speaker_id, sp.email, sp.name AS speaker_name,
              td.label AS task_label, td.due_at, e.name AS event_name
       FROM speaker_tasks st
       JOIN task_definitions td ON td.id = st.task_definition_id
       JOIN speakers sp ON sp.id = st.speaker_id AND sp.event_id = st.event_id
       JOIN events e ON e.id = st.event_id
       WHERE st.status != 'complete' AND td.due_at IS NOT NULL AND td.due_at <= ?1
       ORDER BY td.due_at, st.id`,
    ).bind(dueBefore).all<{
      task_id: string; event_id: string; speaker_id: string; email: string; speaker_name: string;
      task_label: string; due_at: string; event_name: string;
    }>();
    const candidates = rows.results ?? [];
    if (candidates.length === 0) return { queued: 0, taskIds: [] };

    const taskIds: string[] = [];
    for (const row of candidates) {
      const suffix = `${row.task_id}_${row.due_at}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const messageId = `msg_auto_due_${suffix}`;
      const subject = `Reminder: ${row.task_label} is due`;
      const bodyMd = `Hi ${row.speaker_name},\n\nYour ${row.task_label} task for ${row.event_name} is incomplete and was due ${row.due_at}.\n\nOpen your speaker portal to complete it.`;
      const reserved = await this.db.prepare(
        `INSERT OR IGNORE INTO messages
           (id, event_id, template_id, speaker_id, to_email, subject, body_md, status, created_at)
         VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, 'queued', ?7)`,
      ).bind(messageId, row.event_id, row.speaker_id, row.email, subject, bodyMd, now).run();
      if ((reserved.meta.changes ?? 0) === 0) continue;

      const delivery = await this.emailDelivery.send({
        messageId, toEmail: row.email, subject, bodyMd,
      });
      await this.db.batch([
        this.db.prepare("UPDATE messages SET status = ?1 WHERE id = ?2")
          .bind(delivery.messageStatus, messageId),
        this.db.prepare(
          `INSERT INTO delivery_attempts
             (id, message_id, attempted_at, mode, status, provider_id, error)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(
          `del_auto_due_${suffix}`, messageId, now, delivery.mode,
          delivery.status, delivery.providerId, delivery.error,
        ),
      ]);
      taskIds.push(row.task_id);
    }
    return { queued: taskIds.length, taskIds };
  }

  /**
   * The other half of "Set a close date to enable draft reminder emails": a
   * saved draft is worthless once the call closes, so anyone still holding one
   * hears about it while there is still time to submit. SQL only narrows the
   * field; shouldRemindDraft decides, and cfp_drafts.reminded_at is what makes
   * a six-hourly sweep send exactly one reminder per draft.
   */
  async queueDraftCloseReminders(now: string, closesBefore: string): Promise<QueueDraftCloseRemindersResult> {
    const rows = await this.db.prepare(
      `SELECT d.token, d.event_id, d.payload_json, d.reminded_at,
              f.closes_at, e.name AS event_name, e.slug AS event_slug
       FROM cfp_drafts d
       JOIN forms f ON f.id = d.form_id
       JOIN events e ON e.id = d.event_id
       WHERE d.reminded_at IS NULL AND f.closes_at IS NOT NULL
         AND f.closes_at > ?1 AND f.closes_at <= ?2
       ORDER BY f.closes_at, d.token`,
    ).bind(now, closesBefore).all<{
      token: string; event_id: string; payload_json: string; reminded_at: string | null;
      closes_at: string; event_name: string; event_slug: string;
    }>();
    const candidates = rows.results ?? [];
    if (candidates.length === 0) return { queued: 0, tokens: [] };

    const tokens: string[] = [];
    for (const row of candidates) {
      const parsed = CfpDraftRequest.safeParse(parseJson<unknown>(row.payload_json, null));
      if (!parsed.success) continue;
      const email = parsed.data.speaker?.email?.trim() ?? null;
      if (!shouldRemindDraft({ email, closesAt: row.closes_at, remindedAt: row.reminded_at }, now)) continue;
      if (!email) continue; // Already refused above; this keeps the type honest.

      const suffix = `${row.token}_${row.closes_at}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const closeDate = new Date(row.closes_at).toLocaleDateString("en-US", {
        dateStyle: "long",
        timeZone: "UTC",
      });
      // The same return link the draft API hands the browser, so a proposer
      // lands back on their own saved answers.
      const resumeUrl = `/e/${encodeURIComponent(row.event_slug)}/cfp?draft=${encodeURIComponent(row.token)}`;
      await this.simulateCommunication({
        messageId: `msg_draft_close_${suffix}`,
        attemptId: `del_draft_close_${suffix}`,
        eventId: row.event_id,
        // A draft holder is nobody's speaker yet — there is no record to point at.
        speakerId: null,
        toEmail: email,
        subject: `Your draft for ${row.event_name} is not submitted yet`,
        bodyMd: `Hi ${parsed.data.speaker?.name?.trim() || "there"},\n\n“${parsed.data.title}” is still a draft for ${row.event_name}, and drafts are never reviewed. The call for speakers closes on ${closeDate}.\n\nFinish and submit it here: ${resumeUrl}`,
        now,
      });
      await this.db.prepare(
        "UPDATE cfp_drafts SET reminded_at = ?1 WHERE token = ?2 AND reminded_at IS NULL",
      ).bind(now, row.token).run();
      tokens.push(row.token);
    }
    return { queued: tokens.length, tokens };
  }

  /**
   * "What admins should be notified when a new submission is received?" — one
   * receipted message per configured address. Deterministic ids keyed on the
   * submission, because the caller cannot know how many admins a form has.
   */
  async notifySubmissionAdmins(input: NotifySubmissionAdminsInput): Promise<NotifySubmissionAdminsResult> {
    const row = await this.db.prepare(
      `SELECT f.notify_emails, e.name AS event_name
       FROM forms f JOIN events e ON e.id = f.event_id
       WHERE f.id = ?1 AND f.event_id = ?2`,
    ).bind(input.formId, input.eventId).first<{ notify_emails: string | null; event_name: string }>();
    if (!row) return { notified: 0, recipientEmails: [] };

    const recipients = parseNotifyEmails(row.notify_emails);
    if (recipients.length === 0) return { notified: 0, recipientEmails: [] };

    const code = input.referenceCode ?? input.submissionId;
    for (const [index, toEmail] of recipients.entries()) {
      await this.simulateCommunication({
        messageId: `msg_admin_new_${input.submissionId}_${index}`,
        attemptId: `del_admin_new_${input.submissionId}_${index}`,
        eventId: input.eventId,
        speakerId: null,
        toEmail,
        subject: `New submission ${code}: ${input.title}`,
        bodyMd: `${input.submitterName} submitted “${input.title}” to ${row.event_name}.\n\nReference: ${code}\nSubmitter: ${input.submitterName} <${input.submitterEmail}>\n\nOpen the submissions queue to review it.`,
        now: input.now,
      });
    }
    return { notified: recipients.length, recipientEmails: recipients };
  }

  async listMessages(eventId: string): Promise<OutboxMessage[]> {
    const rows = await this.db.prepare(
      `SELECT m.id, m.to_email, m.subject, m.status, m.created_at,
              (SELECT da.status FROM delivery_attempts da WHERE da.message_id = m.id
               ORDER BY da.attempted_at DESC LIMIT 1) AS delivery_status
       FROM messages m WHERE m.event_id = ? ORDER BY m.created_at DESC, m.id DESC`,
    ).bind(eventId).all<{
      id: string; to_email: string | null; subject: string; status: string;
      created_at: string; delivery_status: string | null;
    }>();
    return (rows.results ?? []).map((row) => ({
      id: row.id, toEmail: row.to_email, subject: row.subject,
      status: row.status as OutboxMessage["status"], createdAt: row.created_at,
      deliveryStatus: row.delivery_status as OutboxMessage["deliveryStatus"],
    }));
  }

  async createSpeakerAsset(input: CreateSpeakerAssetInput): Promise<SpeakerAsset> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO speaker_assets
           (id, speaker_id, kind, filename, content_type, size_bytes, r2_key, task_id, session_id, version_number, uploaded_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
             COALESCE(MAX(version_number), 0) + 1, ?10
           FROM speaker_assets
           WHERE speaker_id = ?2 AND kind = ?3
             AND COALESCE(task_id, '') = COALESCE(?8, '')
             AND COALESCE(session_id, '') = COALESCE(?9, '')`,
        )
        .bind(
          input.id,
          input.speakerId,
          input.kind,
          input.filename,
          input.contentType,
          input.sizeBytes,
          input.r2Key,
          input.taskId,
          input.sessionId,
          input.uploadedAt,
        ),
      // Delivering the file IS doing the task. A speaker who uploads their
      // slides should not also have to tick "Upload draft slides" — leaving
      // it pending makes the checklist lie about work already done. Matched
      // on task_definitions.key = asset kind ('headshot', 'slides'), so an
      // event whose checklist uses other keys simply auto-completes nothing.
      this.db
        .prepare(
          `UPDATE speaker_tasks
              SET status = 'complete', completed_at = ?3, updated_at = ?3
            WHERE speaker_id = ?1
              AND status <> 'complete'
              AND (id = ?4 OR (?4 IS NULL AND task_definition_id IN (
                SELECT id FROM task_definitions WHERE key = ?2
              )))`,
        )
        .bind(input.speakerId, input.kind, input.uploadedAt, input.taskId),
    ]);
    const created = await this.getSpeakerAssetById(input.id);
    if (!created) throw new Error("Asset not found after insert.");
    return created;
  }

  async getSpeakerAssetById(id: string): Promise<SpeakerAsset | null> {
    const row = await this.db
      .prepare("SELECT * FROM speaker_assets WHERE id = ?")
      .bind(id)
      .first<SpeakerAssetRow>();
    return row ? mapAsset(row) : null;
  }

  async createAssetComment(input: CreateAssetCommentInput): Promise<AssetComment> {
    await this.db.prepare(
      `INSERT INTO asset_comments (id, asset_id, author_role, author_name, body, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(input.id, input.assetId, input.authorRole, input.authorName, input.body, input.now).run();
    return {
      id: input.id,
      assetId: input.assetId,
      authorRole: input.authorRole,
      authorName: input.authorName,
      body: input.body,
      createdAt: input.now,
    };
  }
}
