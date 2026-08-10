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
import { ApiRequestError, apiClient } from "../../lib/api";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

const ACTIONS: readonly {
  decision: ReviewDecision;
  label: string;
  className: string;
}[] = [
  { decision: "approve", label: "Approve", className: "bg-emerald-600 hover:bg-emerald-700" },
  { decision: "maybe", label: "Maybe", className: "bg-amber-500 hover:bg-amber-600" },
  { decision: "deny", label: "Deny", className: "bg-rose-600 hover:bg-rose-700" },
];

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scope, setScope] = useState<"pending" | "all">("pending");

  async function decide(submission: SubmissionListItem, decision: ReviewDecision) {
    setBusyId(submission.id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiClient.decideSubmission(eventSlug, submission.id, { decision });
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
        subtitle={`${pendingCount} proposal(s) waiting on a call. Approval creates exactly one live session.`}
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

      <div className="mb-4 flex flex-wrap gap-1.5">
        <ScopeChip active={scope === "pending"} onClick={() => setScope("pending")}>
          Needs decision · {pendingCount}
        </ScopeChip>
        <ScopeChip active={scope === "all"} onClick={() => setScope("all")}>
          All · {submissions.length}
        </ScopeChip>
      </div>

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
  busy,
  anyBusy,
  onDecide,
}: {
  submission: SubmissionListItem;
  busy: boolean;
  anyBusy: boolean;
  onDecide: (submission: SubmissionListItem, decision: ReviewDecision) => Promise<void>;
}) {
  const accepted = submission.status === "accepted";
  const locked = submission.status === "draft" || submission.status === "withdrawn";
  const primary = submission.speakers[0];
  const facts = answerFacts(submission.answers);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {submission.trackName ?? "Unassigned"} · {submission.format}
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-zinc-900">
            {submission.title}
          </h2>
        </div>
        <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
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
                      co-speaker
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

      <div className="mt-4 border-t border-zinc-100 pt-4">
        {accepted ? (
          <p className="mb-3 text-xs text-zinc-500">
            This proposal owns a live session. Re-approval safely reuses it.
          </p>
        ) : null}
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label={`Decision for ${submission.title}`}
        >
          {ACTIONS.map((action) => (
            <Button
              key={action.decision}
              type="button"
              className={action.className}
              disabled={anyBusy || locked || (accepted && action.decision !== "approve")}
              onClick={() => void onDecide(submission, action.decision)}
            >
              {busy ? "Saving…" : action.label}
            </Button>
          ))}
          {primary && !locked ? (
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
