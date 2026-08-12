import type { AgendaSlot, OrganizerSession, ScheduleConflict, SessionSpeaker } from "../contracts";
import { zonedLocalInputToIso } from "./timezone";

/**
 * Pure scheduling logic. No I/O, no Date.now() — callers pass everything in,
 * so the same inputs always produce the same conflicts.
 */

function toEpoch(iso: string, label: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new TypeError(`Invalid ${label} timestamp: ${JSON.stringify(iso)}`);
  }
  return ms;
}

/**
 * Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd).
 * A slot ending exactly when another starts does NOT conflict.
 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toEpoch(aStart, "start");
  const ae = toEpoch(aEnd, "end");
  const bs = toEpoch(bStart, "start");
  const be = toEpoch(bEnd, "end");
  if (ae <= as) throw new RangeError(`Range A ends before it starts: ${aStart} .. ${aEnd}`);
  if (be <= bs) throw new RangeError(`Range B ends before it starts: ${bStart} .. ${bEnd}`);
  return as < be && bs < ae;
}

/**
 * Find every room double-booking and speaker double-booking in a set of agenda
 * slots. Slots reference sessions; speaker membership comes from sessionSpeakers.
 * Output order is deterministic (sorted by slot id pair, then type/subject).
 */
export function findScheduleConflicts(
  slots: readonly AgendaSlot[],
  sessionSpeakers: readonly SessionSpeaker[],
): ScheduleConflict[] {
  const sorted = [...slots].sort((a, b) => a.id.localeCompare(b.id));

  const speakersBySession = new Map<string, string[]>();
  for (const ss of sessionSpeakers) {
    const list = speakersBySession.get(ss.sessionId) ?? [];
    list.push(ss.speakerId);
    speakersBySession.set(ss.sessionId, list);
  }

  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (!rangesOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt)) continue;

      if (a.roomId !== null && b.roomId !== null && a.roomId === b.roomId) {
        conflicts.push({
          type: "room",
          slotIds: [a.id, b.id],
          sessionIds: [a.sessionId, b.sessionId],
          roomId: a.roomId,
          message: `Room double-booked: slots ${a.id} and ${b.id} overlap in room ${a.roomId}.`,
        });
      }

      const aSpeakers = speakersBySession.get(a.sessionId) ?? [];
      const bSpeakers = new Set(speakersBySession.get(b.sessionId) ?? []);
      const shared = [...new Set(aSpeakers)].filter((id) => bSpeakers.has(id)).sort();
      for (const speakerId of shared) {
        conflicts.push({
          type: "speaker",
          slotIds: [a.id, b.id],
          sessionIds: [a.sessionId, b.sessionId],
          speakerId,
          message: `Speaker double-booked: ${speakerId} is in overlapping slots ${a.id} and ${b.id}.`,
        });
      }
    }
  }

  return conflicts;
}

export interface AutoPlacement {
  sessionId: string;
  roomId: string;
  startsAt: string;
  endsAt: string;
}

/** Naive, deterministic 45-minute packer. It only accepts candidates that do
 * not overlap an occupied room or any session sharing a speaker. */
export function planAutoPlacements(
  sessions: readonly OrganizerSession[],
  roomIds: readonly string[],
  days: readonly string[],
  timezone: string,
): AutoPlacement[] {
  const occupied = sessions.filter((session) => session.slot).map((session) => ({
    sessionId: session.id,
    roomId: session.slot!.roomId,
    startsAt: session.slot!.startsAt,
    endsAt: session.slot!.endsAt,
    speakerIds: session.speakers.map((speaker) => speaker.id),
  }));
  const planned: AutoPlacement[] = [];
  for (const session of sessions.filter((candidate) => !candidate.slot).sort((a, b) => a.title.localeCompare(b.title))) {
    let placed: AutoPlacement | null = null;
    for (const day of days) {
      const dayStart = Date.parse(zonedLocalInputToIso(`${day}T09:00`, timezone));
      for (let offset = 0; offset < 8 * 60; offset += 45) {
        const startsAt = new Date(dayStart + offset * 60_000).toISOString();
        const endsAt = new Date(dayStart + (offset + 45) * 60_000).toISOString();
        for (const roomId of roomIds) {
          const speakerIds = new Set(session.speakers.map((speaker) => speaker.id));
          const conflict = occupied.some((slot) =>
            rangesOverlap(startsAt, endsAt, slot.startsAt, slot.endsAt) &&
            (slot.roomId === roomId || slot.speakerIds.some((speakerId) => speakerIds.has(speakerId))),
          );
          if (!conflict) { placed = { sessionId: session.id, roomId, startsAt, endsAt }; break; }
        }
        if (placed) break;
      }
      if (placed) break;
    }
    if (placed) {
      planned.push(placed);
      occupied.push({ ...placed, speakerIds: session.speakers.map((speaker) => speaker.id) });
    }
  }
  return planned;
}
