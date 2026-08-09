import { describe, expect, it } from "vitest";
import type { DemoDataset } from "../contracts/demoData";
import { buildDemoLoadPlan } from "./demoLoader";
import { findScheduleConflicts } from "./schedule";

const NOW = "2026-08-09T22:00:00Z";

function dataset(overrides: Partial<DemoDataset> = {}): DemoDataset {
  return {
    event: {
      key: "test-conf",
      name: "Test Conference",
      slug: "test-conf",
      startsOn: "2026-11-05",
      endsOn: "2026-11-06",
      timezone: "America/Los_Angeles",
      tracks: [{ key: "legacy", name: "Legacy" }],
      rooms: [
        { key: "big", name: "Big Room", capacity: 300 },
        { key: "small", name: "Small Room", capacity: 60 },
      ],
      invitedSessions: [],
      ...overrides.event,
    },
    speakers: overrides.speakers ?? [
      { key: "ada", name: "Ada", email: "ada@example.dev", tasksComplete: ["bio"] },
      { key: "lin", name: "Lin", email: "lin@example.dev", tasksComplete: [] },
    ],
    submissions: overrides.submissions ?? [],
  };
}

describe("buildDemoLoadPlan", () => {
  it("is deterministic: the same dataset always produces identical rows", () => {
    const d = dataset();
    expect(buildDemoLoadPlan({ dataset: d, now: NOW })).toEqual(
      buildDemoLoadPlan({ dataset: d, now: NOW }),
    );
  });

  it("derives ids from human keys so reloading overwrites rather than duplicates", () => {
    const plan = buildDemoLoadPlan({ dataset: dataset(), now: NOW });
    expect(plan.event.id).toBe("evt_test_conf_root");
    expect(plan.speakers.map((s) => s.id)).toEqual(["spk_test_conf_ada", "spk_test_conf_lin"]);
  });

  it("only turns accepted submissions into sessions, keeping lineage", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        submissions: [
          {
            key: "yes",
            title: "Accepted Talk",
            abstract: "This one made it through review and becomes a session.",
            track: "legacy",
            format: "talk",
            status: "accepted",
            speakers: ["ada"],
            submittedDayOffset: 0,
            answers: {},
          },
          {
            key: "no",
            title: "Rejected Talk",
            abstract: "This one did not make it and must never become a session.",
            track: "legacy",
            format: "talk",
            status: "rejected",
            speakers: ["lin"],
            submittedDayOffset: 0,
            answers: {},
          },
        ],
      }),
      now: NOW,
    });

    expect(plan.submissions).toHaveLength(2);
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]).toMatchObject({
      origin: "accepted_submission",
      sourceSubmissionId: "sub_test_conf_yes",
    });
  });

  it("creates invited sessions with no submission lineage", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        event: {
          ...dataset().event,
          invitedSessions: [
            {
              key: "keynote",
              title: "Sponsor Keynote",
              abstract: "Added directly by the organizer, never a submission.",
              format: "keynote",
              speakers: ["ada"],
            },
          ],
        },
      }),
      now: NOW,
    });

    expect(plan.submissions).toHaveLength(0);
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]).toMatchObject({ origin: "direct", sourceSubmissionId: null });
  });

  it("converts local demo times to UTC using the given offset", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        event: {
          ...dataset().event,
          invitedSessions: [
            {
              key: "keynote",
              title: "Morning Keynote",
              abstract: "Nine in the morning, local time.",
              format: "keynote",
              speakers: [],
              schedule: { day: 1, start: "09:00", end: "09:45", room: "big" },
            },
          ],
        },
      }),
      now: NOW,
      utcOffsetHours: -7,
    });

    // 09:00 local at UTC-7 is 16:00 UTC on the same day.
    expect(plan.agendaSlots[0]?.startsAt).toBe("2026-11-05T16:00:00.000Z");
    expect(plan.agendaSlots[0]?.endsAt).toBe("2026-11-05T16:45:00.000Z");
  });

  it("resolves day 2 to the following calendar date", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        event: {
          ...dataset().event,
          invitedSessions: [
            {
              key: "day2",
              title: "Second Day Session",
              abstract: "Runs on the second day of the conference.",
              format: "talk",
              speakers: [],
              schedule: { day: 2, start: "10:00", end: "10:45", room: "big" },
            },
          ],
        },
      }),
      now: NOW,
    });
    expect(plan.agendaSlots[0]?.startsAt.slice(0, 10)).toBe("2026-11-06");
  });

  it("produces agenda data whose conflicts the schedule engine actually finds", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        submissions: [
          {
            key: "one",
            title: "First Talk",
            abstract: "Ada speaks here, in the big room, first thing.",
            track: "legacy",
            format: "talk",
            status: "accepted",
            speakers: ["ada"],
            submittedDayOffset: 0,
            answers: {},
            schedule: { day: 1, start: "10:00", end: "10:45", room: "big" },
          },
          {
            key: "two",
            title: "Second Talk",
            abstract: "Ada also speaks here, overlapping, in a different room.",
            track: "legacy",
            format: "talk",
            status: "accepted",
            speakers: ["ada"],
            submittedDayOffset: 0,
            answers: {},
            schedule: { day: 1, start: "10:30", end: "11:15", room: "small" },
          },
        ],
      }),
      now: NOW,
    });

    const conflicts = findScheduleConflicts(plan.agendaSlots, plan.sessionSpeakers);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ type: "speaker", speakerId: "spk_test_conf_ada" });
  });

  it("gives onboarding tasks only to speakers on the program", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        submissions: [
          {
            key: "one",
            title: "Only Ada Speaks",
            abstract: "Lin submitted nothing and is not on the program at all.",
            track: "legacy",
            format: "talk",
            status: "accepted",
            speakers: ["ada"],
            submittedDayOffset: 0,
            answers: {},
          },
        ],
      }),
      now: NOW,
    });

    const speakerIds = new Set(plan.speakerTasks.map((t) => t.speakerId));
    expect([...speakerIds]).toEqual(["spk_test_conf_ada"]);
    // bio complete, the other three outstanding
    expect(plan.speakerTasks.filter((t) => t.status === "complete")).toHaveLength(1);
    expect(plan.speakerTasks.filter((t) => t.status === "pending")).toHaveLength(3);
  });

  it("reports unknown references instead of throwing", () => {
    const plan = buildDemoLoadPlan({
      dataset: dataset({
        submissions: [
          {
            key: "typo",
            title: "Talk With A Typo",
            abstract: "References a speaker key and a track key that do not exist.",
            track: "nonexistent-track",
            format: "talk",
            status: "submitted",
            speakers: ["nonexistent-speaker"],
            submittedDayOffset: 0,
            answers: {},
          },
        ],
      }),
      now: NOW,
    });

    expect(plan.unknownSpeakerKeys).toEqual(["nonexistent-speaker"]);
    expect(plan.unknownRefs).toEqual(["track:nonexistent-track"]);
  });
});
