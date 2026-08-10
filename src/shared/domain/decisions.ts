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
