import { describe, expect, it } from "vitest";
import type { OrganizerSession } from "../../../shared/contracts";
import { eventDateRange, placementForDrop } from "./Agenda";

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
    createdAt: now,
    updatedAt: now,
    speakers: [],
    slot,
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
