import { describe, expect, it } from "vitest";
import type { OrganizerSpeakersResponse } from "../../../shared/contracts";
import { filterDeliverables } from "./Files";

type OrganizerSpeaker = OrganizerSpeakersResponse["speakers"][number];
const base = {
  company: null,
  title: null,
  bio: null,
  location: null,
  socials: null,
  headshotUrl: null,
};
const speakers: OrganizerSpeaker[] = [
  { ...base, id: "ada", name: "Ada Okafor", email: "ada@nimbus.test", company: "Nimbus Labs", completedTasks: 1, totalTasks: 3, assets: [{ id: "asset_1", speakerId: "ada", kind: "slides", filename: "slides.pdf", contentType: "application/pdf", sizeBytes: 42, r2Key: "x", uploadedAt: "2026-08-11T00:00:00Z" }] },
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
