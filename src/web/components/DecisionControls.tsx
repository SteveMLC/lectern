import type { ReviewDecision, SubmissionListItem } from "../../shared/contracts";
import { Button, cn } from "./ui";

/**
 * The one place decision buttons are rendered, shared by Reviews and
 * Submissions so the two surfaces can never disagree.
 *
 * The rule it encodes: the current status renders as STATE (a checked,
 * non-interactive chip), and only legal transitions render as ACTIONS.
 * An accepted proposal shows "Approved", not an Approve button — approving
 * what is already approved is not an action anyone needs.
 *
 * Mirrors canApplyDecision in src/shared/domain/decisions.ts:
 * - draft/withdrawn: locked, no controls.
 * - accepted: state only ("Approved · session live").
 * - rejected: state ("Denied") plus a rescue Approve.
 * - waitlisted: state ("Maybe") plus Approve and Deny.
 * - submitted/under_review: all three actions.
 */

const ACTION_STYLE: Record<ReviewDecision, string> = {
  approve: "bg-emerald-600 hover:bg-emerald-700",
  maybe: "bg-amber-500 hover:bg-amber-600",
  deny: "bg-rose-600 hover:bg-rose-700",
};

const ACTION_LABEL: Record<ReviewDecision, string> = {
  approve: "Approve",
  maybe: "Maybe",
  deny: "Deny",
};

const STATE_CHIP: Record<"accepted" | "waitlisted" | "rejected", { label: string; className: string }> = {
  accepted: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  waitlisted: { label: "Maybe", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Denied", className: "bg-rose-100 text-rose-800" },
};

/** Actions that make sense from each decided state. */
function availableActions(submission: SubmissionListItem): ReviewDecision[] {
  switch (submission.status) {
    case "draft":
    case "withdrawn":
      return [];
    case "accepted":
      return [];
    case "rejected":
      return ["approve"];
    case "waitlisted":
      return ["approve", "deny"];
    default:
      return ["approve", "maybe", "deny"];
  }
}

export function DecisionControls({
  submission,
  busy,
  anyBusy,
  onDecide,
  compact,
}: {
  submission: SubmissionListItem;
  busy: boolean;
  anyBusy: boolean;
  onDecide: (submission: SubmissionListItem, decision: ReviewDecision) => Promise<void>;
  compact?: boolean;
}) {
  if (submission.status === "draft" || submission.status === "withdrawn") {
    return (
      <p className="text-xs text-zinc-400">
        Locked — {submission.status === "draft" ? "still a draft" : "withdrawn by the speaker"}
      </p>
    );
  }

  const state =
    submission.status === "accepted" || submission.status === "waitlisted" || submission.status === "rejected"
      ? STATE_CHIP[submission.status]
      : null;
  const actions = availableActions(submission);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label={`Decision for ${submission.title}`}
    >
      {state ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-lg font-medium",
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            state.className,
          )}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {state.label}
        </span>
      ) : null}
      {submission.status === "accepted" ? (
        <span className="text-xs text-zinc-500">Session is live in the program.</span>
      ) : null}
      {actions.map((decision) => (
        <Button
          key={decision}
          type="button"
          className={cn(
            ACTION_STYLE[decision],
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs",
          )}
          disabled={anyBusy}
          onClick={() => void onDecide(submission, decision)}
        >
          {busy ? "…" : ACTION_LABEL[decision]}
        </Button>
      ))}
    </div>
  );
}
