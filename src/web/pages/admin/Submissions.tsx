import { useMemo, useState } from "react";
import type { SubmissionListItem, SubmissionStatus } from "../../../shared/contracts";
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
import { apiClient } from "../../lib/api";
import { STATUS_LABEL, STATUS_TONE, formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

type Filter = "all" | SubmissionStatus;

export function Submissions() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading, reload } = useAsync(
    () => apiClient.submissions(eventSlug),
    [eventSlug],
  );
  const [filter, setFilter] = useState<Filter>("all");

  const submissions = data?.submissions ?? [];

  const countsByStatus = useMemo(() => {
    const counts = new Map<SubmissionStatus, number>();
    for (const s of submissions) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
    return counts;
  }, [submissions]);

  const visible = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

  return (
    <div>
      <PageHeader
        title="Submissions"
        subtitle="Every proposal from the public CFP, newest first."
        actions={
          <Button variant="secondary" onClick={reload}>
            Refresh
          </Button>
        }
      />

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
          <div className="mb-4 flex flex-wrap gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All · {submissions.length}
            </FilterChip>
            {[...countsByStatus.entries()].map(([status, count]) => (
              <FilterChip
                key={status}
                active={filter === status}
                onClick={() => setFilter(status)}
              >
                {STATUS_LABEL[status]} · {count}
              </FilterChip>
            ))}
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">Proposal</th>
                  <th className="px-4 py-3 font-medium">Track</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <SubmissionRow key={s.id} submission={s} />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function SubmissionRow({ submission }: { submission: SubmissionListItem }) {
  const speakerLine = submission.speakers
    .map((sp) => (sp.company ? `${sp.name} (${sp.company})` : sp.name))
    .join(", ");

  return (
    <tr className="border-b border-zinc-100 align-top last:border-0 hover:bg-zinc-50/70">
      <td className="max-w-90 px-4 py-3">
        <p className="font-medium text-zinc-900">{submission.title}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500" title={speakerLine}>
          {speakerLine || "No speaker attached"}
        </p>
      </td>
      <td className="px-4 py-3 text-zinc-600">{submission.trackName ?? "—"}</td>
      <td className="px-4 py-3 capitalize text-zinc-600">{submission.format}</td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
        {formatDateTime(submission.submittedAt)}
      </td>
    </tr>
  );
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
