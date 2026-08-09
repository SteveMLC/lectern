import type { AgendaSlot, ScheduleConflict, SessionSpeaker } from "../contracts";

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
