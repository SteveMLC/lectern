import type { ComponentProps } from "react";
import { Link } from "react-router";
import { SubmissionStatus } from "../../../shared/contracts";
import { Badge, Card, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { STATUS_LABEL, STATUS_TONE, formatDateRange, formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export function Dashboard() {
  const { eventSlug, eventName } = useAdminContext();
  const {
    data: counts,
    error: countsError,
    loading: countsLoading,
  } = useAsync(() => apiClient.counts(eventSlug), [eventSlug]);
  const {
    data: bundle,
    error: bundleError,
    loading: bundleLoading,
  } = useAsync(() => apiClient.eventBundle(eventSlug), [eventSlug]);

  const loading = countsLoading || bundleLoading;
  const error = countsError ?? bundleError;
  const submitted = counts?.submissionsByStatus.submitted ?? 0;
  const underReview = counts?.submissionsByStatus.under_review ?? 0;
  const accepted = counts?.submissionsByStatus.accepted ?? 0;
  const waitlisted = counts?.submissionsByStatus.waitlisted ?? 0;
  const needsDecision = submitted + underReview + waitlisted;
  const decisioned = accepted + (counts?.submissionsByStatus.rejected ?? 0);
  const acceptanceRate = counts?.submissions
    ? Math.round((accepted / counts.submissions) * 100)
    : 0;
  const scheduledRate = accepted
    ? Math.min(100, Math.round(((counts?.sessions ?? 0) / accepted) * 100))
    : 0;
  const cfp = bundle?.cfp;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={eventName}
        actions={
          <Link
            to={`/e/${eventSlug}/cfp`}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Open CFP
          </Link>
        }
      />

      {loading ? (
        <Spinner label="Loading counts" />
      ) : error || !counts || !bundle ? (
        <ErrorBanner message={error?.message ?? "Could not load dashboard."} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Submissions"
              value={counts.submissions}
              detail={`${needsDecision} need decision`}
              to="/admin/reviews"
            />
            <MetricCard
              label="Accepted"
              value={accepted}
              detail={`${acceptanceRate}% acceptance rate`}
            />
            <MetricCard
              label="Sessions"
              value={counts.sessions}
              detail={`${scheduledRate}% of accepted converted`}
            />
            <MetricCard
              label="Speakers"
              value={counts.speakers}
              detail={`${bundle.tracks.length} tracks, ${bundle.rooms.length} rooms`}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
            <Card className="rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Review pipeline</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Current proposal mix and decision workload.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    to="/admin/reviews"
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    Make decisions →
                  </Link>
                  <Link
                    to="/admin/submissions"
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-800 hover:underline"
                  >
                    Open submissions
                  </Link>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {SubmissionStatus.options.map((status) => (
                  <PipelineRow
                    key={status}
                    label={STATUS_LABEL[status]}
                    count={counts.submissionsByStatus[status] ?? 0}
                    total={counts.submissions}
                    tone={STATUS_TONE[status]}
                  />
                ))}
              </div>
            </Card>

            <Card className="rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-900">Event settings</h2>
              <div className="mt-4 divide-y divide-zinc-100">
                <SettingRow
                  label="Dates"
                  value={formatDateRange(bundle.event.startsOn, bundle.event.endsOn)}
                />
                <SettingRow label="Timezone" value={bundle.event.timezone} />
                <SettingRow label="Venue" value={bundle.event.venue ?? "Not set"} />
                <SettingRow label="CFP" value={cfp?.form.isOpen ? "Open" : "Closed"} />
                <SettingRow label="Closes" value={formatDateTime(cfp?.form.closesAt ?? null)} />
                <SettingRow label="Form fields" value={String(cfp?.fields.length ?? 0)} />
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.3fr)]">
            <Card className="rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-900">Demo readiness</h2>
              <div className="mt-4 space-y-3">
                <ChecklistItem
                  label="CFP is collecting proposals"
                  done={Boolean(cfp?.form.isOpen)}
                  detail={cfp ? cfp.form.title : "No CFP form found"}
                />
                <ChecklistItem
                  label="Program taxonomy is configured"
                  done={bundle.tracks.length > 0 && bundle.rooms.length > 0}
                  detail={`${bundle.tracks.length} tracks, ${bundle.rooms.length} rooms`}
                />
                <ChecklistItem
                  label="Submissions are present"
                  done={counts.submissions > 0}
                  detail={`${counts.submissions} proposals in the intake queue`}
                />
                <ChecklistItem
                  label="Decisions have started"
                  done={decisioned > 0}
                  detail={`${decisioned} accepted or rejected`}
                />
                <ChecklistItem
                  label="Accepted content is sessionized"
                  done={accepted === 0 ? counts.sessions > 0 : counts.sessions >= accepted}
                  detail={`${counts.sessions} sessions from ${accepted} accepted proposals`}
                />
              </div>
            </Card>

            <Card className="rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-900">Organizer focus</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <FocusCard label="Needs triage" value={submitted} detail="New proposals" />
                <FocusCard label="In review" value={underReview} detail="Awaiting scores" />
                <FocusCard label="Waitlisted" value={waitlisted} detail="Hold for balance" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-zinc-600">
                The demo path is ready when a new CFP proposal appears in Submissions, gets moved
                through review, and accepted proposals show up as sessions without losing speaker
                lineage.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  to,
}: {
  label: string;
  value: number;
  detail: string;
  /** When set, the detail line becomes the action that takes you there. */
  to?: string;
}) {
  return (
    <Card className="rounded-lg p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-zinc-900">{value}</p>
      {to ? (
        <Link to={to} className="mt-2 block text-sm font-medium text-accent hover:underline">
          {detail} →
        </Link>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">{detail}</p>
      )}
    </Card>
  );
}

function PipelineRow({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: ComponentProps<typeof Badge>["tone"];
}) {
  const percent = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          <span className="text-zinc-500">{count}</span>
        </div>
        <span className="text-xs font-medium text-zinc-500">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="max-w-48 truncate text-right font-medium text-zinc-900" title={value}>
        {value}
      </span>
    </div>
  );
}

function ChecklistItem({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {done ? "OK" : "!"}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500" title={detail}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function FocusCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
