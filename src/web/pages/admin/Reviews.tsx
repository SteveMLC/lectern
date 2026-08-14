import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { ReviewDecision, SubmissionListItem, SubmissionStatus } from "../../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  cn,
} from "../../components/ui";
import { DecisionControls } from "../../components/DecisionControls";
import { ApiRequestError, apiClient } from "../../lib/api";
import { pipelineStage } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

/** Queue order: everything awaiting a call first, decided last. */
const STATUS_RANK: Record<SubmissionStatus, number> = {
  submitted: 0,
  under_review: 1,
  waitlisted: 2,
  accepted: 3,
  rejected: 4,
  draft: 5,
  withdrawn: 6,
};

const NEEDS_DECISION: readonly SubmissionStatus[] = ["submitted", "under_review", "waitlisted"];

export function Reviews() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading, reload } = useAsync(
    () => apiClient.submissions(eventSlug),
    [eventSlug],
  );
  // Only to name which call a proposal came through — meaningful once an
  // event runs more than one submission form.
  const bundle = useAsync(() => apiClient.eventBundle(eventSlug), [eventSlug]);
  const formTitles = new Map(
    (bundle.data?.cfpForms ?? []).map((form) => [form.id, form.title]),
  );
  const showFormBadge = (bundle.data?.cfpForms ?? []).length > 1;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scope, setScope] = useState<"pending" | "all">("pending");

  async function decide(
    submission: SubmissionListItem,
    decision: ReviewDecision,
    reasoning: string,
    sessionTitle?: string,
    reviewerName?: string,
  ) {
    setBusyId(submission.id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiClient.decideSubmission(eventSlug, submission.id, {
        decision,
        reasoning,
        sessionTitle,
        reviewerName,
      });
      if (decision === "approve") {
        setNotice(
          result.reusedSession
            ? `“${submission.title}” was already accepted; its existing session was reused.`
            : `“${submission.title}” is accepted and now lives in the program.`,
        );
      } else {
        setNotice(
          `“${submission.title}” moved to ${decision === "maybe" ? "Maybe" : "Denied"}.`,
        );
      }
      reload();
    } catch (caught) {
      setActionError(
        caught instanceof ApiRequestError ? caught.message : "The decision could not be saved.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const submissions = data?.submissions ?? [];
  const pendingCount = submissions.filter((s) => NEEDS_DECISION.includes(s.status)).length;

  const visible = useMemo(() => {
    const scoped =
      scope === "pending"
        ? submissions.filter((s) => NEEDS_DECISION.includes(s.status))
        : submissions;
    return [...scoped].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  }, [submissions, scope]);

  return (
    <div>
      <PageHeader
        title="Review decisions"
        subtitle={`${pendingCount} ${pendingCount === 1 ? "proposal" : "proposals"} waiting on a call. Approval creates exactly one live session.`}
        actions={
          <Button variant="secondary" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {notice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-4">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1.5">
        <ScopeChip active={scope === "pending"} onClick={() => setScope("pending")}>
          Needs decision · {pendingCount}
        </ScopeChip>
        <ScopeChip active={scope === "all"} onClick={() => setScope("all")}>
          All · {submissions.length}
        </ScopeChip>
      </div>

      <p className="mb-4 text-xs leading-5 text-zinc-500">
        <span className="font-medium text-zinc-700">Where a proposal stands</span> is derived from
        the record, not a label someone remembered to set: <em>Awaiting first look</em> means no
        committee notes yet, <em>Under review</em> means a reviewer has weighed in, then
        Accepted, Waitlisted, or Denied. Every decision you make here saves your reasoning as a
        committee note.
      </p>

      {loading ? (
        <Spinner label="Loading review queue" />
      ) : error ? (
        <ErrorBanner message={error.message} />
      ) : visible.length === 0 ? (
        scope === "pending" ? (
          <EmptyState
            title="Nothing waiting on a decision"
            body="Every proposal has been decided. Switch to All to revisit past calls."
          />
        ) : (
          <EmptyState title="Nothing to review" body="New CFP submissions will appear here." />
        )
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((submission) => (
            <ReviewCard
              key={submission.id}
              submission={submission}
              formTitle={showFormBadge ? formTitles.get(submission.formId ?? "") ?? null : null}
              eventSlug={eventSlug}
              busy={busyId === submission.id}
              anyBusy={busyId !== null}
              onDecide={decide}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** "prior_speaking" -> "Prior speaking". */
function humanizeAnswerKey(key: string): string {
  const spaced = key.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The speaker's own form answers, as reviewable facts. */
export function answerFacts(answers: Record<string, unknown>): string[] {
  return Object.entries(answers)
    .map(([key, value]) => {
      if (typeof value === "boolean") return value ? humanizeAnswerKey(key) : null;
      if (typeof value === "string" && value.trim()) {
        return `${humanizeAnswerKey(key)}: ${value}`;
      }
      if (typeof value === "number") return `${humanizeAnswerKey(key)}: ${value}`;
      return null;
    })
    .filter((fact): fact is string => fact !== null);
}

function ReviewCard({
  submission,
  formTitle,
  eventSlug,
  busy,
  anyBusy,
  onDecide,
}: {
  submission: SubmissionListItem;
  /** Which call the proposal came through; null hides the badge. */
  formTitle: string | null;
  eventSlug: string;
  busy: boolean;
  anyBusy: boolean;
  onDecide: (
    submission: SubmissionListItem,
    decision: ReviewDecision,
    reasoning: string,
    sessionTitle?: string,
    reviewerName?: string,
  ) => Promise<void>;
}) {
  const primary = submission.speakers[0];
  const facts = answerFacts(submission.answers);
  const stage = pipelineStage(submission);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {submission.referenceCode ? `${submission.referenceCode} · ` : ""}
            {submission.trackName ?? "Unassigned"} · {submission.format}
            {formTitle ? ` · ${formTitle}` : ""}
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-zinc-900">
            {submission.title}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <Badge tone={stage.tone}>{stage.label}</Badge>
          <p className="mt-1 text-[11px] text-zinc-400">{stage.detail}</p>
        </div>
      </div>

      <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600">{submission.abstract}</p>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Speaker{submission.speakers.length > 1 ? "s" : ""}
        </p>
        {submission.speakers.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">No speaker attached.</p>
        ) : (
          <div className="mt-1.5 space-y-2">
            {submission.speakers.map((speaker) => (
              <div key={speaker.speakerId} className="text-sm">
                <p className="font-medium text-zinc-900">
                  {speaker.name}
                  {speaker.company ? (
                    <span className="font-normal text-zinc-500"> · {speaker.company}</span>
                  ) : null}
                  {speaker.role === "co_speaker" ? (
                    <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600">
                      {speaker.roleLabel?.trim() || "co-speaker"}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500">{speaker.email}</p>
              </div>
            ))}
            {primary?.bio ? (
              <p className="border-t border-zinc-200 pt-2 text-xs leading-5 text-zinc-600">
                {primary.bio}
              </p>
            ) : (
              <p className="border-t border-zinc-200 pt-2 text-xs italic text-zinc-400">
                No bio provided yet.
              </p>
            )}
          </div>
        )}
        {facts.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <span
                key={fact}
                className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600"
              >
                {fact}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {submission.reviews.length > 0 ? (
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            Committee notes
          </p>
          <div className="mt-1.5 space-y-1.5">
            {submission.reviews.map((review) => (
              <p
                key={`${review.reviewerName}-${review.submittedAt}`}
                className="text-xs leading-5 text-zinc-700"
              >
                <span className="font-medium text-zinc-900">{review.reviewerName}</span>
                <span className="sr-only">, recommendation </span>
                <span
                  className={cn(
                    "ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                    review.recommendation === "accept"
                      ? "bg-emerald-100 text-emerald-700"
                      : review.recommendation === "reject"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700",
                  )}
                >
                  {review.recommendation}
                </span>
                {review.comment ? (
                  <>
                    <span className="sr-only">: </span>
                    <span className="ml-1.5">{review.comment}</span>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <DecisionControls
            eventSlug={eventSlug}
            submission={submission}
            busy={busy}
            anyBusy={anyBusy}
            onDecide={onDecide}
          />
          {primary && submission.status !== "draft" && submission.status !== "withdrawn" ? (
            <Link
              to={`/admin/communications?speaker=${encodeURIComponent(primary.speakerId)}`}
              className="ml-auto text-sm font-medium text-accent hover:underline"
            >
              Request more info →
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
      )}
    >
      {children}
    </button>
  );
}
