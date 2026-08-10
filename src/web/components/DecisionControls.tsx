import { useState } from "react";
import type {
  FeedbackDraftResponse,
  ReviewDecision,
  SubmissionListItem,
} from "../../shared/contracts";
import { ApiRequestError, apiClient } from "../lib/api";
import { Button, Textarea, cn } from "./ui";

/**
 * The one place decision buttons are rendered, shared by Reviews and
 * Submissions so the two surfaces can never disagree.
 *
 * The rule it encodes: the current status renders as STATE (a checked,
 * non-interactive chip), and only legal transitions render as ACTIONS.
 *
 * Deny and Maybe open the feedback flow: the organizer writes their blunt
 * internal reasoning, a draft email is composed from it (Claude when a key is
 * configured, an honest template otherwise), the organizer edits, and only
 * "Send & deny/waitlist" commits — decision applied, simulated send recorded.
 * AI proposes, the human approves, the deterministic system commits. Nothing
 * is ever auto-sent, and skipping the email entirely stays one click away.
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

type FeedbackDecision = "deny" | "maybe";

interface FlowState {
  decision: FeedbackDecision;
  stage: "reasoning" | "drafting" | "editing";
  reasoning: string;
  draft?: FeedbackDraftResponse;
  subject: string;
  body: string;
  error?: string;
  sending?: boolean;
}

export function DecisionControls({
  submission,
  eventSlug,
  busy,
  anyBusy,
  onDecide,
  compact,
}: {
  submission: SubmissionListItem;
  eventSlug: string;
  busy: boolean;
  anyBusy: boolean;
  onDecide: (submission: SubmissionListItem, decision: ReviewDecision) => Promise<void>;
  compact?: boolean;
}) {
  const [flow, setFlow] = useState<FlowState | null>(null);

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
  const primarySpeaker = submission.speakers[0];

  function beginAction(decision: ReviewDecision) {
    if (decision === "approve") {
      void onDecide(submission, decision);
      return;
    }
    // Deny/Maybe: open the feedback flow instead of committing immediately.
    setFlow({ decision, stage: "reasoning", reasoning: "", subject: "", body: "" });
  }

  async function draftEmail(current: FlowState) {
    setFlow({ ...current, stage: "drafting", error: undefined });
    try {
      const draft = await apiClient.feedbackDraft(eventSlug, submission.id, {
        decision: current.decision,
        reasoning: current.reasoning,
      });
      setFlow({
        ...current,
        stage: "editing",
        draft,
        subject: draft.subject,
        body: draft.bodyMd,
      });
    } catch (error) {
      setFlow({
        ...current,
        stage: "reasoning",
        error:
          error instanceof ApiRequestError ? error.message : "Drafting failed — try again.",
      });
    }
  }

  async function sendAndCommit(current: FlowState) {
    setFlow({ ...current, sending: true, error: undefined });
    try {
      if (primarySpeaker) {
        await apiClient.simulateCommunication(eventSlug, {
          speakerId: primarySpeaker.speakerId,
          subject: current.subject,
          bodyMd: current.body,
        });
      }
      setFlow(null);
      await onDecide(submission, current.decision);
    } catch (error) {
      setFlow({
        ...current,
        sending: false,
        error: error instanceof ApiRequestError ? error.message : "Send failed — try again.",
      });
    }
  }

  async function commitWithoutEmail(current: FlowState) {
    setFlow(null);
    await onDecide(submission, current.decision);
  }

  const decisionVerb = (d: FeedbackDecision) => (d === "deny" ? "deny" : "waitlist");

  return (
    <div className={cn("space-y-2", compact ? "min-w-52" : "")}>
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
            disabled={anyBusy || flow !== null}
            onClick={() => beginAction(decision)}
          >
            {busy ? "…" : ACTION_LABEL[decision]}
          </Button>
        ))}
      </div>

      {flow ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left">
          {flow.stage === "reasoning" || flow.stage === "drafting" ? (
            <>
              <p className="text-xs font-semibold text-zinc-800">
                Why {decisionVerb(flow.decision)} “{submission.title}”?
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                Write it bluntly — this stays internal. It becomes the basis of a
                thoughtful feedback email you review before anything is sent.
              </p>
              <Textarea
                value={flow.reasoning}
                onChange={(e) => setFlow({ ...flow, reasoning: e.target.value })}
                placeholder={'e.g. "ran this topic last year; abstract has no real numbers; better fit for a meetup"'}
                className="mt-2 min-h-20 bg-white text-xs"
                disabled={flow.stage === "drafting"}
              />
              {flow.error ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{flow.error}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  className="px-2.5 py-1 text-xs"
                  disabled={flow.stage === "drafting"}
                  onClick={() => void draftEmail(flow)}
                >
                  {flow.stage === "drafting" ? "Drafting…" : "Draft feedback email"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-xs"
                  disabled={flow.stage === "drafting"}
                  onClick={() => void commitWithoutEmail(flow)}
                >
                  {ACTION_LABEL[flow.decision]} without email
                </Button>
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-zinc-700"
                  onClick={() => setFlow(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-800">
                  Feedback email to {primarySpeaker?.name ?? "the speaker"}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    flow.draft?.aiUsed
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-zinc-200 text-zinc-600",
                  )}
                >
                  {flow.draft?.aiUsed
                    ? `Drafted by ${flow.draft.model ?? "Claude"} from your notes`
                    : "Template draft — AI not configured"}
                </span>
              </div>
              {flow.reasoning ? (
                <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                  Your notes: {flow.reasoning}
                </p>
              ) : null}
              <input
                value={flow.subject}
                onChange={(e) => setFlow({ ...flow, subject: e.target.value })}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 focus:border-accent focus:outline-none"
                aria-label="Email subject"
              />
              <Textarea
                value={flow.body}
                onChange={(e) => setFlow({ ...flow, body: e.target.value })}
                className="mt-1.5 min-h-40 bg-white text-xs leading-5"
                aria-label="Email body"
              />
              {flow.draft?.note ? (
                <p className="mt-1 text-[11px] text-zinc-400">{flow.draft.note}</p>
              ) : null}
              {flow.error ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{flow.error}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  className={cn(ACTION_STYLE[flow.decision], "px-2.5 py-1 text-xs")}
                  disabled={flow.sending || !flow.subject.trim() || !flow.body.trim()}
                  onClick={() => void sendAndCommit(flow)}
                >
                  {flow.sending
                    ? "Sending…"
                    : `Send (simulated) & ${decisionVerb(flow.decision)}`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-xs"
                  disabled={flow.sending}
                  onClick={() => void draftEmail(flow)}
                >
                  Redraft
                </Button>
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-zinc-700"
                  onClick={() => setFlow(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
