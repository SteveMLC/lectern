import { describe, expect, it } from "vitest";
import type { OrganizerSession } from "../../../shared/contracts";
import { conflictOverlap, eventDateRange, groupSessionsByDay, placementForDrop } from "./Agenda";

const now = "2026-08-10T00:00:00Z";

function session(id: string, slot: OrganizerSession["slot"] = null): OrganizerSession {
  return {
    id,
    eventId: "evt_1",
    sourceSubmissionId: null,
    trackId: "trk_1",
    trackName: "Engineering",
    title: id,
    abstract: "A complete session description.",
    format: "talk",
    status: "confirmed",
    origin: "direct",
    contentApprovalStatus: "approved",
    createdAt: now,
    updatedAt: now,
    speakers: [],
    slot,
    versionCount: 0,
  };
}

function slot(sessionId: string, roomId: string, startsAt: string, endsAt: string) {
  return {
    id: `slot_${sessionId}`,
    eventId: "evt_1",
    sessionId,
    roomId,
    startsAt,
    endsAt,
    createdAt: now,
    updatedAt: now,
  };
}

describe("agenda drag placement", () => {
  it("builds an inclusive event-day selector", () => {
    expect(eventDateRange("2026-10-14", "2026-10-15")).toEqual(["2026-10-14", "2026-10-15"]);
  });

  it("keeps an existing session time when dragged to another room", () => {
    const scheduled = session(
      "ses_1",
      slot("ses_1", "room_a", "2026-10-14T16:00:00.000Z", "2026-10-14T16:45:00.000Z"),
    );
    expect(placementForDrop(scheduled, "room_b", [scheduled], "2026-10-14", "UTC")).toEqual({
      roomId: "room_b",
      startsAt: "2026-10-14T16:00:00.000Z",
      endsAt: "2026-10-14T16:45:00.000Z",
    });
  });

  it("places an unscheduled session after the target room's last session", () => {
    const existing = session(
      "ses_existing",
      slot("ses_existing", "room_a", "2026-10-14T16:00:00.000Z", "2026-10-14T16:45:00.000Z"),
    );
    expect(placementForDrop(session("ses_new"), "room_a", [existing], "2026-10-14", "UTC")).toEqual({
      roomId: "room_a",
      startsAt: "2026-10-14T16:45:00.000Z",
      endsAt: "2026-10-14T17:30:00.000Z",
    });
  });
});

/** Compact shape for the assertions: day, then the ids placed on it. */
function dayIds(days: ReturnType<typeof groupSessionsByDay>): [string, string[]][] {
  return days.map((day) => [day.day, day.sessions.map((entry) => entry.id)]);
}

describe("agenda week grouping", () => {
  it("buckets placed sessions by day, earliest start first", () => {
    const late = session("ses_late", slot("ses_late", "room_a", "2026-10-14T18:00:00.000Z", "2026-10-14T18:45:00.000Z"));
    const early = session("ses_early", slot("ses_early", "room_a", "2026-10-14T16:00:00.000Z", "2026-10-14T16:45:00.000Z"));
    const second = session("ses_second", slot("ses_second", "room_b", "2026-10-15T16:00:00.000Z", "2026-10-15T16:45:00.000Z"));
    expect(dayIds(groupSessionsByDay([late, early, second], "UTC", "2026-10-14", "2026-10-15"))).toEqual([
      ["2026-10-14", ["ses_early", "ses_late"]],
      ["2026-10-15", ["ses_second"]],
    ]);
  });

  it("keeps a column for a day with nothing placed on it", () => {
    const only = session("ses_only", slot("ses_only", "room_a", "2026-10-15T16:00:00.000Z", "2026-10-15T16:45:00.000Z"));
    expect(dayIds(groupSessionsByDay([only], "UTC", "2026-10-14", "2026-10-16"))).toEqual([
      ["2026-10-14", []],
      ["2026-10-15", ["ses_only"]],
      ["2026-10-16", []],
    ]);
  });

  it("leaves out unplaced sessions and anything outside the event range", () => {
    const unplaced = session("ses_unplaced");
    const strayed = session("ses_strayed", slot("ses_strayed", "room_a", "2026-10-20T16:00:00.000Z", "2026-10-20T16:45:00.000Z"));
    expect(dayIds(groupSessionsByDay([unplaced, strayed], "UTC", "2026-10-14", "2026-10-15"))).toEqual([
      ["2026-10-14", []],
      ["2026-10-15", []],
    ]);
  });

  it("reads the day boundary in the event timezone, not the browser's", () => {
    // 02:00 UTC on the 15th is still the evening of the 14th in Los Angeles.
    const evening = session("ses_evening", slot("ses_evening", "room_a", "2026-10-15T02:00:00.000Z", "2026-10-15T02:45:00.000Z"));
    expect(dayIds(groupSessionsByDay([evening], "America/Los_Angeles", "2026-10-14", "2026-10-15"))).toEqual([
      ["2026-10-14", ["ses_evening"]],
      ["2026-10-15", []],
    ]);
    expect(dayIds(groupSessionsByDay([evening], "UTC", "2026-10-14", "2026-10-15"))).toEqual([
      ["2026-10-14", []],
      ["2026-10-15", ["ses_evening"]],
    ]);
  });

  it("returns one day for a one-day event", () => {
    expect(groupSessionsByDay([], "UTC", "2026-10-14", "2026-10-14")).toEqual([
      { day: "2026-10-14", sessions: [] },
    ]);
  });
});

function roomConflict(first: string, second: string) {
  return {
    type: "room" as const,
    slotIds: [`slot_${first}`, `slot_${second}`] as [string, string],
    sessionIds: [first, second] as [string, string],
    roomId: "room_a",
    message: `Room double-booked: ${first} and ${second}.`,
  };
}

describe("agenda conflict overlap", () => {
  it("returns the window the two sessions share", () => {
    const first = session("ses_a", slot("ses_a", "room_a", "2026-10-14T16:00:00.000Z", "2026-10-14T17:00:00.000Z"));
    const second = session("ses_b", slot("ses_b", "room_a", "2026-10-14T16:30:00.000Z", "2026-10-14T17:30:00.000Z"));
    expect(conflictOverlap(roomConflict("ses_a", "ses_b"), [first, second])).toEqual({
      startsAt: "2026-10-14T16:30:00.000Z",
      endsAt: "2026-10-14T17:00:00.000Z",
    });
  });

  it("returns null once the pair has been pulled apart", () => {
    const first = session("ses_a", slot("ses_a", "room_a", "2026-10-14T16:00:00.000Z", "2026-10-14T16:45:00.000Z"));
    const second = session("ses_b", slot("ses_b", "room_a", "2026-10-14T16:45:00.000Z", "2026-10-14T17:30:00.000Z"));
    expect(conflictOverlap(roomConflict("ses_a", "ses_b"), [first, second])).toBeNull();
  });

  it("returns null when one session has lost its slot", () => {
    const first = session("ses_a", slot("ses_a", "room_a", "2026-10-14T16:00:00.000Z", "2026-10-14T17:00:00.000Z"));
    expect(conflictOverlap(roomConflict("ses_a", "ses_b"), [first, session("ses_b")])).toBeNull();
  });
});
