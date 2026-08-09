import type { DemoDataset, DemoSchedule, DemoTaskKey } from "../contracts/demoData";
import type {
  AgendaSlot,
  ConditionalRule,
  Event,
  Form,
  FormField,
  Room,
  Session,
  SessionSpeaker,
  Speaker,
  SpeakerTask,
  Submission,
  SubmissionSpeaker,
  TaskDefinition,
  Track,
} from "../contracts";
import { buildDirectSession, buildSessionFromSubmission } from "./acceptance";

/**
 * Turns a hand-authored demo dataset into the exact rows the database needs.
 *
 * Pure and deterministic: every id is derived from the dataset's human keys,
 * so loading the same file twice produces byte-identical rows. That is what
 * makes "Load" idempotent and "Reset demo" trivial — delete the event, insert
 * again, and you are back to precisely what the files describe.
 *
 * The submission/session distinction is preserved end to end:
 * - accepted submissions become sessions through buildSessionFromSubmission,
 *   keeping sourceSubmissionId lineage;
 * - invited sessions become sessions through buildDirectSession, with no
 *   submission behind them;
 * - agenda slots only ever reference sessions.
 */

export interface DemoLoadPlan {
  event: Event;
  tracks: Track[];
  rooms: Room[];
  form: Form;
  formFields: FormField[];
  conditionalRules: ConditionalRule[];
  speakers: Speaker[];
  submissions: Submission[];
  submissionSpeakers: SubmissionSpeaker[];
  sessions: Session[];
  sessionSpeakers: SessionSpeaker[];
  agendaSlots: AgendaSlot[];
  taskDefinitions: TaskDefinition[];
  speakerTasks: SpeakerTask[];
  /** Speaker keys referenced by submissions or sessions but never defined. */
  unknownSpeakerKeys: string[];
  /** Track or room keys referenced but never defined. */
  unknownRefs: string[];
}

const TASK_LABELS: Record<DemoTaskKey, { label: string; description: string }> = {
  bio: {
    label: "Confirm speaker bio",
    description: "Review and confirm the bio that will appear on the public site.",
  },
  headshot: {
    label: "Upload headshot",
    description: "High-resolution headshot for the speaker gallery.",
  },
  slides: {
    label: "Upload draft slides",
    description: "Draft deck for tech check. Final version due at the event.",
  },
  release: {
    label: "Sign recording release",
    description: "Required before any session is recorded or streamed.",
  },
};

const TASK_ORDER: DemoTaskKey[] = ["bio", "headshot", "slides", "release"];

function id(prefix: string, datasetKey: string, itemKey: string): string {
  return `${prefix}_${datasetKey}_${itemKey}`.replace(/-/g, "_");
}

/** "2026-10-14" + day 2 -> "2026-10-15". Pure UTC arithmetic, no local drift. */
function dateForDay(startsOn: string, day: number): string {
  const [y, m, d] = startsOn.split("-").map(Number);
  const base = Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  const shifted = new Date(base + (day - 1) * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Demo times are written in the event's local wall clock. We store UTC, and
 * the fixed offset keeps the seeded data readable and stable rather than
 * depending on a timezone database at load time.
 */
function scheduleToUtc(
  startsOn: string,
  schedule: DemoSchedule,
  utcOffsetHours: number,
): { startsAt: string; endsAt: string } {
  const date = dateForDay(startsOn, schedule.day);
  const toIso = (hhmm: string) => {
    const [h, min] = hhmm.split(":").map(Number);
    const [y, mo, d] = date.split("-").map(Number);
    const ms = Date.UTC(y ?? 2026, (mo ?? 1) - 1, d ?? 1, (h ?? 0) - utcOffsetHours, min ?? 0);
    return new Date(ms).toISOString();
  };
  return { startsAt: toIso(schedule.start), endsAt: toIso(schedule.end) };
}

export interface BuildPlanOptions {
  dataset: DemoDataset;
  /** Injected clock, keeps this function pure. */
  now: string;
  /**
   * Hours to subtract when converting local demo times to UTC.
   * Defaults to -7 (US Pacific daylight time).
   */
  utcOffsetHours?: number;
}

export function buildDemoLoadPlan(options: BuildPlanOptions): DemoLoadPlan {
  const { dataset, now } = options;
  const utcOffsetHours = options.utcOffsetHours ?? -7;
  const dk = dataset.event.key.replace(/-/g, "_");

  const eventId = id("evt", dk, "root");
  const trackId = (k: string) => id("trk", dk, k);
  const roomId = (k: string) => id("room", dk, k);
  const speakerId = (k: string) => id("spk", dk, k);
  const submissionId = (k: string) => id("sub", dk, k);
  const taskDefId = (k: string) => id("taskdef", dk, k);

  const unknownSpeakerKeys = new Set<string>();
  const unknownRefs = new Set<string>();

  const knownSpeakers = new Set(dataset.speakers.map((s) => s.key));
  const knownTracks = new Set(dataset.event.tracks.map((t) => t.key));
  const knownRooms = new Set(dataset.event.rooms.map((r) => r.key));

  const resolveSpeaker = (k: string): string | null => {
    if (!knownSpeakers.has(k)) {
      unknownSpeakerKeys.add(k);
      return null;
    }
    return speakerId(k);
  };
  const resolveTrack = (k: string | undefined): string | null => {
    if (k === undefined) return null;
    if (!knownTracks.has(k)) {
      unknownRefs.add(`track:${k}`);
      return null;
    }
    return trackId(k);
  };
  const resolveRoom = (k: string): string | null => {
    if (!knownRooms.has(k)) {
      unknownRefs.add(`room:${k}`);
      return null;
    }
    return roomId(k);
  };

  // --- Event structure -----------------------------------------------------

  const event: Event = {
    id: eventId,
    slug: dataset.event.slug,
    name: dataset.event.name,
    tagline: dataset.event.tagline ?? null,
    description: dataset.event.description ?? null,
    startsOn: dataset.event.startsOn,
    endsOn: dataset.event.endsOn,
    timezone: dataset.event.timezone,
    venue: dataset.event.venue ?? null,
    websiteUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  const tracks: Track[] = dataset.event.tracks.map((t, i) => ({
    id: trackId(t.key),
    eventId,
    name: t.name,
    description: t.description ?? null,
    color: t.color ?? null,
    sortOrder: i,
  }));

  const rooms: Room[] = dataset.event.rooms.map((r, i) => ({
    id: roomId(r.key),
    eventId,
    name: r.name,
    capacity: r.capacity ?? null,
    sortOrder: i,
  }));

  // --- CFP form ------------------------------------------------------------
  // Every demo conference gets a working call for speakers, so a judge can
  // submit a proposal to it exactly as they would to the seeded event.

  const formId = id("form", dk, "cfp");
  const cfg = dataset.event.cfp;

  const form: Form = {
    id: formId,
    eventId,
    kind: "cfp",
    title: cfg?.title ?? `${dataset.event.name} — Call for Speakers`,
    welcomeText: cfg?.welcomeText ?? null,
    thankYouText: cfg?.thankYouText ?? null,
    isOpen: cfg?.isOpen ?? true,
    opensAt: null,
    closesAt: cfg?.closesAt ?? null,
    maxSpeakersPerSubmission: 3,
    allowDrafts: false,
    createdAt: now,
    updatedAt: now,
  };

  const formFields: FormField[] = [
    {
      id: id("ff", dk, "prior_speaking"),
      formId,
      key: "prior_speaking",
      label: "Speaking experience",
      fieldType: "select",
      required: true,
      sortOrder: 0,
      helpText: null,
      options: ["First time", "1-5 talks", "Conference regular"],
    },
    {
      id: id("ff", dk, "workshop_length"),
      formId,
      key: "workshop_length",
      label: "Preferred workshop length",
      fieldType: "select",
      required: true,
      sortOrder: 1,
      helpText: "Required for workshops; hidden for other formats.",
      options: ["90 minutes", "Half day"],
    },
    {
      id: id("ff", dk, "travel_support"),
      formId,
      key: "travel_support",
      label: "I need travel support",
      fieldType: "checkbox",
      required: false,
      sortOrder: 2,
      helpText: null,
      options: null,
    },
  ];

  const conditionalRules: ConditionalRule[] = [
    {
      id: id("rule", dk, "workshop_length"),
      formId,
      sourceFieldKey: "format",
      operator: "in",
      values: ["workshop"],
      action: "show",
      targetFieldKey: "workshop_length",
    },
  ];

  // --- Speakers and their onboarding tasks ---------------------------------

  const speakers: Speaker[] = dataset.speakers.map((s) => ({
    id: speakerId(s.key),
    eventId,
    email: s.email.toLowerCase(),
    name: s.name,
    company: s.company ?? null,
    title: s.title ?? null,
    bio: s.bio ?? null,
    location: s.location ?? null,
    socials: s.socials ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  const taskDefinitions: TaskDefinition[] = TASK_ORDER.map((k, i) => ({
    id: taskDefId(k),
    eventId,
    key: k,
    label: TASK_LABELS[k].label,
    description: TASK_LABELS[k].description,
    appliesTo: "accepted_speakers",
    dueAt: null,
    sortOrder: i,
  }));

  // --- Submissions ---------------------------------------------------------

  const submissions: Submission[] = [];
  const submissionSpeakers: SubmissionSpeaker[] = [];

  for (const s of dataset.submissions) {
    const subId = submissionId(s.key);
    const submittedAt = new Date(
      Date.parse(`${dataset.event.startsOn}T00:00:00Z`) -
        (30 - s.submittedDayOffset) * 86_400_000,
    ).toISOString();

    submissions.push({
      id: subId,
      eventId,
      formId,
      trackId: resolveTrack(s.track),
      title: s.title,
      abstract: s.abstract,
      format: s.format,
      status: s.status,
      answers: s.answers,
      submittedAt: s.status === "draft" ? null : submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });

    s.speakers.forEach((speakerKey, i) => {
      const resolved = resolveSpeaker(speakerKey);
      if (resolved === null) return;
      submissionSpeakers.push({
        submissionId: subId,
        speakerId: resolved,
        role: i === 0 ? "primary" : "co_speaker",
        sortOrder: i,
      });
    });
  }

  // --- Sessions: accepted submissions (with lineage) + invited (direct) ----

  const sessions: Session[] = [];
  const sessionSpeakers: SessionSpeaker[] = [];
  const agendaSlots: AgendaSlot[] = [];

  const addSlot = (sessionId: string, schedule: DemoSchedule, index: number) => {
    const room = resolveRoom(schedule.room);
    const { startsAt, endsAt } = scheduleToUtc(dataset.event.startsOn, schedule, utcOffsetHours);
    agendaSlots.push({
      id: id("slot", dk, `${index}`),
      eventId,
      sessionId,
      roomId: room,
      startsAt,
      endsAt,
      createdAt: now,
      updatedAt: now,
    });
  };

  let slotIndex = 0;

  for (const s of dataset.submissions) {
    if (s.status !== "accepted") continue;
    const submission = submissions.find((row) => row.id === submissionId(s.key));
    if (!submission) continue;

    const { session, sessionSpeakers: links } = buildSessionFromSubmission({
      submission,
      submissionSpeakers,
      now,
    });
    sessions.push(session);
    sessionSpeakers.push(...links);
    if (s.schedule) addSlot(session.id, s.schedule, slotIndex++);
  }

  for (const invited of dataset.event.invitedSessions) {
    const { session, sessionSpeakers: links } = buildDirectSession({
      id: id("ses", dk, invited.key),
      eventId,
      title: invited.title,
      abstract: invited.abstract,
      format: invited.format,
      trackId: resolveTrack(invited.track),
      speakers: invited.speakers.flatMap((k, i) => {
        const resolved = resolveSpeaker(k);
        return resolved === null
          ? []
          : [{ speakerId: resolved, role: i === 0 ? "primary" as const : "co_speaker" as const, sortOrder: i }];
      }),
      now,
    });
    sessions.push(session);
    sessionSpeakers.push(...links);
    if (invited.schedule) addSlot(session.id, invited.schedule, slotIndex++);
  }

  // --- Speaker tasks: only for speakers actually on the program -------------

  const programSpeakerIds = new Set(sessionSpeakers.map((ss) => ss.speakerId));
  const speakerTasks: SpeakerTask[] = [];

  for (const s of dataset.speakers) {
    const sid = speakerId(s.key);
    if (!programSpeakerIds.has(sid)) continue;
    for (const taskKey of TASK_ORDER) {
      const complete = s.tasksComplete.includes(taskKey);
      speakerTasks.push({
        id: id("task", dk, `${s.key}_${taskKey}`),
        eventId,
        speakerId: sid,
        taskDefinitionId: taskDefId(taskKey),
        status: complete ? "complete" : "pending",
        completedAt: complete ? now : null,
        updatedAt: now,
      });
    }
  }

  return {
    event,
    tracks,
    rooms,
    form,
    formFields,
    conditionalRules,
    speakers,
    submissions,
    submissionSpeakers,
    sessions,
    sessionSpeakers,
    agendaSlots,
    taskDefinitions,
    speakerTasks,
    unknownSpeakerKeys: [...unknownSpeakerKeys].sort(),
    unknownRefs: [...unknownRefs].sort(),
  };
}
