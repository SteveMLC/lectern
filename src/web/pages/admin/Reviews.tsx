import { useState } from "react";
import type { ReviewDecision, SubmissionListItem } from "../../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
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

export function Reviews() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading, reload } = useAsync(
    () => apiClient.submissions(eventSlug),
    [eventSlug],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  return (
    <div>
      <PageHeader
        title="Review decisions"
        subtitle="Make the program call. Approval creates exactly one live session from the proposal."
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

      {loading ? (
        <Spinner label="Loading review queue" />
      ) : error ? (
        <ErrorBanner message={error.message} />
      ) : submissions.length === 0 ? (
        <EmptyState title="Nothing to review" body="New CFP submissions will appear here." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {submissions.map((submission) => (
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
  const speakerNames = submission.speakers.map((speaker) => speaker.name).join(", ");

  return (
    <Card className="flex min-h-72 flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {submission.trackName ?? "Unassigned"} · {submission.format}
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-zinc-900">
            {submission.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{speakerNames || "No speaker attached"}</p>
        </div>
        <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-zinc-600">{submission.abstract}</p>

      <div className="mt-5 border-t border-zinc-100 pt-4">
        {accepted ? (
          <p className="mb-3 text-xs text-zinc-500">
            This proposal owns a live session. Re-approval safely reuses it.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2" aria-label={`Decision for ${submission.title}`}>
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
        </div>
      </div>
    </Card>
  );
}
