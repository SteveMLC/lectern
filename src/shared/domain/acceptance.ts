import type {
  Session,
  SessionFormat,
  SessionSpeaker,
  SpeakerRole,
  Submission,
  SubmissionSpeaker,
} from "../contracts";

/**
 * Acceptance-to-session conversion. Pure and deterministic:
 * the session id is derived from the submission id, so accepting the same
 * submission any number of times always yields the same session identity.
 * Combined with the UNIQUE(source_submission_id) constraint in the database,
 * acceptance is idempotent end to end.
 */

export function sessionIdForSubmission(submissionId: string): string {
  return `ses_from_${submissionId}`;
}

/** Submission states that can never be turned into a session. */
const UNACCEPTABLE: ReadonlySet<string> = new Set(["draft", "withdrawn"]);

export interface AcceptanceInput {
  submission: Submission;
  submissionSpeakers: readonly SubmissionSpeaker[];
  /** Injected clock (ISO). Keeps the function pure and testable. */
  now: string;
}

export interface AcceptanceResult {
  session: Session;
  sessionSpeakers: SessionSpeaker[];
}

export function buildSessionFromSubmission(input: AcceptanceInput): AcceptanceResult {
  const { submission, submissionSpeakers, now } = input;

  if (UNACCEPTABLE.has(submission.status)) {
    throw new Error(`Cannot accept a submission in status "${submission.status}".`);
  }
  if (!submission.title.trim()) {
    throw new Error("Cannot create a session from a submission with an empty title.");
  }

  const session: Session = {
    id: sessionIdForSubmission(submission.id),
    eventId: submission.eventId,
    sourceSubmissionId: submission.id,
    trackId: submission.trackId,
    title: submission.title,
    abstract: submission.abstract,
    format: submission.format,
    status: "confirmed",
    origin: "accepted_submission",
    createdAt: now,
    updatedAt: now,
  };

  const sessionSpeakers: SessionSpeaker[] = submissionSpeakers
    .filter((ss) => ss.submissionId === submission.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ss) => ({
      sessionId: session.id,
      speakerId: ss.speakerId,
      role: ss.role,
      sortOrder: ss.sortOrder,
    }));

  return { session, sessionSpeakers };
}

export interface DirectSessionInput {
  id: string;
  eventId: string;
  title: string;
  abstract: string;
  format: SessionFormat;
  trackId?: string | null;
  speakers: readonly { speakerId: string; role: SpeakerRole; sortOrder: number }[];
  now: string;
}

/**
 * The other legal way a session comes to exist: created directly by the
 * organizer (e.g. a sponsor keynote), with no submission behind it.
 */
export function buildDirectSession(input: DirectSessionInput): AcceptanceResult {
  if (!input.title.trim()) {
    throw new Error("Cannot create a session with an empty title.");
  }

  const session: Session = {
    id: input.id,
    eventId: input.eventId,
    sourceSubmissionId: null,
    trackId: input.trackId ?? null,
    title: input.title,
    abstract: input.abstract,
    format: input.format,
    status: "confirmed",
    origin: "direct",
    createdAt: input.now,
    updatedAt: input.now,
  };

  const sessionSpeakers: SessionSpeaker[] = [...input.speakers]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      sessionId: session.id,
      speakerId: s.speakerId,
      role: s.role,
      sortOrder: s.sortOrder,
    }));

  return { session, sessionSpeakers };
}
