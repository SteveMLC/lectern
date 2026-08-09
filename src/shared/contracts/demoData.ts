import { z } from "zod";
import { SessionFormat, SpeakerRole, SubmissionStatus, TaskStatus } from "./entities";

/**
 * Demo dataset contracts — the file format non-engineers author by hand.
 *
 * Deliberately friendlier than the internal entity contracts:
 * - Records are joined by human `key` strings ("ada-okafor"), not prefixed ids.
 *   The loader derives stable internal ids from those keys, so re-loading the
 *   same file always produces the same rows (idempotent load = working reset).
 * - Dates are plain "YYYY-MM-DD" and times "HH:MM" in the event's local day.
 * - Everything optional has a sensible default.
 *
 * Validate any edit with `pnpm demo:check` before opening a pull request.
 */

const key = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only (e.g. ada-okafor).");

const dayOfEvent = z.int().min(1).max(10);
const clockTime = z.string().regex(/^\d{2}:\d{2}$/, 'Use 24-hour "HH:MM", e.g. "14:30".');

// ---------------------------------------------------------------------------
// Event file
// ---------------------------------------------------------------------------

export const DemoTrack = z.object({
  key,
  name: z.string().min(2),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like "#6366f1".')
    .optional(),
});
export type DemoTrack = z.infer<typeof DemoTrack>;

export const DemoRoom = z.object({
  key,
  name: z.string().min(1),
  capacity: z.int().positive().optional(),
});
export type DemoRoom = z.infer<typeof DemoRoom>;

/** A slot on the schedule. `day` is 1 for the first day of the event. */
export const DemoSchedule = z.object({
  day: dayOfEvent,
  start: clockTime,
  end: clockTime,
  room: key,
});
export type DemoSchedule = z.infer<typeof DemoSchedule>;

/**
 * A session created directly by the organizer — sponsor keynotes, invited
 * panels. These never pass through the CFP, which is exactly the point:
 * they prove submissions and sessions are different things.
 */
export const DemoInvitedSession = z.object({
  key,
  title: z.string().min(4),
  abstract: z.string().min(10),
  format: SessionFormat,
  track: key.optional(),
  speakers: z.array(key).default([]),
  schedule: DemoSchedule.optional(),
  note: z.string().optional(),
});
export type DemoInvitedSession = z.infer<typeof DemoInvitedSession>;

export const DemoEventFile = z.object({
  key,
  name: z.string().min(3),
  slug: key,
  tagline: z.string().optional(),
  description: z.string().optional(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  timezone: z.string().default("America/Los_Angeles"),
  venue: z.string().optional(),
  cfp: z
    .object({
      title: z.string().optional(),
      welcomeText: z.string().optional(),
      thankYouText: z.string().optional(),
      isOpen: z.boolean().default(true),
      closesAt: z.iso.datetime({ offset: true }).optional(),
    })
    .optional(),
  tracks: z.array(DemoTrack).min(1),
  rooms: z.array(DemoRoom).min(1),
  invitedSessions: z.array(DemoInvitedSession).default([]),
});
export type DemoEventFile = z.infer<typeof DemoEventFile>;

// ---------------------------------------------------------------------------
// Speakers file
// ---------------------------------------------------------------------------

/**
 * Onboarding task state. Leaving a task out of `tasksComplete` means the
 * speaker still owes it — that is how you stage "missing headshot" stories.
 */
export const DemoTaskKey = z.enum(["bio", "headshot", "slides", "release"]);
export type DemoTaskKey = z.infer<typeof DemoTaskKey>;

export const DemoSpeaker = z.object({
  key,
  name: z.string().min(2),
  email: z.email(),
  company: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  socials: z
    .object({
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  /** Tasks this speaker has finished. Anything omitted shows as outstanding. */
  tasksComplete: z.array(DemoTaskKey).default([]),
  /** Free-text note for the demo script. Not shown in the app. */
  storyNote: z.string().optional(),
});
export type DemoSpeaker = z.infer<typeof DemoSpeaker>;

export const DemoSpeakersFile = z.object({
  event: key,
  speakers: z.array(DemoSpeaker).min(1),
});
export type DemoSpeakersFile = z.infer<typeof DemoSpeakersFile>;

// ---------------------------------------------------------------------------
// Submissions file
// ---------------------------------------------------------------------------

export const DemoSubmission = z.object({
  key,
  title: z.string().min(4),
  abstract: z.string().min(20),
  track: key,
  format: SessionFormat,
  status: SubmissionStatus.default("submitted"),
  /** First speaker is the primary; the rest are co-speakers. */
  speakers: z.array(key).min(1),
  /** Day offset from the CFP open date, used to spread out submitted times. */
  submittedDayOffset: z.int().min(0).max(60).default(0),
  answers: z.record(z.string(), z.unknown()).default({}),
  /**
   * Only meaningful when status is "accepted": where the resulting session
   * lands on the agenda. Overlapping placements are how you stage conflicts.
   */
  schedule: DemoSchedule.optional(),
  storyNote: z.string().optional(),
});
export type DemoSubmission = z.infer<typeof DemoSubmission>;

export const DemoSubmissionsFile = z.object({
  event: key,
  submissions: z.array(DemoSubmission).min(1),
});
export type DemoSubmissionsFile = z.infer<typeof DemoSubmissionsFile>;

// ---------------------------------------------------------------------------
// Assembled dataset
// ---------------------------------------------------------------------------

export const DemoDataset = z.object({
  event: DemoEventFile,
  speakers: z.array(DemoSpeaker),
  submissions: z.array(DemoSubmission),
});
export type DemoDataset = z.infer<typeof DemoDataset>;

export const DemoDatasetSummary = z.object({
  key: z.string(),
  name: z.string(),
  slug: z.string(),
  loaded: z.boolean(),
  counts: z.object({
    speakers: z.int(),
    submissions: z.int(),
    sessions: z.int(),
    scheduled: z.int(),
    conflicts: z.int(),
    outstandingTasks: z.int(),
  }),
});
export type DemoDatasetSummary = z.infer<typeof DemoDatasetSummary>;

export const DemoStatusResponse = z.object({
  datasets: z.array(DemoDatasetSummary),
});
export type DemoStatusResponse = z.infer<typeof DemoStatusResponse>;

export const DemoLoadResponse = z.object({
  dataset: DemoDatasetSummary,
  /** Human-readable lines describing what the load produced. */
  report: z.array(z.string()),
});
export type DemoLoadResponse = z.infer<typeof DemoLoadResponse>;

export { SpeakerRole, TaskStatus };
