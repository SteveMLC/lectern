import { describe, expect, it } from "vitest";
import type { OrganizerSession, Room } from "../../../shared/contracts";
import { describeSessionSlot, filterSpeakerRoster, sessionsForSpeaker, type SpeakerWithTaskProgress } from "./Speakers";

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
    email: "ada@nimbus.test",
    workflowStatus: "confirmed",
    logisticsNotes: null,
    tasks: [],
    assets: [], assetComments: [],
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
    email: "priya@eval.test",
    workflowStatus: "confirmed",
    logisticsNotes: "Vegetarian",
    tasks: [],
    assets: [], assetComments: [],
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
    email: "omar@stack.test",
    workflowStatus: "invited",
    logisticsNotes: null,
    tasks: [],
    assets: [], assetComments: [],
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

  it("filters the persistent workflow status", () => {
    expect(filterSpeakerRoster(speakers, "", "all", "confirmed").map(({ id }) => id)).toEqual(["ada", "priya"]);
    expect(filterSpeakerRoster(speakers, "", "all", "invited").map(({ id }) => id)).toEqual(["omar"]);
  });
});

const organizerSession = (
  id: string,
  title: string,
  speakerIds: string[],
  slot: { startsAt: string; endsAt: string; roomId: string | null } | null,
): OrganizerSession => ({
  id, eventId: "evt", sourceSubmissionId: null, trackId: null, trackName: null, title,
  abstract: "A complete program description.", format: "talk", status: "confirmed", origin: "direct",
  contentApprovalStatus: "approved", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
  speakers: speakerIds.map((speakerId, index) => ({ id: speakerId, name: `Speaker ${speakerId}`, company: null, title: null, role: "primary", sortOrder: index })),
  slot: slot ? { id: `slot_${id}`, eventId: "evt", sessionId: id, roomId: slot.roomId, startsAt: slot.startsAt, endsAt: slot.endsAt, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" } : null,
  versionCount: 0,
});

const programSessions: OrganizerSession[] = [
  organizerSession("late", "Zoned Rollouts", ["ada"], { startsAt: "2026-10-14T11:00:00Z", endsAt: "2026-10-14T11:45:00Z", roomId: "hall" }),
  organizerSession("early", "Reliable Agents", ["ada", "omar"], { startsAt: "2026-10-14T09:00:00Z", endsAt: "2026-10-14T09:45:00Z", roomId: "hall" }),
  organizerSession("floating", "Ask Me Anything", ["ada"], null),
];

describe("sessionsForSpeaker", () => {
  it("joins by speaker id and puts scheduled sessions first in start order", () => {
    expect(sessionsForSpeaker(programSessions, "ada").map(({ id }) => id)).toEqual(["early", "late", "floating"]);
    expect(sessionsForSpeaker(programSessions, "omar").map(({ id }) => id)).toEqual(["early"]);
    expect(sessionsForSpeaker(programSessions, "priya")).toEqual([]);
  });
});

describe("describeSessionSlot", () => {
  const rooms: Room[] = [{ id: "hall", eventId: "evt", name: "Main Hall", capacity: null, sortOrder: 0 }];

  it("formats day, time range, and room in the event timezone", () => {
    expect(describeSessionSlot(programSessions[1]!, rooms, "UTC")).toMatch(/^Oct 14 · 9:00\sAM–9:45\sAM · Main Hall$/);
  });

  it("omits the room when the slot has none and labels unplaced sessions", () => {
    const roomless = organizerSession("r", "Roomless", ["ada"], { startsAt: "2026-10-14T09:00:00Z", endsAt: "2026-10-14T09:45:00Z", roomId: null });
    expect(describeSessionSlot(roomless, rooms, "UTC")).toMatch(/^Oct 14 · 9:00\sAM–9:45\sAM$/);
    expect(describeSessionSlot(programSessions[2]!, rooms, "UTC")).toBe("Unscheduled");
  });
});
