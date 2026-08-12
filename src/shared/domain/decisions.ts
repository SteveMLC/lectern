import type { SubmissionStatus } from "../contracts";

export const REVIEW_DECISIONS = ["approve", "maybe", "deny"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

const TARGET_STATUS: Record<ReviewDecision, SubmissionStatus> = {
  approve: "accepted",
  maybe: "waitlisted",
  deny: "rejected",
};

export function statusForDecision(decision: ReviewDecision): SubmissionStatus {
  return TARGET_STATUS[decision];
}

/**
 * Accepted proposals already own a live session. Re-approving is intentionally
 * idempotent; changing that final decision requires a dedicated session
 * cancellation workflow so the program cannot drift out of sync.
 */
export function canApplyDecision(
  current: SubmissionStatus,
  decision: ReviewDecision,
): boolean {
  if (current === "draft" || current === "withdrawn") return false;
  if (current === "accepted") return decision === "approve";
  return true;
}

/**
 * The identity a committee note is filed under.
 *
 * The product opinion: a single decider by default, more voices only when
 * needed. One person never types a name and behaves exactly as before. A
 * team types names, and because review rows upsert on reviewer EMAIL, each
 * name needs its own deterministic address — same name replaces that
 * person's earlier note, different names stack. There are no accounts here
 * on purpose; the passcode is the trust boundary and the name is a label,
 * which is how small program teams actually work.
 */
export function reviewerIdentity(name?: string): { name: string; email: string } {
  const trimmed = name?.trim();
  if (!trimmed) {
    // Must stay byte-identical to the pre-feature identity so an upgrade
    // never duplicates the default reviewer's earlier notes.
    return { name: "Organizer", email: "organizer@lectern.local" };
  }

  let slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);

  if (!slug) {
    // Names with no ascii-alphanumeric characters (e.g. fully CJK) still get
    // a stable identity: a deterministic hash of the exact name.
    let hash = 5381;
    for (let i = 0; i < trimmed.length; i += 1) {
      hash = ((hash * 33) ^ trimmed.charCodeAt(i)) >>> 0;
    }
    slug = `reviewer.${hash.toString(16)}`;
  }

  return { name: trimmed, email: `${slug}@reviewers.lectern.local` };
}
