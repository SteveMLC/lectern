import type {
  AgendaSlot,
  ConditionalRule,
  Event,
  EventBundle,
  EventCounts,
  EventSummary,
  Form,
  FormField,
  OrganizerAgendaResponse,
  OrganizerSession,
  PublicScheduleResponse,
  PublicSession,
  PublicSessionsResponse,
  PublicSessionSpeaker,
  PublicSpeaker,
  PublicSpeakersResponse,
  ResourcePage,
  Room,
  Session,
  Speaker,
  SpeakerAsset,
  SpeakerTask,
  SubmissionListItem,
  SubmissionSpeakerView,
  SubmissionStatus,
  TaskDefinition,
  Track,
} from "../../../shared/contracts";
import type {
  CreateDirectSessionInput,
  CreateCfpSubmissionInput,
  CreateSpeakerAssetInput,
  DecideSubmissionInput,
  SpeakerPortalBundle,
  SpeakerPortalSession,
  SpeakerOpsRepo,
  SubmissionDecisionResult,
  UpsertAgendaSlotInput,
  UpdateSpeakerProfileInput,
  UpdateSpeakerTaskInput,
} from "../types";
import { buildDirectSession, buildSessionFromSubmission } from "../../../shared/domain/acceptance";
import { canApplyDecision, statusForDecision } from "../../../shared/domain/decisions";
import { findScheduleConflicts } from "../../../shared/domain/schedule";

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
  created_at: string;
  updated_at: string;
}

interface SubmissionRow {
  id: string;
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
  created_at: string;
  updated_at: string;
}

interface OrganizerSessionRow extends SessionRow {
  track_name: string | null;
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
  uploaded_at: string;
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
    socials: parseJson<Speaker["socials"]>(r.socials_json, null),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPublicSpeaker(r: SpeakerRow): PublicSpeaker {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    title: r.title,
    bio: r.bio,
    location: r.location,
    socials: parseJson<PublicSpeaker["socials"]>(r.socials_json, null),
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
    uploadedAt: r.uploaded_at,
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

function mapSubmissionListItem(
  r: SubmissionRow & { track_name: string | null },
  speakers: SubmissionSpeakerView[],
): SubmissionListItem {
  return {
    id: r.id,
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

export class D1Repo implements SpeakerOpsRepo {
  constructor(private readonly db: D1Database) {}

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
           WHERE s.event_id = ? AND s.status = 'confirmed'
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
           WHERE s.event_id = ? AND s.status = 'confirmed'
           ORDER BY ss.session_id, ss.sort_order`,
        )
        .bind(event.id),
      this.db
        .prepare(
          `SELECT a.id, a.starts_at, a.ends_at, a.room_id, r.name AS room_name, a.session_id
           FROM agenda_slots a
           JOIN sessions s ON s.id = a.session_id
           LEFT JOIN rooms r ON r.id = a.room_id
           WHERE a.event_id = ? AND s.status = 'confirmed'
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

  async getEventBySlug(slug: string): Promise<EventBundle | null> {
    const event = await this.db
      .prepare("SELECT * FROM events WHERE slug = ?")
      .bind(slug)
      .first<EventRow>();
    if (!event) return null;

    const [tracksRes, roomsRes, formRes] = await this.db.batch([
      this.db.prepare("SELECT * FROM tracks WHERE event_id = ? ORDER BY sort_order").bind(event.id),
      this.db.prepare("SELECT * FROM rooms WHERE event_id = ? ORDER BY sort_order").bind(event.id),
      this.db
        .prepare("SELECT * FROM forms WHERE event_id = ? AND kind = 'cfp' ORDER BY created_at LIMIT 1")
        .bind(event.id),
    ]);

    const tracks = (tracksRes?.results ?? []) as unknown as TrackRow[];
    const rooms = (roomsRes?.results ?? []) as unknown as RoomRow[];
    const formRow = ((formRes?.results ?? []) as unknown as FormRow[])[0];

    let cfp: EventBundle["cfp"] = null;
    if (formRow) {
      const [fieldsRes, rulesRes] = await this.db.batch([
        this.db
          .prepare("SELECT * FROM form_fields WHERE form_id = ? ORDER BY sort_order")
          .bind(formRow.id),
        this.db.prepare("SELECT * FROM conditional_rules WHERE form_id = ?").bind(formRow.id),
      ]);
      cfp = {
        form: mapForm(formRow),
        fields: ((fieldsRes?.results ?? []) as unknown as FormFieldRow[]).map(mapFormField),
        rules: ((rulesRes?.results ?? []) as unknown as ConditionalRuleRow[]).map(mapRule),
      };
    }

    return {
      event: mapEvent(event),
      tracks: tracks.map(mapTrack),
      rooms: rooms.map(mapRoom),
      cfp,
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

    const { results } = await this.db
      .prepare(
        `SELECT sp.*
         FROM speakers sp
         WHERE EXISTS (
           SELECT 1
           FROM session_speakers ss
           JOIN sessions s ON s.id = ss.session_id
           WHERE ss.speaker_id = sp.id
             AND s.event_id = ?
             AND s.status = 'confirmed'
         )
         ORDER BY sp.name`,
      )
      .bind(event.id)
      .all<SpeakerRow>();

    return {
      event: mapEventSummary(event),
      speakers: results.map(mapPublicSpeaker),
    };
  }

  async createCfpSubmission(input: CreateCfpSubmissionInput): Promise<SubmissionListItem> {
    const speakerRow = await this.db
      .prepare(
        `INSERT INTO speakers (id, event_id, email, name, company, title, bio, location, socials_json, created_at, updated_at)
         VALUES (?1, ?2, lower(?3), ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?8)
         ON CONFLICT(event_id, email) DO UPDATE SET
           name = excluded.name,
           company = COALESCE(excluded.company, speakers.company),
           title = COALESCE(excluded.title, speakers.title),
           bio = COALESCE(excluded.bio, speakers.bio),
           updated_at = excluded.updated_at
         RETURNING id`,
      )
      .bind(
        input.speakerId,
        input.eventId,
        input.speaker.email,
        input.speaker.name,
        input.speaker.company ?? null,
        input.speaker.title ?? null,
        input.speaker.bio ?? null,
        input.now,
      )
      .first<{ id: string }>();
    if (!speakerRow) throw new Error("Speaker upsert returned no row.");

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO submissions (id, event_id, form_id, track_id, title, abstract, format, status, answers_json, submitted_at, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'submitted', ?8, ?9, ?9, ?9)`,
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
      this.db
        .prepare(
          `INSERT INTO submission_speakers (submission_id, speaker_id, role, sort_order)
           VALUES (?1, ?2, 'primary', 0)`,
        )
        .bind(input.submissionId, speakerRow.id),
    ]);

    const created = await this.getSubmissionById(input.submissionId);
    if (!created) throw new Error("Submission not found after insert.");
    return created;
  }

  async listSubmissions(eventId: string): Promise<SubmissionListItem[]> {
    const [subsRes, linksRes] = await this.db.batch([
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
          `SELECT ss.submission_id, ss.role, ss.sort_order, sp.id AS speaker_id, sp.name, sp.email, sp.company
           FROM submission_speakers ss
           JOIN speakers sp ON sp.id = ss.speaker_id
           JOIN submissions s ON s.id = ss.submission_id
           WHERE s.event_id = ?
           ORDER BY ss.submission_id, ss.sort_order`,
        )
        .bind(eventId),
    ]);

    const subs = (subsRes?.results ?? []) as unknown as (SubmissionRow & {
      track_name: string | null;
    })[];
    const links = (linksRes?.results ?? []) as unknown as SubmissionSpeakerLinkRow[];

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
      });
      speakersBySubmission.set(link.submission_id, list);
    }

    return subs.map((row) => mapSubmissionListItem(row, speakersBySubmission.get(row.id) ?? []));
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
        `SELECT ss.submission_id, ss.role, ss.sort_order, sp.id AS speaker_id, sp.name, sp.email, sp.company
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
    }));

    return mapSubmissionListItem(row, speakers);
  }

  async decideSubmission(input: DecideSubmissionInput): Promise<SubmissionDecisionResult> {
    const submission = await this.getSubmissionById(input.submissionId);
    if (!submission) throw new Error("submission_not_found");
    if (!canApplyDecision(submission.status, input.decision)) {
      throw new Error("invalid_decision_transition");
    }

    const targetStatus = statusForDecision(input.decision);
    if (input.decision !== "approve") {
      await this.db
        .prepare("UPDATE submissions SET status = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(targetStatus, input.now, submission.id)
        .run();
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
          `SELECT s.*, t.name AS track_name
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
    ]);

    const agenda = await this.getOrganizerAgenda(input.eventId);
    const created = agenda.sessions.find((session) => session.id === input.id);
    if (!created) throw new Error("Direct session not found after insert.");
    return created;
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
    // Demo magic-link stub: until Lane C/D adds real one-time tokens, the token
    // is the seeded speaker id (for example, spk_ada).
    const speaker = await this.db
      .prepare("SELECT * FROM speakers WHERE id = ?")
      .bind(token)
      .first<SpeakerRow>();
    if (!speaker) return null;

    const [eventRes, sessionsRes, tasksRes, assetsRes, resourcesRes] = await this.db.batch([
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
          `SELECT st.*, td.id AS def_id, td.event_id AS def_event_id, td.key AS def_key,
                  td.label AS def_label, td.description AS def_description,
                  td.applies_to AS def_applies_to, td.due_at AS def_due_at,
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
    ]);

    const event = ((eventRes?.results ?? []) as unknown as EventRow[])[0];
    if (!event) return null;

    const tasks = ((tasksRes?.results ?? []) as unknown as (SpeakerTaskRow & {
      def_id: string;
      def_event_id: string;
      def_key: string;
      def_label: string;
      def_description: string | null;
      def_applies_to: string;
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
        due_at: row.def_due_at,
        sort_order: row.def_sort_order,
      }),
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
      tasks,
      assets: ((assetsRes?.results ?? []) as unknown as SpeakerAssetRow[]).map(mapAsset),
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

  async createSpeakerAsset(input: CreateSpeakerAssetInput): Promise<SpeakerAsset> {
    await this.db
      .prepare(
        `INSERT INTO speaker_assets (id, speaker_id, kind, filename, content_type, size_bytes, r2_key, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        input.id,
        input.speakerId,
        input.kind,
        input.filename,
        input.contentType,
        input.sizeBytes,
        input.r2Key,
        input.uploadedAt,
      )
      .run();
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
}
