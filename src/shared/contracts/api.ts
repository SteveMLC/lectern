import { z } from "zod";
import {
  AgendaSlot,
  ConditionalRule,
  Event,
  Form,
  FormField,
  Room,
  Session,
  SessionFormat,
  SpeakerAsset,
  SpeakerRole,
  Submission,
  SubmissionStatus,
  Track,
} from "./entities";

/**
 * API request/response contracts. The worker validates requests with these
 * schemas and the web app validates responses with them, so drift between the
 * two fails loudly instead of quietly.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const HealthResponse = z.object({
  ok: z.boolean(),
  service: z.literal("speakerops"),
  version: z.string(),
  dataBackend: z.enum(["d1", "airtable"]),
  time: z.iso.datetime({ offset: true }),
  checks: z.object({
    db: z.boolean(),
    r2Bound: z.boolean(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const EventSummary = Event.pick({
  id: true,
  slug: true,
  name: true,
  tagline: true,
  startsOn: true,
  endsOn: true,
  timezone: true,
});
export type EventSummary = z.infer<typeof EventSummary>;

export const EventsListResponse = z.object({
  events: z.array(EventSummary),
});
export type EventsListResponse = z.infer<typeof EventsListResponse>;

/** Everything the public event + CFP pages need in one round trip. */
export const EventBundle = z.object({
  event: Event,
  tracks: z.array(Track),
  rooms: z.array(Room),
  cfp: z
    .object({
      form: Form,
      fields: z.array(FormField),
      rules: z.array(ConditionalRule),
    })
    .nullable(),
});
export type EventBundle = z.infer<typeof EventBundle>;

// ---------------------------------------------------------------------------
// Public embeds
// ---------------------------------------------------------------------------

export const PublicSpeaker = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  socials: z.record(z.string(), z.string()).nullable(),
});
export type PublicSpeaker = z.infer<typeof PublicSpeaker>;

export const PublicSessionSpeaker = PublicSpeaker.pick({
  id: true,
  name: true,
  company: true,
  title: true,
}).extend({
  role: SpeakerRole,
  sortOrder: z.number().int(),
});
export type PublicSessionSpeaker = z.infer<typeof PublicSessionSpeaker>;

export const PublicSession = Session.pick({
  id: true,
  title: true,
  abstract: true,
  format: true,
  status: true,
  origin: true,
}).extend({
  track: Track.pick({ id: true, name: true, color: true }).nullable(),
  speakers: z.array(PublicSessionSpeaker),
});
export type PublicSession = z.infer<typeof PublicSession>;

export const PublicScheduleSlot = AgendaSlot.pick({
  id: true,
  startsAt: true,
  endsAt: true,
}).extend({
  room: Room.pick({ id: true, name: true }).nullable(),
  session: PublicSession,
});
export type PublicScheduleSlot = z.infer<typeof PublicScheduleSlot>;

export const PublicScheduleResponse = z.object({
  event: EventSummary,
  timezone: z.string(),
  slots: z.array(PublicScheduleSlot),
});
export type PublicScheduleResponse = z.infer<typeof PublicScheduleResponse>;

export const PublicSessionsResponse = z.object({
  event: EventSummary,
  sessions: z.array(PublicSession),
});
export type PublicSessionsResponse = z.infer<typeof PublicSessionsResponse>;

export const PublicSpeakersResponse = z.object({
  event: EventSummary,
  speakers: z.array(PublicSpeaker),
});
export type PublicSpeakersResponse = z.infer<typeof PublicSpeakersResponse>;

// ---------------------------------------------------------------------------
// CFP submission (public)
// ---------------------------------------------------------------------------

export const CfpSubmissionRequest = z.object({
  speaker: z.object({
    name: z.string().min(2).max(120),
    email: z.email().max(254),
    company: z.string().max(120).optional(),
    title: z.string().max(120).optional(),
    bio: z.string().max(2000).optional(),
  }),
  title: z.string().min(4).max(200),
  abstract: z.string().min(20).max(5000),
  trackId: z.string().min(1),
  format: SessionFormat,
  /** Answers to custom form fields, keyed by field key. */
  answers: z.record(z.string(), z.unknown()).optional(),
});
export type CfpSubmissionRequest = z.infer<typeof CfpSubmissionRequest>;

// ---------------------------------------------------------------------------
// Submissions (organizer)
// ---------------------------------------------------------------------------

export const SubmissionSpeakerView = z.object({
  speakerId: z.string(),
  role: SpeakerRole,
  sortOrder: z.number().int(),
  name: z.string(),
  email: z.email(),
  company: z.string().nullable(),
});
export type SubmissionSpeakerView = z.infer<typeof SubmissionSpeakerView>;

export const SubmissionListItem = Submission.extend({
  speakers: z.array(SubmissionSpeakerView),
  trackName: z.string().nullable(),
});
export type SubmissionListItem = z.infer<typeof SubmissionListItem>;

export const SubmissionsListResponse = z.object({
  submissions: z.array(SubmissionListItem),
});
export type SubmissionsListResponse = z.infer<typeof SubmissionsListResponse>;

export const CreateSubmissionResponse = z.object({
  submission: SubmissionListItem,
});
export type CreateSubmissionResponse = z.infer<typeof CreateSubmissionResponse>;

// ---------------------------------------------------------------------------
// Dashboard counts (organizer)
// ---------------------------------------------------------------------------

export const EventCounts = z.object({
  submissions: z.number().int(),
  submissionsByStatus: z.record(SubmissionStatus, z.number().int()),
  sessions: z.number().int(),
  speakers: z.number().int(),
});
export type EventCounts = z.infer<typeof EventCounts>;

// ---------------------------------------------------------------------------
// Speaker assets (R2)
// ---------------------------------------------------------------------------

export const UploadAssetResponse = z.object({
  asset: SpeakerAsset,
});
export type UploadAssetResponse = z.infer<typeof UploadAssetResponse>;
