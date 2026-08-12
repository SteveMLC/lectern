import { z } from "zod";
import {
  AgendaSlot,
  AssetComment,
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
  SpeakerWorkflowStatus,
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

export const CreateEventRequest = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  timezone: z.string().trim().min(1).max(100),
});
export type CreateEventRequest = z.infer<typeof CreateEventRequest>;

export const UpdateEventSettingsRequest = z.object({
  cfpIsOpen: z.boolean(),
  cfpOpensAt: z.iso.datetime({ offset: true }).nullable(),
  cfpClosesAt: z.iso.datetime({ offset: true }).nullable(),
});
export type UpdateEventSettingsRequest = z.infer<typeof UpdateEventSettingsRequest>;

export const CreateTrackRequest = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});
export type CreateTrackRequest = z.infer<typeof CreateTrackRequest>;

export const CreateRoomRequest = z.object({
  name: z.string().trim().min(2).max(120),
  capacity: z.number().int().positive().nullable(),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequest>;

export const CreateFormFieldRequest = z.object({
  label: z.string().trim().min(2).max(120),
  key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/).max(80),
  fieldType: z.enum(["text", "select", "checkbox"]),
  required: z.boolean(),
  helpText: z.string().trim().max(300).nullable(),
  options: z.array(z.string().trim().min(1).max(120)).max(30).nullable(),
  condition: z.object({
    sourceFieldKey: z.string().min(1),
    operator: z.enum(["equals", "not_equals", "in"]),
    values: z.array(z.string()).min(1),
  }).nullable(),
});
export type CreateFormFieldRequest = z.infer<typeof CreateFormFieldRequest>;

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
  /**
   * The speaker's most recent headshot, uploaded through their portal.
   * Null until they upload one — surfaces render initials in the meantime,
   * so a gallery is never a wall of broken images.
   */
  headshotUrl: z.string().nullable(),
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

export const OrganizerSpeaker = PublicSpeaker.extend({
  email: z.email(),
  workflowStatus: SpeakerWorkflowStatus,
  logisticsNotes: z.string().nullable(),
  completedTasks: z.number().int().nonnegative(),
  totalTasks: z.number().int().nonnegative(),
  assets: z.array(SpeakerAsset),
  tasks: z.array(z.object({ task: SpeakerTask, definition: TaskDefinition })),
  assetComments: z.array(AssetComment),
});
export type OrganizerSpeaker = z.infer<typeof OrganizerSpeaker>;

export const OrganizerSpeakersResponse = z.object({
  event: EventSummary,
  speakers: z.array(OrganizerSpeaker),
});
export type OrganizerSpeakersResponse = z.infer<typeof OrganizerSpeakersResponse>;

export const CreateOrganizerSpeakerRequest = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(120).nullable().default(null),
  title: z.string().trim().max(120).nullable().default(null),
  bio: z.string().trim().max(2000).nullable().default(null),
  workflowStatus: SpeakerWorkflowStatus.default("invited"),
  logisticsNotes: z.string().trim().max(2000).nullable().default(null),
});
export type CreateOrganizerSpeakerRequest = z.infer<typeof CreateOrganizerSpeakerRequest>;

export const UpdateOrganizerSpeakerRequest = CreateOrganizerSpeakerRequest.omit({ email: true });
export type UpdateOrganizerSpeakerRequest = z.infer<typeof UpdateOrganizerSpeakerRequest>;

export const OrganizerSpeakerMutationResponse = z.object({ speaker: Speaker });
export type OrganizerSpeakerMutationResponse = z.infer<typeof OrganizerSpeakerMutationResponse>;

export const ImportOrganizerSpeakersRequest = z.object({ csv: z.string().min(1).max(500_000) });
export type ImportOrganizerSpeakersRequest = z.infer<typeof ImportOrganizerSpeakersRequest>;
export const ImportOrganizerSpeakersResponse = z.object({
  imported: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type ImportOrganizerSpeakersResponse = z.infer<typeof ImportOrganizerSpeakersResponse>;

export const CreateSpeakerTaskRequest = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(2000).nullable().default(null),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  speakerIds: z.array(z.string()).min(1).max(250),
});
export type CreateSpeakerTaskRequest = z.infer<typeof CreateSpeakerTaskRequest>;
export const CreateSpeakerTaskResponse = z.object({
  definition: TaskDefinition,
  assigned: z.number().int().positive(),
});
export type CreateSpeakerTaskResponse = z.infer<typeof CreateSpeakerTaskResponse>;

export const BulkTaskReminderRequest = z.object({ speakerIds: z.array(z.string()).min(1).max(250) });
export type BulkTaskReminderRequest = z.infer<typeof BulkTaskReminderRequest>;
export const BulkTaskReminderResponse = z.object({
  queued: z.number().int().nonnegative(),
  recipientEmails: z.array(z.email()),
});
export type BulkTaskReminderResponse = z.infer<typeof BulkTaskReminderResponse>;

export const BulkAssetDownloadRequest = z.object({
  assetIds: z.array(z.string()).min(1).max(50),
});
export type BulkAssetDownloadRequest = z.infer<typeof BulkAssetDownloadRequest>;

export const BulkCommunicationRequest = z.object({
  speakerIds: z.array(z.string()).min(1).max(250),
  subject: z.string().trim().min(1).max(300),
  bodyMd: z.string().trim().min(1).max(20_000),
});
export type BulkCommunicationRequest = z.infer<typeof BulkCommunicationRequest>;
export const BulkCommunicationResponse = z.object({
  sent: z.number().int().positive(),
  recipientEmails: z.array(z.email()),
});
export type BulkCommunicationResponse = z.infer<typeof BulkCommunicationResponse>;

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
  coSpeakers: z.array(z.object({
    name: z.string().min(2).max(120),
    email: z.email().max(254),
    company: z.string().max(120).optional(),
    title: z.string().max(120).optional(),
    bio: z.string().max(2000).optional(),
  })).max(2).default([]),
  title: z.string().min(4).max(200),
  abstract: z.string().min(20).max(5000),
  trackId: z.string().min(1),
  format: SessionFormat,
  /** Answers to custom form fields, keyed by field key. */
  answers: z.record(z.string(), z.unknown()).optional(),
});
export type CfpSubmissionRequest = z.infer<typeof CfpSubmissionRequest>;

const CfpDraftSpeaker = z.object({
  name: z.string().max(120).optional(),
  email: z.string().max(254).optional(),
  company: z.string().max(120).optional(),
  title: z.string().max(120).optional(),
  bio: z.string().max(2000).optional(),
});

/** A deliberately permissive partial form. Only the title is required so the
 * evaluator's title-only save/resume path is a first-class workflow. */
export const CfpDraftRequest = z.object({
  speaker: CfpDraftSpeaker.optional(),
  coSpeakers: z.array(CfpDraftSpeaker).max(2).optional(),
  title: z.string().trim().min(1).max(200),
  abstract: z.string().max(5000).optional(),
  trackId: z.string().max(120).optional(),
  format: SessionFormat.optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
});
export type CfpDraftRequest = z.infer<typeof CfpDraftRequest>;

export const CfpDraftResponse = z.object({
  token: z.string(),
  savedAt: z.iso.datetime({ offset: true }),
  resumeUrl: z.string(),
  draft: CfpDraftRequest,
});
export type CfpDraftResponse = z.infer<typeof CfpDraftResponse>;

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

/**
 * A committee note on a proposal: who said what, and which way they leaned.
 * Sourced from the reviews table — seeded committee reviews and the notes the
 * organizer writes while deciding both land here, so the record of WHY a call
 * was made survives the call itself.
 */
export const SubmissionReviewView = z.object({
  reviewerName: z.string(),
  recommendation: z.enum(["accept", "reject", "waitlist", "abstain"]),
  comment: z.string().nullable(),
  submittedAt: z.string(),
});
export type SubmissionReviewView = z.infer<typeof SubmissionReviewView>;

export const SubmissionListItem = Submission.extend({
  speakers: z.array(SubmissionSpeakerView),
  trackName: z.string().nullable(),
  /** Newest first. */
  reviews: z.array(SubmissionReviewView),
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
  /**
   * The organizer's internal note. When present it is persisted as a
   * committee review on the proposal, so the reasoning behind a decision
   * outlives the decision. Never shown to speakers.
   */
  reasoning: z.string().trim().max(2000).default(""),
  /**
   * Who this note is filed under. Absent means the default "Organizer" —
   * a single decider never touches this. A team types names and the notes
   * stack per person instead of replacing each other. A label, not an
   * account: the passcode stays the trust boundary.
   */
  reviewerName: z.string().trim().max(120).optional(),
  /**
   * Approve only: the title/abstract the session should carry in the
   * program, when the organizer retitles on approval. The submission keeps
   * what the speaker pitched. Absent or empty keeps the original.
   */
  sessionTitle: z.string().trim().max(200).optional(),
  sessionAbstract: z.string().trim().max(5000).optional(),
});
export type SubmissionDecisionRequest = z.infer<typeof SubmissionDecisionRequest>;

export const FeedbackDraftRequest = z.object({
  decision: ReviewDecision,
  /** The organizer's internal reasoning; drives the drafted email. */
  reasoning: z.string().trim().max(2000).default(""),
});
export type FeedbackDraftRequest = z.infer<typeof FeedbackDraftRequest>;

export const FeedbackDraftResponse = z.object({
  subject: z.string(),
  bodyMd: z.string(),
  aiUsed: z.boolean(),
  model: z.string().optional(),
  note: z.string().optional(),
});
export type FeedbackDraftResponse = z.infer<typeof FeedbackDraftResponse>;

// ---------------------------------------------------------------------------
// Schedule notices (organizer)
// ---------------------------------------------------------------------------

export const ScheduleNoticeDraftRequest = z.object({
  /** Organizer's optional internal note; personalizes the draft, never quoted. */
  note: z.string().trim().max(2000).default(""),
});
export type ScheduleNoticeDraftRequest = z.infer<typeof ScheduleNoticeDraftRequest>;

export const ScheduleNoticeRecipient = z.object({
  speakerId: z.string(),
  name: z.string(),
  email: z.email(),
});
export type ScheduleNoticeRecipient = z.infer<typeof ScheduleNoticeRecipient>;

export const ScheduleNoticeDraftResponse = z.object({
  subject: z.string(),
  bodyMd: z.string(),
  aiUsed: z.boolean(),
  model: z.string().optional(),
  note: z.string().optional(),
  /** Human-readable slot in the event timezone, e.g. "Thursday, September 10 · 2:30 – 3:15 PM PDT". */
  slotSummary: z.string(),
  scheduleUrl: z.string(),
  icsUrl: z.string(),
  recipients: z.array(ScheduleNoticeRecipient),
});
export type ScheduleNoticeDraftResponse = z.infer<typeof ScheduleNoticeDraftResponse>;

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
  versionCount: z.number().int().nonnegative(),
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

export const PublishAgendaResponse = z.object({
  agendaPublishedAt: z.iso.datetime({ offset: true }),
  publicScheduleUrl: z.string(),
});
export type PublishAgendaResponse = z.infer<typeof PublishAgendaResponse>;

export const UpdateSessionRequest = z.object({
  title: z.string().trim().min(3).max(200),
  abstract: z.string().trim().min(10).max(5000),
});
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequest>;

export const SessionContentApprovalRequest = z.object({
  status: z.enum(["needs_review", "approved"]),
});
export type SessionContentApprovalRequest = z.infer<typeof SessionContentApprovalRequest>;

export const SessionVersion = z.object({
  id: z.string(),
  sessionId: z.string(),
  title: z.string(),
  abstract: z.string(),
  editor: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type SessionVersion = z.infer<typeof SessionVersion>;

export const SessionVersionsResponse = z.object({
  versions: z.array(SessionVersion),
});
export type SessionVersionsResponse = z.infer<typeof SessionVersionsResponse>;

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

/** Speaker-safe proposal projection. Committee reviews and internal decision
 * reasoning are deliberately absent from this capability-scoped response. */
export const SpeakerPortalProposal = Submission.pick({
  id: true,
  title: true,
  abstract: true,
  format: true,
  status: true,
  answers: true,
  submittedAt: true,
  updatedAt: true,
}).extend({
  trackName: z.string().nullable(),
});
export type SpeakerPortalProposal = z.infer<typeof SpeakerPortalProposal>;

export const SpeakerPortalResponse = z.object({
  event: EventSummary,
  speaker: Speaker,
  sessions: z.array(SpeakerPortalSession),
  proposals: z.array(SpeakerPortalProposal),
  cfp: EventBundle.shape.cfp,
  tasks: z.array(z.object({ task: SpeakerTask, definition: TaskDefinition })),
  assets: z.array(SpeakerAsset),
  assetComments: z.array(AssetComment),
  resources: z.array(ResourcePage),
});
export type SpeakerPortalResponse = z.infer<typeof SpeakerPortalResponse>;

export const CreateAssetCommentRequest = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type CreateAssetCommentRequest = z.infer<typeof CreateAssetCommentRequest>;

export const AssetCommentResponse = z.object({ comment: AssetComment });
export type AssetCommentResponse = z.infer<typeof AssetCommentResponse>;

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

export const UpdateSpeakerProposalRequest = z.object({
  title: z.string().trim().min(4).max(200),
  abstract: z.string().trim().min(20).max(5000),
  answers: z.record(z.string(), z.unknown()),
});
export type UpdateSpeakerProposalRequest = z.infer<typeof UpdateSpeakerProposalRequest>;

// ---------------------------------------------------------------------------
// Evaluation rounds + reviewer queues
// ---------------------------------------------------------------------------

export const ReviewCriterion = z.object({
  id: z.string(),
  roundId: z.string(),
  key: z.string(),
  label: z.string(),
  maxScore: z.number().int().positive(),
  weight: z.number().positive(),
  sortOrder: z.number().int(),
});
export type ReviewCriterion = z.infer<typeof ReviewCriterion>;

export const RoundReviewer = z.object({
  name: z.string(),
  email: z.email(),
  token: z.string(),
  assignmentCap: z.number().int().positive(),
  assigned: z.number().int().nonnegative(),
  complete: z.number().int().nonnegative(),
  submissionIds: z.array(z.string()),
});
export type RoundReviewer = z.infer<typeof RoundReviewer>;

export const EvaluationRoundView = z.object({
  id: z.string(),
  planId: z.string(),
  name: z.string(),
  roundNumber: z.number().int().positive(),
  status: z.enum(["pending", "open", "closed"]),
  opensAt: z.iso.datetime({ offset: true }).nullable(),
  closesAt: z.iso.datetime({ offset: true }).nullable(),
  blindMode: z.boolean(),
  criteria: z.array(ReviewCriterion),
  reviewers: z.array(RoundReviewer),
});
export type EvaluationRoundView = z.infer<typeof EvaluationRoundView>;

export const ReviewResult = z.object({
  submissionId: z.string(),
  title: z.string(),
  trackName: z.string().nullable(),
  aggregate: z.number().nullable(),
  completedReviews: z.number().int().nonnegative(),
});
export type ReviewResult = z.infer<typeof ReviewResult>;

export const EvaluationWorkspaceResponse = z.object({
  plan: z.object({ id: z.string(), name: z.string() }),
  rounds: z.array(EvaluationRoundView),
  submissions: z.array(SubmissionListItem),
  results: z.array(ReviewResult),
});
export type EvaluationWorkspaceResponse = z.infer<typeof EvaluationWorkspaceResponse>;

export const SaveEvaluationRoundRequest = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  roundNumber: z.number().int().positive(),
  status: z.enum(["pending", "open", "closed"]),
  opensAt: z.iso.datetime({ offset: true }).nullable(),
  closesAt: z.iso.datetime({ offset: true }).nullable(),
  blindMode: z.boolean(),
  criteria: z.array(z.object({
    id: z.string().optional(),
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    maxScore: z.number().int().min(2).max(100),
    weight: z.number().positive().max(100),
  })).min(1),
});
export type SaveEvaluationRoundRequest = z.infer<typeof SaveEvaluationRoundRequest>;

export const SaveRoundReviewerRequest = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  assignmentCap: z.number().int().min(1).max(1000),
});
export type SaveRoundReviewerRequest = z.infer<typeof SaveRoundReviewerRequest>;

export const SaveAssignmentsRequest = z.object({
  reviewerEmail: z.email(),
  submissionIds: z.array(z.string()),
});
export type SaveAssignmentsRequest = z.infer<typeof SaveAssignmentsRequest>;

export const ReviewerQueueSubmission = SpeakerPortalProposal.extend({
  speakers: z.array(SubmissionSpeakerView).optional(),
  criteria: z.array(ReviewCriterion),
  roundId: z.string(),
  roundName: z.string(),
  blindMode: z.boolean(),
  existingReview: z.object({
    scores: z.record(z.string(), z.number()),
    recommendation: z.enum(["accept", "reject", "waitlist", "abstain"]),
    comment: z.string().nullable(),
    submittedAt: z.string(),
  }).nullable(),
});
export type ReviewerQueueSubmission = z.infer<typeof ReviewerQueueSubmission>;

export const ReviewerQueueResponse = z.object({
  reviewer: z.object({ name: z.string(), email: z.email(), token: z.string() }),
  assignments: z.array(ReviewerQueueSubmission),
});
export type ReviewerQueueResponse = z.infer<typeof ReviewerQueueResponse>;

export const SubmitReviewRequest = z.object({
  scores: z.record(z.string(), z.number()),
  recommendation: z.enum(["accept", "reject", "waitlist"]),
  comment: z.string().trim().max(5000),
});
export type SubmitReviewRequest = z.infer<typeof SubmitReviewRequest>;

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
  status: z.enum(["sent_simulated", "sent", "failed"]),
  mode: z.enum(["simulated", "resend"]),
  deliveredAt: z.iso.datetime({ offset: true }).nullable(),
  providerId: z.string().nullable(),
  error: z.string().nullable(),
});
export type SimulateCommunicationResponse = z.infer<typeof SimulateCommunicationResponse>;

export const OutboxMessage = z.object({
  id: z.string(),
  toEmail: z.string().nullable(),
  subject: z.string(),
  status: z.enum(["draft", "queued", "sent_simulated", "sent", "failed"]),
  createdAt: z.string(),
  deliveryStatus: z.enum(["success", "failure"]).nullable(),
});
export type OutboxMessage = z.infer<typeof OutboxMessage>;

export const OutboxResponse = z.object({ messages: z.array(OutboxMessage) });
export type OutboxResponse = z.infer<typeof OutboxResponse>;

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
