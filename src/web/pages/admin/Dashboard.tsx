import { Link } from "react-router";
import { SubmissionStatus } from "../../../shared/contracts";
import { Badge, Card, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export function Dashboard() {
  const { eventSlug, eventName } = useAdminContext();
  const { data, error, loading } = useAsync(() => apiClient.counts(eventSlug), [eventSlug]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={eventName} />

      {loading ? (
        <Spinner label="Loading counts" />
      ) : error || !data ? (
        <ErrorBanner message={error?.message ?? "Could not load counts."} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-zinc-500">Submissions</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{data.submissions}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SubmissionStatus.options
                .filter((s) => (data.submissionsByStatus[s] ?? 0) > 0)
                .map((s) => (
                  <Badge key={s} tone={STATUS_TONE[s]}>
                    {data.submissionsByStatus[s]} {STATUS_LABEL[s].toLowerCase()}
                  </Badge>
                ))}
            </div>
            <Link
              to="/admin/submissions"
              className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
            >
              Review submissions →
            </Link>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-zinc-500">Sessions</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{data.sessions}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Accepted submissions become sessions with their lineage kept; invited and sponsor
              sessions are added directly.
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-zinc-500">Speakers</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900">{data.speakers}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Everyone who has submitted or been invited, deduplicated by email per event.
            </p>
          </Card>
        </div>
      )}

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Try the golden path</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Open the public CFP in another tab, submit a proposal, then refresh Submissions here —
          the new proposal appears with its speaker attached. That round trip is the spine every
          other workflow builds on.
        </p>
        <Link
          to={`/e/${eventSlug}/cfp`}
          className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
        >
          Open public CFP form →
        </Link>
      </Card>
    </div>
  );
}
