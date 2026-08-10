import { z } from "zod";
import {
  AgendaSlot,
  ConditionalRule,
  Event,
  Form,
  FormField,
  Room,
  ResourcePage,
  Session,
  SessionFormat,
  Speaker,
  SpeakerAsset,
  SpeakerRole,
  SpeakerTask,
  Submission,
  SubmissionStatus,
  TaskDefinition,
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
  /** Present so reviewers can judge the speaker without leaving the queue. */
  bio: z.string().nullable(),
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

export const ReviewDecision = z.enum(["approve", "maybe", "deny"]);
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const SubmissionDecisionRequest = z.object({
  decision: ReviewDecision,
});
export type SubmissionDecisionRequest = z.infer<typeof SubmissionDecisionRequest>;

export const SubmissionDecisionResponse = z.object({
  submission: SubmissionListItem,
  session: Session.nullable(),
  reusedSession: z.boolean(),
});
export type SubmissionDecisionResponse = z.infer<typeof SubmissionDecisionResponse>;

// ---------------------------------------------------------------------------
// Program sessions + agenda (organizer)
// ---------------------------------------------------------------------------

export const OrganizerSession = Session.extend({
  trackName: z.string().nullable(),
  speakers: z.array(PublicSessionSpeaker),
  slot: AgendaSlot.nullable(),
});
export type OrganizerSession = z.infer<typeof OrganizerSession>;

export const OrganizerAgendaResponse = z.object({
  sessions: z.array(OrganizerSession),
  conflicts: z.array(
    z.object({
      type: z.enum(["room", "speaker"]),
      slotIds: z.tuple([z.string(), z.string()]),
      sessionIds: z.tuple([z.string(), z.string()]),
      roomId: z.string().optional(),
      speakerId: z.string().optional(),
      message: z.string(),
    }),
  ),
});
export type OrganizerAgendaResponse = z.infer<typeof OrganizerAgendaResponse>;

export const CreateDirectSessionRequest = z.object({
  title: z.string().trim().min(3).max(200),
  abstract: z.string().trim().min(10).max(5000),
  format: SessionFormat,
  trackId: z.string().nullable().optional(),
  speakerIds: z.array(z.string()).max(8).default([]),
});
export type CreateDirectSessionRequest = z.infer<typeof CreateDirectSessionRequest>;

export const CreateDirectSessionResponse = z.object({
  session: OrganizerSession,
});
export type CreateDirectSessionResponse = z.infer<typeof CreateDirectSessionResponse>;

export const AgendaSlotRequest = z
  .object({
    roomId: z.string(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: "End time must be after start time.",
    path: ["endsAt"],
  });
export type AgendaSlotRequest = z.infer<typeof AgendaSlotRequest>;

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

// ---------------------------------------------------------------------------
// Speaker portal
// ---------------------------------------------------------------------------

export const SpeakerPortalSession = z.object({
  id: z.string(),
  title: z.string(),
  abstract: z.string(),
  format: SessionFormat,
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  roomName: z.string().nullable(),
});
export type SpeakerPortalSession = z.infer<typeof SpeakerPortalSession>;

export const SpeakerPortalResponse = z.object({
  event: EventSummary,
  speaker: Speaker,
  sessions: z.array(SpeakerPortalSession),
  tasks: z.array(z.object({ task: SpeakerTask, definition: TaskDefinition })),
  assets: z.array(SpeakerAsset),
  resources: z.array(ResourcePage),
});
export type SpeakerPortalResponse = z.infer<typeof SpeakerPortalResponse>;

export const UpdateSpeakerProfileRequest = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).nullable(),
  title: z.string().trim().max(120).nullable(),
  bio: z.string().trim().max(2000).nullable(),
  location: z.string().trim().max(120).nullable(),
  socials: z
    .object({
      twitter: z.string().trim().max(300).optional(),
      linkedin: z.string().trim().max(300).optional(),
      github: z.string().trim().max(300).optional(),
      website: z.string().trim().max(300).optional(),
    })
    .nullable(),
});
export type UpdateSpeakerProfileRequest = z.infer<typeof UpdateSpeakerProfileRequest>;

export const UpdateSpeakerTaskRequest = z.object({
  status: z.enum(["pending", "complete"]),
});
export type UpdateSpeakerTaskRequest = z.infer<typeof UpdateSpeakerTaskRequest>;

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export const CommunicationKind = z.enum(["reminder", "session_update"]);
export type CommunicationKind = z.infer<typeof CommunicationKind>;

export const CommunicationPreviewResponse = z.object({
  kind: CommunicationKind,
  speakerId: z.string(),
  speakerName: z.string(),
  toEmail: z.email(),
  subject: z.string(),
  bodyMd: z.string(),
  pendingTaskCount: z.number().int(),
  icsUrl: z.string().nullable(),
});
export type CommunicationPreviewResponse = z.infer<typeof CommunicationPreviewResponse>;

export const SimulateCommunicationRequest = z.object({
  speakerId: z.string(),
  subject: z.string().min(1).max(300),
  bodyMd: z.string().min(1).max(10000),
});
export type SimulateCommunicationRequest = z.infer<typeof SimulateCommunicationRequest>;

export const SimulateCommunicationResponse = z.object({
  messageId: z.string(),
  status: z.literal("sent_simulated"),
  deliveredAt: z.iso.datetime({ offset: true }),
});
export type SimulateCommunicationResponse = z.infer<typeof SimulateCommunicationResponse>;

export const AirtableStatusResponse = z.object({
  configured: z.boolean(),
  active: z.boolean(),
  connected: z.boolean(),
  readTables: z.tuple([z.literal("Events"), z.literal("Speakers")]),
  writeTable: z.literal("Messages"),
  minimumRequestSpacingMs: z.literal(210),
  cacheTtlSeconds: z.literal(15),
  fallback: z.literal("d1"),
});
export type AirtableStatusResponse = z.infer<typeof AirtableStatusResponse>;

export const AirtableMirrorStatusResponse = z.object({
  configured: z.boolean(),
  reachable: z.boolean(),
  recordReadAvailable: z.boolean(),
  recordReadError: z.string().optional(),
  error: z.string().optional(),
  baseTables: z.array(z.string()).optional().default([]),
  tables: z.array(z.string()),
  mirrored: z.record(z.string(), z.number()),
  lastRun: z
    .object({
      id: z.string(),
      startedAt: z.iso.datetime({ offset: true }),
      finishedAt: z.iso.datetime({ offset: true }).nullable(),
      status: z.string(),
      stats: z.record(z.string(), z.unknown()).nullable(),
    })
    .nullable(),
});
export type AirtableMirrorStatusResponse = z.infer<typeof AirtableMirrorStatusResponse>;
