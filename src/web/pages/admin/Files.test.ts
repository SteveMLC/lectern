import { describe, expect, it } from "vitest";
import type { OrganizerSpeakersResponse } from "../../../shared/contracts";
import { filterDeliverables, latestAssetIdsForSpeakers } from "./Files";

type OrganizerSpeaker = OrganizerSpeakersResponse["speakers"][number];
const base = {
  company: null,
  title: null,
  bio: null,
  location: null,
  socials: null,
  headshotUrl: null,
  workflowStatus: "confirmed" as const,
  logisticsNotes: null,
  tasks: [],
  assetComments: [],
};
const speakers: OrganizerSpeaker[] = [
  { ...base, id: "ada", name: "Ada Okafor", email: "ada@nimbus.test", company: "Nimbus Labs", completedTasks: 1, totalTasks: 3, assets: [{ id: "asset_1", speakerId: "ada", kind: "slides", filename: "slides.pdf", contentType: "application/pdf", sizeBytes: 42, r2Key: "x", taskId: null, sessionId: "session_1", versionNumber: 1, uploadedAt: "2026-08-11T00:00:00Z" }] },
  { ...base, id: "priya", name: "Priya Sharma", email: "priya@eval.test", completedTasks: 2, totalTasks: 2, assets: [] },
];

describe("deliverables dashboard filters", () => {
  it("searches speaker identity and company", () => {
    expect(filterDeliverables(speakers, "nimbus", "all").map(({ id }) => id)).toEqual(["ada"]);
    expect(filterDeliverables(speakers, "priya@", "all").map(({ id }) => id)).toEqual(["priya"]);
  });

  it("separates files, missing files, and incomplete task states", () => {
    expect(filterDeliverables(speakers, "", "has_files").map(({ id }) => id)).toEqual(["ada"]);
    expect(filterDeliverables(speakers, "", "missing_files").map(({ id }) => id)).toEqual(["priya"]);
    expect(filterDeliverables(speakers, "", "incomplete_tasks").map(({ id }) => id)).toEqual(["ada"]);
  });
});

describe("latestAssetIdsForSpeakers", () => {
  it("selects the newest version per speaker, kind, and task/session context", () => {
    const speaker: OrganizerSpeaker = {
      ...speakers[0]!,
      assets: [
        { id: "old", speakerId: "ada", kind: "slides", filename: "old.pdf", contentType: "application/pdf", sizeBytes: 1, r2Key: "old", taskId: "task", sessionId: null, versionNumber: 1, uploadedAt: "2026-01-01T00:00:00Z" },
        { id: "new", speakerId: "ada", kind: "slides", filename: "new.pdf", contentType: "application/pdf", sizeBytes: 1, r2Key: "new", taskId: "task", sessionId: null, versionNumber: 2, uploadedAt: "2026-01-02T00:00:00Z" },
        { id: "session", speakerId: "ada", kind: "slides", filename: "session.pdf", contentType: "application/pdf", sizeBytes: 1, r2Key: "session", taskId: null, sessionId: "ses", versionNumber: 1, uploadedAt: "2026-01-03T00:00:00Z" },
      ],
    };
    expect(latestAssetIdsForSpeakers([speaker], new Set(["ada"]))).toEqual(["new", "session"]);
  });
});
