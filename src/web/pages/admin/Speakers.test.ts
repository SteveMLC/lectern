import { describe, expect, it } from "vitest";
import { filterSpeakerRoster, type SpeakerWithTaskProgress } from "./Speakers";

const speakers: SpeakerWithTaskProgress[] = [
  {
    id: "ada",
    name: "Ada Okafor",
    company: "Nimbus Labs",
    title: "Principal Engineer",
    bio: null,
    location: null,
    socials: null,
    headshotUrl: null,
    completedTasks: 1,
    totalTasks: 3,
  },
  {
    id: "priya",
    name: "Priya Sharma",
    company: "Evalworks",
    title: "Co-founder",
    bio: null,
    location: null,
    socials: null,
    headshotUrl: null,
    completedTasks: 2,
    totalTasks: 2,
  },
  {
    id: "omar",
    name: "Omar Haddad",
    company: "Stack Parliament",
    title: "Moderator",
    bio: null,
    location: null,
    socials: null,
    headshotUrl: null,
    completedTasks: 0,
    totalTasks: 0,
  },
];

describe("speaker roster filters", () => {
  it("searches name, title, and company case-insensitively", () => {
    expect(filterSpeakerRoster(speakers, "NIMBUS", "all").map(({ id }) => id)).toEqual(["ada"]);
    expect(filterSpeakerRoster(speakers, "moderator", "all").map(({ id }) => id)).toEqual(["omar"]);
  });

  it("filters aggregate task progress without treating no-task speakers as complete", () => {
    expect(filterSpeakerRoster(speakers, "", "needs_work").map(({ id }) => id)).toEqual(["ada"]);
    expect(filterSpeakerRoster(speakers, "", "complete").map(({ id }) => id)).toEqual(["priya"]);
    expect(filterSpeakerRoster(speakers, "", "no_tasks").map(({ id }) => id)).toEqual(["omar"]);
  });
});
