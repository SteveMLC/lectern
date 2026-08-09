import { describe, expect, it } from "vitest";
import eventFile from "../../../demo-data/liam-conference.event.json";
import speakersFile from "../../../demo-data/liam-conference.speakers.json";
import submissionsFile from "../../../demo-data/liam-conference.submissions.json";
import {
  DemoEventFile,
  DemoSpeakersFile,
  DemoSubmissionsFile,
} from "../contracts/demoData";
import { buildDemoLoadPlan } from "./demoLoader";
import { findScheduleConflicts } from "./schedule";

/**
 * Validates the hand-authored files in demo-data/ and prints what they will
 * produce. This is what `pnpm demo:check` runs, and it is also part of the
 * normal test suite, so nobody can merge demo data that will not load.
 *
 * Failures name the file, the field, and what is wrong — written for someone
 * who is editing JSON, not reading TypeScript.
 */

function problems(result: { success: boolean; error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } }): string[] {
  if (result.success) return [];
  return (result.error?.issues ?? []).map(
    (i) => `${i.path.length ? i.path.join(" → ") : "(root)"}: ${i.message}`,
  );
}

const eventResult = DemoEventFile.safeParse(eventFile);
const speakersResult = DemoSpeakersFile.safeParse(speakersFile);
const submissionsResult = DemoSubmissionsFile.safeParse(submissionsFile);

describe("demo-data files are valid", () => {
  it("liam-conference.event.json", () => {
    expect(problems(eventResult)).toEqual([]);
  });

  it("liam-conference.speakers.json", () => {
    expect(problems(speakersResult)).toEqual([]);
  });

  it("liam-conference.submissions.json", () => {
    expect(problems(submissionsResult)).toEqual([]);
  });

  it("all three files name the same event", () => {
    if (!eventResult.success || !speakersResult.success || !submissionsResult.success) return;
    expect({
      speakers: speakersResult.data.event,
      submissions: submissionsResult.data.event,
    }).toEqual({
      speakers: eventResult.data.key,
      submissions: eventResult.data.key,
    });
  });
});

describe("demo-data loads into a usable conference", () => {
  if (!eventResult.success || !speakersResult.success || !submissionsResult.success) {
    it("skipped — fix the validation failures above first", () => {
      expect(true).toBe(true);
    });
    return;
  }

  const plan = buildDemoLoadPlan({
    dataset: {
      event: eventResult.data,
      speakers: speakersResult.data.speakers,
      submissions: submissionsResult.data.submissions,
    },
    now: "2026-01-01T00:00:00.000Z",
  });
  const conflicts = findScheduleConflicts(plan.agendaSlots, plan.sessionSpeakers);

  it("has no references to speakers, tracks, or rooms that do not exist", () => {
    expect({
      speakers: plan.unknownSpeakerKeys,
      other: plan.unknownRefs,
    }).toEqual({ speakers: [], other: [] });
  });

  it("turns accepted submissions into sessions that keep their lineage", () => {
    const accepted = plan.submissions.filter((s) => s.status === "accepted");
    const withLineage = plan.sessions.filter((s) => s.sourceSubmissionId !== null);
    expect(withLineage).toHaveLength(accepted.length);
  });

  it("includes at least one invited session that never went through the CFP", () => {
    expect(plan.sessions.filter((s) => s.origin === "direct").length).toBeGreaterThan(0);
  });

  it("stages schedule conflicts for the agenda view to catch", () => {
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("leaves some speaker tasks outstanding so the dashboard has work to show", () => {
    expect(plan.speakerTasks.filter((t) => t.status !== "complete").length).toBeGreaterThan(0);
  });

  it("prints a summary of what will load", () => {
    const byStatus: Record<string, number> = {};
    for (const s of plan.submissions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

    const lines = [
      "",
      `  ${eventResult.data.name}  (/e/${plan.event.slug})`,
      `  ${plan.tracks.length} tracks · ${plan.rooms.length} rooms · ${plan.speakers.length} speakers`,
      `  ${plan.submissions.length} submissions — ${Object.entries(byStatus)
        .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
        .join(", ")}`,
      `  ${plan.sessions.length} sessions — ${
        plan.sessions.filter((s) => s.sourceSubmissionId !== null).length
      } from accepted submissions, ${
        plan.sessions.filter((s) => s.origin === "direct").length
      } added directly`,
      `  ${plan.agendaSlots.length} scheduled · ${
        plan.speakerTasks.filter((t) => t.status !== "complete").length
      } outstanding speaker tasks`,
      "",
      `  ${conflicts.length} conflict(s) staged:`,
      ...conflicts.map((c) => `    [${c.type}] ${c.message}`),
      "",
      "  Load it: start the app, open /demo, press Load.",
      "",
    ];
    console.log(lines.join("\n"));
    expect(plan.event.slug).toBeTruthy();
  });
});
