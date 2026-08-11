import { describe, expect, it } from "vitest";
import type { Submission, SubmissionSpeaker } from "../contracts";
import {
  buildDirectSession,
  buildSessionFromSubmission,
  sessionIdForSubmission,
} from "./acceptance";

const NOW = "2026-08-09T20:00:00Z";

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: "sub_agents101",
    eventId: "evt_demo",
    formId: "form_cfp",
    trackId: "trk_ai",
    title: "Agents in Production",
    abstract: "What actually breaks when you ship agent systems to real users.",
    format: "talk",
    status: "under_review",
    answers: {},
    submittedAt: "2026-08-01T10:00:00Z",
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

const speakers: SubmissionSpeaker[] = [
  { submissionId: "sub_agents101", speakerId: "spk_ada", role: "primary", sortOrder: 0 },
  { submissionId: "sub_agents101", speakerId: "spk_lin", role: "co_speaker", sortOrder: 1 },
  { submissionId: "sub_other", speakerId: "spk_stranger", role: "primary", sortOrder: 0 },
];

describe("buildSessionFromSubmission", () => {
  it("preserves lineage: sourceSubmissionId, origin, and derived id", () => {
    const { session } = buildSessionFromSubmission({
      submission: submission(),
      submissionSpeakers: speakers,
      now: NOW,
    });
    expect(session.sourceSubmissionId).toBe("sub_agents101");
    expect(session.origin).toBe("accepted_submission");
    expect(session.id).toBe(sessionIdForSubmission("sub_agents101"));
    expect(session.eventId).toBe("evt_demo");
    expect(session.status).toBe("confirmed");
  });

  it("uses the organizer's program title when they retitle on approval", () => {
    const { session } = buildSessionFromSubmission({
      submission: submission(),
      submissionSpeakers: speakers,
      sessionTitle: "Agents in Production: What Breaks First",
      now: NOW,
    });
    expect(session.title).toBe("Agents in Production: What Breaks First");
    // Lineage is intact, so the original pitch stays recoverable.
    expect(session.sourceSubmissionId).toBe("sub_agents101");
    // Abstract untouched when only the title is overridden.
    expect(session.abstract).toBe(submission().abstract);
  });

  it("keeps the submitted title when the override is blank or whitespace", () => {
    for (const sessionTitle of ["", "   ", undefined]) {
      const { session } = buildSessionFromSubmission({
        submission: submission(),
        submissionSpeakers: speakers,
        sessionTitle,
        now: NOW,
      });
      expect(session.title).toBe("Agents in Production");
    }
  });

  it("copies program content from the submission", () => {
    const { session } = buildSessionFromSubmission({
      submission: submission(),
      submissionSpeakers: speakers,
      now: NOW,
    });
    expect(session.title).toBe("Agents in Production");
    expect(session.trackId).toBe("trk_ai");
    expect(session.format).toBe("talk");
  });

  it("maps only this submission's speakers, keeping role and order", () => {
    const { sessionSpeakers } = buildSessionFromSubmission({
      submission: submission(),
      submissionSpeakers: speakers,
      now: NOW,
    });
    expect(sessionSpeakers).toEqual([
      { sessionId: "ses_from_sub_agents101", speakerId: "spk_ada", role: "primary", sortOrder: 0 },
      { sessionId: "ses_from_sub_agents101", speakerId: "spk_lin", role: "co_speaker", sortOrder: 1 },
    ]);
  });

  it("is deterministic: accepting twice yields an identical session", () => {
    const input = { submission: submission(), submissionSpeakers: speakers, now: NOW };
    expect(buildSessionFromSubmission(input)).toEqual(buildSessionFromSubmission(input));
  });

  it("refuses drafts", () => {
    expect(() =>
      buildSessionFromSubmission({
        submission: submission({ status: "draft" }),
        submissionSpeakers: speakers,
        now: NOW,
      }),
    ).toThrow(/draft/);
  });

  it("refuses withdrawn submissions", () => {
    expect(() =>
      buildSessionFromSubmission({
        submission: submission({ status: "withdrawn" }),
        submissionSpeakers: speakers,
        now: NOW,
      }),
    ).toThrow(/withdrawn/);
  });

  it("refuses an empty title", () => {
    expect(() =>
      buildSessionFromSubmission({
        submission: submission({ title: "   " }),
        submissionSpeakers: speakers,
        now: NOW,
      }),
    ).toThrow(/empty title/);
  });
});

describe("buildDirectSession", () => {
  it("creates a session with no submission lineage", () => {
    const { session, sessionSpeakers } = buildDirectSession({
      id: "ses_sponsor_keynote",
      eventId: "evt_demo",
      title: "Opening Keynote",
      abstract: "Welcome and the year ahead.",
      format: "keynote",
      speakers: [{ speakerId: "spk_ceo", role: "primary", sortOrder: 0 }],
      now: NOW,
    });
    expect(session.sourceSubmissionId).toBeNull();
    expect(session.origin).toBe("direct");
    expect(session.status).toBe("confirmed");
    expect(sessionSpeakers).toHaveLength(1);
  });

  it("defaults trackId to null when omitted", () => {
    const { session } = buildDirectSession({
      id: "ses_x",
      eventId: "evt_demo",
      title: "Panel",
      abstract: "A panel.",
      format: "panel",
      speakers: [],
      now: NOW,
    });
    expect(session.trackId).toBeNull();
  });
});
