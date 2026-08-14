/**
 * Draft reminder policy, shared by the scheduled sweep that sends the mail and
 * by its tests. Pure and clock-injected, like the rest of src/shared/domain:
 * the sweep decides nothing on its own, it only supplies rows and sends what
 * this function approves.
 *
 * The rule the customer's close-date panel promises — "Set a close date to
 * enable draft reminder emails" — is exactly this: a close date turns the
 * reminder on, and no close date turns it off.
 */

/** How close the close date must be before a draft holder hears about it. */
export const DRAFT_REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface DraftReminderCandidate {
  /** Whatever email the draft carries so far. A draft may still have none. */
  email: string | null;
  /** The form's close date, or null when the organizer set none. */
  closesAt: string | null;
  /** When this draft was already reminded. Null means never. */
  remindedAt: string | null;
}

/**
 * True when this draft has earned exactly one reminder right now:
 * somewhere to send it, a close date, that date still ahead, near enough to
 * matter, and nobody has been told yet.
 */
export function shouldRemindDraft(candidate: DraftReminderCandidate, nowIso: string): boolean {
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) throw new TypeError(`Invalid now timestamp: ${JSON.stringify(nowIso)}`);

  // One reminder per draft, forever. A later close date does not buy a second.
  if (candidate.remindedAt !== null) return false;
  if (!candidate.email || !candidate.email.trim()) return false;
  if (candidate.closesAt === null) return false;

  const closesAt = Date.parse(candidate.closesAt);
  if (Number.isNaN(closesAt)) return false;

  // A closed call cannot be rescued, so a reminder would only annoy.
  if (closesAt <= now) return false;
  return closesAt - now <= DRAFT_REMINDER_WINDOW_MS;
}
