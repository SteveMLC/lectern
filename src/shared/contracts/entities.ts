import { z } from "zod";

/**
 * Domain entity contracts, shared by the worker API and the web app.
 *
 * Conventions:
 * - IDs are prefixed strings (see ../ids.ts), never numbers.
 * - Timestamps are ISO 8601 strings in UTC ("...Z"); date-only fields are YYYY-MM-DD.
 * - DB columns are snake_case; these contracts are camelCase. Mapping lives in the repo layer.
 *
 * Invariants the schema encodes (do not weaken without integration-owner approval):
 * - Submissions and sessions are distinct entities.
 * - A session either originates from exactly one submission (sourceSubmissionId set,
 *   origin "accepted_submission") or is created directly (sourceSubmissionId null,
 *   origin "direct"). Acceptance is idempotent: one submission -> at most one session.
 * - Agenda slots reference sessions only, never submissions.
 * - Speaker files are first-class SpeakerAsset records, not strings on a speaker row.
 * - Reviews belong to rounds; aggregate scores are always derived, never stored.
 * - ScheduleConflict is computed from agenda data, never stored.
 */

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SubmissionStatus = z.enum([
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
]);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const SessionStatus = z.enum(["tentative", "confirmed", "cancelled"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const SessionOrigin = z.enum(["accepted_submission", "direct"]);
export type SessionOrigin = z.infer<typeof SessionOrigin>;

export const SessionFormat = z.enum(["talk", "workshop", "panel", "lightning", "keynote"]);
export type SessionFormat = z.infer<typeof SessionFormat>;

export const SpeakerRole = z.enum(["primary", "co_speaker"]);
export type SpeakerRole = z.infer<typeof SpeakerRole>;

export const SpeakerWorkflowStatus = z.enum(["prospect", "invited", "confirmed", "declined"]);
export type SpeakerWorkflowStatus = z.infer<typeof SpeakerWorkflowStatus>;

export const FieldType = z.enum([
  "text",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "email",
  "url",
  "number",
]);
export type FieldType = z.infer<typeof FieldType>;

export const RuleOperator = z.enum(["equals", "not_equals", "in"]);
export type RuleOperator = z.infer<typeof RuleOperator>;

export const RuleAction = z.enum(["show", "hide"]);
export type RuleAction = z.infer<typeof RuleAction>;

export const AssetKind = z.enum(["headshot", "slides", "document"]);
export type AssetKind = z.infer<typeof AssetKind>;

export const RoundStatus = z.enum(["pending", "open", "closed"]);
export type RoundStatus = z.infer<typeof RoundStatus>;

export const Recommendation = z.enum(["accept", "reject", "waitlist", "abstain"]);
export type Recommendation = z.infer<typeof Recommendation>;

export const TaskStatus = z.enum(["pending", "complete", "blocked"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskAppliesTo = z.enum(["accepted_speakers", "all_speakers"]);
export type TaskAppliesTo = z.infer<typeof TaskAppliesTo>;

export const MessageStatus = z.enum(["draft", "queued", "sent_simulated", "sent", "failed"]);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const DeliveryMode = z.enum(["simulated", "resend"]);
export type DeliveryMode = z.infer<typeof DeliveryMode>;

export const DeliveryStatus = z.enum(["success", "failure"]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;

export const IntegrationSystem = z.enum(["accelevents", "airtable"]);
export type IntegrationSystem = z.infer<typeof IntegrationSystem>;

export const IntegrationStatus = z.enum([
  "not_configured",
  "awaiting_credentials",
  "configured",
  "error",
]);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const SyncDirection = z.enum(["push", "pull"]);
export type SyncDirection = z.infer<typeof SyncDirection>;

export const SyncStatus = z.enum(["running", "success", "partial", "failure"]);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const ConflictType = z.enum(["room", "speaker"]);
export type ConflictType = z.infer<typeof ConflictType>;

// ---------------------------------------------------------------------------
// Event structure
// ---------------------------------------------------------------------------

export const Event = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  startsOn: isoDate,
  endsOn: isoDate,
  timezone: z.string(),
  venue: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  /** Organizer-controlled publication receipt for the public agenda. */
  agendaPublishedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Event = z.infer<typeof Event>;

export const Track = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type Track = z.infer<typeof Track>;

export const Room = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  capacity: z.number().int().nullable(),
  sortOrder: z.number().int(),
});
export type Room = z.infer<typeof Room>;

// ---------------------------------------------------------------------------
// CFP form
// ---------------------------------------------------------------------------

export const Form = z.object({
  id: z.string(),
  eventId: z.string(),
  kind: z.literal("cfp"),
  title: z.string(),
  welcomeText: z.string().nullable(),
  thankYouText: z.string().nullable(),
  isOpen: z.boolean(),
  opensAt: isoDateTime.nullable(),
  closesAt: isoDateTime.nullable(),
  maxSpeakersPerSubmission: z.number().int().min(1),
  allowDrafts: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Form = z.infer<typeof Form>;

export const FormField = z.object({
  id: z.string(),
  formId: z.string(),
  key: z.string(),
  label: z.string(),
  fieldType: FieldType,
  required: z.boolean(),
  sortOrder: z.number().int(),
  helpText: z.string().nullable(),
  options: z.array(z.string()).nullable(),
});
export type FormField = z.infer<typeof FormField>;

/** Conditional visibility rule between two fields of the same form, keyed by field `key`. */
export const ConditionalRule = z.object({
  id: z.string(),
  formId: z.string(),
  sourceFieldKey: z.string(),
  operator: RuleOperator,
  /** Comparison value; for "in" this is the allowed set. */
  values: z.array(z.string()),
  action: RuleAction,
  targetFieldKey: z.string(),
});
export type ConditionalRule = z.infer<typeof ConditionalRule>;

// ---------------------------------------------------------------------------
// Speakers and assets
// ---------------------------------------------------------------------------

export const SpeakerSocials = z.object({
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  website: z.string().optional(),
});
export type SpeakerSocials = z.infer<typeof SpeakerSocials>;

export const Speaker = z.object({
  id: z.string(),
  eventId: z.string(),
  email: z.email(),
  name: z.string(),
  company: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  workflowStatus: SpeakerWorkflowStatus,
  logisticsNotes: z.string().nullable(),
  socials: SpeakerSocials.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Speaker = z.infer<typeof Speaker>;

/** A real uploaded file living in R2 — never a bare URL string on the speaker row. */
export const SpeakerAsset = z.object({
  id: z.string(),
  speakerId: z.string(),
  kind: AssetKind,
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().min(0),
  r2Key: z.string(),
  uploadedAt: isoDateTime,
});
export type SpeakerAsset = z.infer<typeof SpeakerAsset>;

// ---------------------------------------------------------------------------
// Submissions (applications to speak) — NOT sessions
// ---------------------------------------------------------------------------

export const Submission = z.object({
  id: z.string(),
  eventId: z.string(),
  formId: z.string().nullable(),
  trackId: z.string().nullable(),
  title: z.string(),
  abstract: z.string(),
  format: SessionFormat,
  status: SubmissionStatus,
  /** Answers to custom form fields, keyed by field key. */
  answers: z.record(z.string(), z.unknown()),
  submittedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Submission = z.infer<typeof Submission>;

export const SubmissionSpeaker = z.object({
  submissionId: z.string(),
  speakerId: z.string(),
  role: SpeakerRole,
  sortOrder: z.number().int(),
});
export type SubmissionSpeaker = z.infer<typeof SubmissionSpeaker>;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export const EvaluationPlan = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: isoDateTime,
});
export type EvaluationPlan = z.infer<typeof EvaluationPlan>;

export const EvaluationRound = z.object({
  id: z.string(),
  planId: z.string(),
  name: z.string(),
  roundNumber: z.number().int().min(1),
  status: RoundStatus,
  opensAt: isoDateTime.nullable(),
  closesAt: isoDateTime.nullable(),
});
export type EvaluationRound = z.infer<typeof EvaluationRound>;

export const RubricCriterion = z.object({
  id: z.string(),
  planId: z.string(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  maxScore: z.number().int().min(1),
  weight: z.number().min(0),
  sortOrder: z.number().int(),
});
export type RubricCriterion = z.infer<typeof RubricCriterion>;

/** One reviewer's scores for one submission within one round. Aggregates are derived. */
export const Review = z.object({
  id: z.string(),
  roundId: z.string(),
  submissionId: z.string(),
  reviewerName: z.string(),
  reviewerEmail: z.email(),
  /** Criterion key -> score. */
  scores: z.record(z.string(), z.number()),
  overallComment: z.string().nullable(),
  recommendation: Recommendation,
  submittedAt: isoDateTime,
});
export type Review = z.infer<typeof Review>;

// ---------------------------------------------------------------------------
// Sessions (things that can be scheduled) — NOT submissions
// ---------------------------------------------------------------------------

export const Session = z.object({
  id: z.string(),
  eventId: z.string(),
  /**
   * Lineage: set exactly when this session came from accepting a submission.
   * UNIQUE in the database — accepting the same submission twice can never
   * produce two sessions.
   */
  sourceSubmissionId: z.string().nullable(),
  trackId: z.string().nullable(),
  title: z.string(),
  abstract: z.string(),
  format: SessionFormat,
  status: SessionStatus,
  origin: SessionOrigin,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Session = z.infer<typeof Session>;

export const SessionSpeaker = z.object({
  sessionId: z.string(),
  speakerId: z.string(),
  role: SpeakerRole,
  sortOrder: z.number().int(),
});
export type SessionSpeaker = z.infer<typeof SessionSpeaker>;

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

/** Agenda slots reference sessions only. There is deliberately no submissionId here. */
export const AgendaSlot = z.object({
  id: z.string(),
  eventId: z.string(),
  sessionId: z.string(),
  roomId: z.string().nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type AgendaSlot = z.infer<typeof AgendaSlot>;

/** Computed from agenda data by the domain layer. Never persisted. */
export const ScheduleConflict = z.object({
  type: ConflictType,
  slotIds: z.tuple([z.string(), z.string()]),
  sessionIds: z.tuple([z.string(), z.string()]),
  roomId: z.string().optional(),
  speakerId: z.string().optional(),
  message: z.string(),
});
export type ScheduleConflict = z.infer<typeof ScheduleConflict>;

// ---------------------------------------------------------------------------
// Speaker onboarding tasks
// ---------------------------------------------------------------------------

export const TaskDefinition = z.object({
  id: z.string(),
  eventId: z.string(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  appliesTo: TaskAppliesTo,
  dueAt: isoDateTime.nullable(),
  sortOrder: z.number().int(),
});
export type TaskDefinition = z.infer<typeof TaskDefinition>;

export const SpeakerTask = z.object({
  id: z.string(),
  eventId: z.string(),
  speakerId: z.string(),
  taskDefinitionId: z.string(),
  status: TaskStatus,
  completedAt: isoDateTime.nullable(),
  updatedAt: isoDateTime,
});
export type SpeakerTask = z.infer<typeof SpeakerTask>;

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export const MessageTemplate = z.object({
  id: z.string(),
  eventId: z.string(),
  key: z.string(),
  name: z.string(),
  channel: z.literal("email"),
  subject: z.string(),
  bodyMd: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type MessageTemplate = z.infer<typeof MessageTemplate>;

export const Message = z.object({
  id: z.string(),
  eventId: z.string(),
  templateId: z.string().nullable(),
  speakerId: z.string().nullable(),
  toEmail: z.email().nullable(),
  subject: z.string(),
  bodyMd: z.string(),
  status: MessageStatus,
  createdAt: isoDateTime,
});
export type Message = z.infer<typeof Message>;

export const DeliveryAttempt = z.object({
  id: z.string(),
  messageId: z.string(),
  attemptedAt: isoDateTime,
  mode: DeliveryMode,
  status: DeliveryStatus,
  providerId: z.string().nullable(),
  error: z.string().nullable(),
});
export type DeliveryAttempt = z.infer<typeof DeliveryAttempt>;

// ---------------------------------------------------------------------------
// Resource pages
// ---------------------------------------------------------------------------

export const ResourcePage = z.object({
  id: z.string(),
  eventId: z.string(),
  slug: z.string(),
  title: z.string(),
  bodyMd: z.string(),
  /** Raw HTML embed block. Must be sanitized before rendering (Lane C). */
  embedHtml: z.string().nullable(),
  isPublished: z.boolean(),
  updatedAt: isoDateTime,
});
export type ResourcePage = z.infer<typeof ResourcePage>;

// ---------------------------------------------------------------------------
// Integrations (Accelevents, Airtable)
// ---------------------------------------------------------------------------

export const IntegrationConnection = z.object({
  id: z.string(),
  eventId: z.string(),
  system: IntegrationSystem,
  status: IntegrationStatus,
  /** Non-secret configuration only. Secrets live in worker env, never in rows. */
  config: z.record(z.string(), z.unknown()),
  updatedAt: isoDateTime,
});
export type IntegrationConnection = z.infer<typeof IntegrationConnection>;

export const SyncRun = z.object({
  id: z.string(),
  connectionId: z.string(),
  startedAt: isoDateTime,
  finishedAt: isoDateTime.nullable(),
  direction: SyncDirection,
  status: SyncStatus,
  stats: z.record(z.string(), z.unknown()).nullable(),
  log: z.array(z.string()).nullable(),
});
export type SyncRun = z.infer<typeof SyncRun>;

/** External sync IDs are stored so retries update instead of duplicate. */
export const ExternalIdMap = z.object({
  id: z.string(),
  connectionId: z.string(),
  entityType: z.string(),
  internalId: z.string(),
  externalId: z.string(),
  lastSyncedAt: isoDateTime,
});
export type ExternalIdMap = z.infer<typeof ExternalIdMap>;
