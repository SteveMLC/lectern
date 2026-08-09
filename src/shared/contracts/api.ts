import { z } from "zod";
import {
  ConditionalRule,
  Event,
  Form,
  FormField,
  Room,
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
