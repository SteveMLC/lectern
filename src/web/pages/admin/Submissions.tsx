import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  SubmissionStatus,
  type ReviewDecision,
  type SubmissionListItem,
  type SubmissionStatus as SubmissionStatusType,
} from "../../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Spinner,
  cn,
} from "../../components/ui";
import { DecisionControls } from "../../components/DecisionControls";
import { ApiRequestError, apiClient, getPasscode } from "../../lib/api";
import { STATUS_LABEL, STATUS_TONE, formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

type Filter = "all" | SubmissionStatusType;

interface DecisionState {
  eventSlug: string;
  busyId: string | null;
  decide: (submission: SubmissionListItem, decision: ReviewDecision, reasoning: string) => Promise<void>;
}

export function Submissions() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading, reload } = useAsync(
    () => apiClient.submissions(eventSlug),
    [eventSlug],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const submissions = data?.submissions ?? [];

  async function decide(submission: SubmissionListItem, decision: ReviewDecision, reasoning: string) {
    setBusyId(submission.id);
    setNotice(null);
    setActionError(null);
    try {
      const result = await apiClient.decideSubmission(eventSlug, submission.id, {
        decision,
        reasoning,
      });
      if (decision === "approve") {
        setNotice(
          result.reusedSession
            ? `“${submission.title}” was already accepted; its existing session was reused.`
            : `“${submission.title}” is accepted and now lives in the program.`,
        );
      } else {
        setNotice(`“${submission.title}” moved to ${decision === "maybe" ? "Maybe" : "Denied"}.`);
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

  const countsByStatus = useMemo(() => {
    const counts = new Map<SubmissionStatus, number>();
    for (const s of submissions) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
    return counts;
  }, [submissions]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return submissions.filter((submission) => {
      const matchesStatus = filter === "all" || submission.status === filter;
      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;
      const speakerText = submission.speakers
        .map((speaker) => `${speaker.name} ${speaker.email} ${speaker.company ?? ""}`)
        .join(" ");
      return [
        submission.title,
        submission.abstract,
        submission.trackName ?? "",
        submission.format,
        speakerText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, query, submissions]);

  const needsTriage = countsByStatus.get("submitted") ?? 0;
  const readyForReview = submissions.filter(
    (submission) => getCompleteness(submission).percent === 100,
  ).length;

  const decisionState: DecisionState = { eventSlug, busyId, decide };

  async function exportCsv() {
    const res = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/submissions.csv`, {
      headers: { authorization: `Bearer ${getPasscode() ?? ""}` },
    });
    if (!res.ok) {
      setActionError("CSV export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `submissions-${eventSlug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Submissions"
        subtitle="Every proposal from the public CFP, newest first. Decide here, or work the queue in Reviews."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/reviews"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
            >
              Review queue
            </Link>
            <Button variant="secondary" onClick={() => void exportCsv()}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={reload}>
              Refresh
            </Button>
          </div>
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
        <Spinner label="Loading submissions" />
      ) : error ? (
        <ErrorBanner message={error.message} />
      ) : submissions.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          body="Share the public CFP link to start collecting proposals."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <SummaryTile label="Total proposals" value={submissions.length} />
            <SummaryTile label="Needs triage" value={needsTriage} />
            <SummaryTile label="Complete records" value={readyForReview} />
          </div>

          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                All · {submissions.length}
              </FilterChip>
              {SubmissionStatus.options.map((status) => (
                <FilterChip
                  key={status}
                  active={filter === status}
                  onClick={() => setFilter(status)}
                >
                  {STATUS_LABEL[status]} · {countsByStatus.get(status) ?? 0}
                </FilterChip>
              ))}
            </div>
            <div className="w-full xl:w-80">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, speaker, track"
                aria-label="Search submissions"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState title="No matching submissions" body="Adjust the filter or search term." />
          ) : (
            <>
              <Card className="hidden overflow-x-auto rounded-lg lg:block">
                <table className="w-full min-w-[62rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-3">Proposal</th>
                      <th className="px-4 py-3">Speakers</th>
                      <th className="px-4 py-3">Program</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Completeness</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((submission) => (
                      <SubmissionRow
                        key={submission.id}
                        submission={submission}
                        decisionState={decisionState}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>

              <div className="space-y-3 lg:hidden">
                {visible.map((submission) => (
                  <SubmissionMobileCard
                    key={submission.id}
                    submission={submission}
                    decisionState={decisionState}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SubmissionRow({
  submission,
  decisionState,
}: {
  submission: SubmissionListItem;
  decisionState: DecisionState;
}) {
  const speakerLine = submission.speakers
    .map((sp) => (sp.company ? `${sp.name} (${sp.company})` : sp.name))
    .join(", ");

  return (
    <tr className="border-b border-zinc-100 align-top last:border-0 hover:bg-zinc-50/70">
      <td className="max-w-96 px-4 py-4">
        <p className="font-medium text-zinc-900">{submission.title}</p>
        <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-zinc-500">
          {submission.abstract}
        </p>
      </td>
      <td className="max-w-60 px-4 py-4">
        <p className="truncate text-sm text-zinc-700" title={speakerLine}>
          {speakerLine || "No speaker attached"}
        </p>
        <p className="mt-1 truncate text-xs text-zinc-500" title={submission.speakers[0]?.email}>
          {submission.speakers[0]?.email ?? "No email"}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm text-zinc-700">{submission.trackName ?? "Unassigned"}</p>
        <p className="mt-1 text-xs capitalize text-zinc-500">{submission.format}</p>
      </td>
      <td className="px-4 py-4">
        <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
      </td>
      <td className="px-4 py-4">
        <CompletenessIndicator submission={submission} />
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
        {formatDateTime(submission.submittedAt)}
      </td>
      <td className="px-4 py-4">
        <DecisionControls
            eventSlug={decisionState.eventSlug}
          submission={submission}
          busy={decisionState.busyId === submission.id}
          anyBusy={decisionState.busyId !== null}
          onDecide={decisionState.decide}
          compact
        />
      </td>
    </tr>
  );
}

function SubmissionMobileCard({
  submission,
  decisionState,
}: {
  submission: SubmissionListItem;
  decisionState: DecisionState;
}) {
  const speakerLine = submission.speakers
    .map((speaker) => (speaker.company ? `${speaker.name} (${speaker.company})` : speaker.name))
    .join(", ");

  return (
    <Card className="rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">{submission.title}</p>
          <p className="mt-1 truncate text-xs text-zinc-500" title={speakerLine}>
            {speakerLine || "No speaker attached"}
          </p>
        </div>
        <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
      </div>
      <p className="mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-zinc-600">
        {submission.abstract}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MobileFact label="Track" value={submission.trackName ?? "Unassigned"} />
        <MobileFact label="Format" value={submission.format} capitalize />
        <MobileFact label="Submitted" value={formatDateTime(submission.submittedAt)} />
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Completeness</p>
          <div className="mt-1">
            <CompletenessIndicator submission={submission} />
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <DecisionControls
            eventSlug={decisionState.eventSlug}
          submission={submission}
          busy={decisionState.busyId === submission.id}
          anyBusy={decisionState.busyId !== null}
          onDecide={decisionState.decide}
        />
      </div>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-lg p-4">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
    </Card>
  );
}

function MobileFact({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className={cn("mt-1 truncate text-zinc-800", capitalize && "capitalize")} title={value}>
        {value}
      </p>
    </div>
  );
}

function CompletenessIndicator({ submission }: { submission: SubmissionListItem }) {
  const completeness = getCompleteness(submission);
  return (
    <div className="min-w-36">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-600">{completeness.label}</span>
        <span className="text-xs text-zinc-500">{completeness.percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={cn(
            "h-full rounded-full",
            completeness.percent === 100 ? "bg-emerald-500" : "bg-amber-500",
          )}
          style={{ width: `${completeness.percent}%` }}
        />
      </div>
      {completeness.issues.length > 0 ? (
        <p className="mt-1 truncate text-xs text-zinc-500" title={completeness.issues.join(", ")}>
          {completeness.issues[0]}
        </p>
      ) : null}
    </div>
  );
}

function getCompleteness(submission: SubmissionListItem) {
  const checks = [
    { done: submission.title.trim().length >= 4, issue: "Missing title" },
    { done: submission.speakers.length > 0, issue: "No speaker" },
    { done: Boolean(submission.trackName), issue: "No track" },
    { done: submission.abstract.trim().length >= 80, issue: "Short abstract" },
  ];
  const done = checks.filter((check) => check.done).length;
  const percent = Math.round((done / checks.length) * 100);
  return {
    percent,
    issues: checks.filter((check) => !check.done).map((check) => check.issue),
    label: done === checks.length ? "Ready" : `${done}/${checks.length}`,
  };
}

function FilterChip({
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
