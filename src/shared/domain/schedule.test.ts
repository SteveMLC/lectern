import { describe, expect, it } from "vitest";
import type { AgendaSlot, SessionSpeaker } from "../contracts";
import { findScheduleConflicts, rangesOverlap } from "./schedule";

const T = (hhmm: string) => `2026-10-14T${hhmm}:00Z`;

function slot(partial: {
  id: string;
  sessionId: string;
  roomId: string | null;
  start: string;
  end: string;
}): AgendaSlot {
  return {
    id: partial.id,
    eventId: "evt_demo",
    sessionId: partial.sessionId,
    roomId: partial.roomId,
    startsAt: T(partial.start),
    endsAt: T(partial.end),
    createdAt: T("00:00"),
    updatedAt: T("00:00"),
  };
}

function speaker(sessionId: string, speakerId: string): SessionSpeaker {
  return { sessionId, speakerId, role: "primary", sortOrder: 0 };
}

describe("rangesOverlap", () => {
  it("returns false for disjoint ranges", () => {
    expect(rangesOverlap(T("09:00"), T("10:00"), T("11:00"), T("12:00"))).toBe(false);
  });

  it("returns false for back-to-back ranges (half-open intervals)", () => {
    expect(rangesOverlap(T("09:00"), T("10:00"), T("10:00"), T("11:00"))).toBe(false);
    expect(rangesOverlap(T("10:00"), T("11:00"), T("09:00"), T("10:00"))).toBe(false);
  });

  it("returns true for partial overlap in either direction", () => {
    expect(rangesOverlap(T("09:00"), T("10:00"), T("09:30"), T("10:30"))).toBe(true);
    expect(rangesOverlap(T("09:30"), T("10:30"), T("09:00"), T("10:00"))).toBe(true);
  });

  it("returns true when one range contains the other", () => {
    expect(rangesOverlap(T("09:00"), T("12:00"), T("10:00"), T("11:00"))).toBe(true);
    expect(rangesOverlap(T("10:00"), T("11:00"), T("09:00"), T("12:00"))).toBe(true);
  });

  it("returns true for identical ranges", () => {
    expect(rangesOverlap(T("09:00"), T("10:00"), T("09:00"), T("10:00"))).toBe(true);
  });

  it("throws on malformed timestamps", () => {
    expect(() => rangesOverlap("not-a-date", T("10:00"), T("09:00"), T("10:00"))).toThrow(
      TypeError,
    );
  });

  it("throws on inverted ranges", () => {
    expect(() => rangesOverlap(T("10:00"), T("09:00"), T("11:00"), T("12:00"))).toThrow(
      RangeError,
    );
  });
});

describe("findScheduleConflicts", () => {
  it("returns no conflicts for an empty agenda", () => {
    expect(findScheduleConflicts([], [])).toEqual([]);
  });

  it("detects a room double-booking", () => {
    const slots = [
      slot({ id: "slot_a", sessionId: "ses_1", roomId: "room_main", start: "10:00", end: "10:45" }),
      slot({ id: "slot_b", sessionId: "ses_2", roomId: "room_main", start: "10:30", end: "11:15" }),
    ];
    const conflicts = findScheduleConflicts(slots, []);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: "room",
      roomId: "room_main",
      slotIds: ["slot_a", "slot_b"],
      sessionIds: ["ses_1", "ses_2"],
    });
  });

  it("does not flag overlapping slots in different rooms without shared speakers", () => {
    const slots = [
      slot({ id: "slot_a", sessionId: "ses_1", roomId: "room_main", start: "10:00", end: "10:45" }),
      slot({ id: "slot_b", sessionId: "ses_2", roomId: "room_side", start: "10:00", end: "10:45" }),
    ];
    expect(findScheduleConflicts(slots, [speaker("ses_1", "spk_a"), speaker("ses_2", "spk_b")]))
      .toEqual([]);
  });

  it("detects a speaker double-booked across rooms", () => {
    const slots = [
      slot({ id: "slot_a", sessionId: "ses_1", roomId: "room_main", start: "10:00", end: "10:45" }),
      slot({ id: "slot_b", sessionId: "ses_2", roomId: "room_side", start: "10:30", end: "11:15" }),
    ];
    const conflicts = findScheduleConflicts(slots, [
      speaker("ses_1", "spk_shared"),
      speaker("ses_2", "spk_shared"),
      speaker("ses_2", "spk_other"),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: "speaker",
      speakerId: "spk_shared",
      slotIds: ["slot_a", "slot_b"],
    });
  });

  it("ignores unscheduled-room slots (null room) for room conflicts", () => {
    const slots = [
      slot({ id: "slot_a", sessionId: "ses_1", roomId: null, start: "10:00", end: "10:45" }),
      slot({ id: "slot_b", sessionId: "ses_2", roomId: null, start: "10:00", end: "10:45" }),
    ];
    expect(findScheduleConflicts(slots, [])).toEqual([]);
  });

  it("reports both room and speaker conflicts on the same pair", () => {
    const slots = [
      slot({ id: "slot_a", sessionId: "ses_1", roomId: "room_main", start: "10:00", end: "11:00" }),
      slot({ id: "slot_b", sessionId: "ses_2", roomId: "room_main", start: "10:30", end: "11:30" }),
    ];
    const conflicts = findScheduleConflicts(slots, [
      speaker("ses_1", "spk_shared"),
      speaker("ses_2", "spk_shared"),
    ]);
    expect(conflicts.map((c) => c.type).sort()).toEqual(["room", "speaker"]);
  });

  it("is deterministic regardless of input slot order", () => {
    const a = slot({ id: "slot_a", sessionId: "ses_1", roomId: "room_main", start: "10:00", end: "10:45" });
    const b = slot({ id: "slot_b", sessionId: "ses_2", roomId: "room_main", start: "10:30", end: "11:15" });
    const forward = findScheduleConflicts([a, b], []);
    const reversed = findScheduleConflicts([b, a], []);
    expect(forward).toEqual(reversed);
  });

  it("counts a speaker shared once even if linked twice to a session", () => {
    const slots = [
      slot({ id: "slot_a", sessionId: "ses_1", roomId: "room_a", start: "10:00", end: "10:45" }),
      slot({ id: "slot_b", sessionId: "ses_2", roomId: "room_b", start: "10:15", end: "11:00" }),
    ];
    const conflicts = findScheduleConflicts(slots, [
      speaker("ses_1", "spk_dup"),
      speaker("ses_1", "spk_dup"),
      speaker("ses_2", "spk_dup"),
    ]);
    expect(conflicts).toHaveLength(1);
  });
});
