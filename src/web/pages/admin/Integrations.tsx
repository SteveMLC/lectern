import { Badge, Button, Card, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export function Integrations() {
  const { eventSlug } = useAdminContext();
  const airtable = useAsync(() => apiClient.airtableStatus(), []);
  const connectionState = useAsync(() => apiClient.integrationConnections(eventSlug), [eventSlug]);
  const data = airtable.data;
  const accelevents = connectionState.data?.connections.find((connection) => connection.system === "accelevents");
  const mirroredRecords = data ? Object.values(data.mirrored).reduce((sum, count) => sum + count, 0) : 0;
  const mirrorTables = data ? data.tables.filter((table) => data.baseTables.includes(table)).length : 0;
  const loading = airtable.loading || connectionState.loading;
  const error = airtable.error ?? connectionState.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="External program handoffs are event-scoped; D1 remains the reliable product backend."
        actions={<Button variant="secondary" onClick={() => { airtable.reload(); connectionState.reload(); }}>Check connections</Button>}
      />

      {loading ? (
        <Spinner label="Checking integrations" />
      ) : error || !data ? (
        <ErrorBanner message={error?.message ?? "Integration status unavailable."} />
      ) : (
        <>
        <Card className="border-indigo-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Non-negotiable path</p>
              <h2 className="mt-1 text-base font-semibold text-zinc-900">Accelevents one-way handoff</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">The connection record, direction, and credential gate live here so organizers do not have to hunt for the required integration.</p>
            </div>
            <Badge tone={accelevents?.status === "configured" ? "emerald" : accelevents?.status === "error" ? "rose" : "amber"}>
              {accelevents?.status === "configured" ? "Configured" : accelevents?.status === "error" ? "Needs attention" : "Credentials required"}
            </Badge>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <Fact label="Direction" value={String(accelevents?.config.direction ?? "push")} />
            <Fact label="State" value={(accelevents?.status ?? "not_configured").replaceAll("_", " ")} />
            <Fact label="Secrets" value="Worker-only" />
          </dl>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            {typeof accelevents?.config.note === "string" ? accelevents.config.note : "Add the Accelevents event URL and API key before the first push."} The UI does not expose or store API credentials.
          </div>
          <a href="https://developer.accelevents.com/docs/getting-started" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-medium text-accent hover:underline">Open official API-key setup →</a>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Airtable operational mirror</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">Mirrors the event, program, agenda, speakers, and outstanding tasks.</p>
              </div>
              <Badge tone={data.reachable && data.recordReadAvailable ? "emerald" : data.configured ? "amber" : "rose"}>
                {data.reachable && data.recordReadAvailable
                  ? "Connected"
                  : data.reachable
                    ? "Read scope needed"
                    : data.configured
                      ? "Connection failed"
                      : "Credentials needed"}
              </Badge>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Fact label="Mirror tables" value={`${mirrorTables}/${data.tables.length} ready`} />
              <Fact label="Mirrored records" value={String(mirroredRecords)} />
              <Fact label="Last sync" value={data.lastRun?.status ?? "Not run"} />
              <Fact label="Reset safety" value={data.recordReadAvailable ? "Reconciliation ready" : "Read scope missing"} />
              <Fact label="Rate safety" value="210 ms + Retry-After" />
            </dl>

            {data.error ? <p className="mt-4 text-sm text-rose-700">{data.error}</p> : null}
            {data.recordReadError ? <p className="mt-4 text-sm text-amber-700">Add Airtable data.records:read so resets can reconcile safely.</p> : null}

            <a
              href="https://github.com/SteveMLC/lectern/blob/main/docs/AIRTABLE.md"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Open base schema and setup
            </a>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-zinc-900">Demo safety</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              D1 remains authoritative. Airtable receives idempotent operational mirrors, so throttling or expired credentials never take down the judging path.
            </p>
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Current product backend: D1</p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">The judging demo remains usable even if Airtable throttles, credentials expire, or the base is unavailable.</p>
            </div>
            <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
              <p><span className="font-medium text-zinc-900">Base tables:</span> {data.baseTables.join(", ") || "None yet"}</p>
              <p className="mt-1"><span className="font-medium text-zinc-900">Last run:</span> {data.lastRun ? `${data.lastRun.status} · ${data.lastRun.id}` : "No sync recorded"}</p>
            </div>
          </Card>
        </div>
        </>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
