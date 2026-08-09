import type {
  ConditionalRule,
  Event,
  EventBundle,
  EventCounts,
  EventSummary,
  Form,
  FormField,
  Room,
  Speaker,
  SpeakerAsset,
  SubmissionListItem,
  SubmissionSpeakerView,
  SubmissionStatus,
  Track,
} from "../../../shared/contracts";
import type {
  CreateCfpSubmissionInput,
  CreateSpeakerAssetInput,
  SpeakerOpsRepo,
} from "../types";

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
