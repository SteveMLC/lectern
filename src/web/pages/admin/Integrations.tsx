import { Badge, Button, Card, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";

export function Integrations() {
  const { data, error, loading, reload } = useAsync(() => apiClient.airtableStatus(), []);

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="A narrow Airtable proof with explicit limits; D1 stays the reliable full-product backend."
        actions={<Button variant="secondary" onClick={reload}>Check connection</Button>}
      />

      {loading ? (
        <Spinner label="Checking Airtable" />
      ) : error || !data ? (
        <ErrorBanner message={error?.message ?? "Integration status unavailable."} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Airtable operational proof</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">Reads Events and Speakers; writes simulated deliveries to Messages.</p>
              </div>
              <Badge tone={data.connected ? "emerald" : data.configured ? "rose" : "amber"}>
                {data.connected ? "Connected" : data.configured ? "Connection failed" : "Credentials needed"}
              </Badge>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Fact label="Active backend" value={data.active ? "Airtable proof" : "D1 fallback"} />
              <Fact label="Read cache" value={`${data.cacheTtlSeconds} seconds`} />
              <Fact label="Request spacing" value={`${data.minimumRequestSpacingMs} ms`} />
              <Fact label="429 handling" value="Retry-After × 2" />
            </dl>

            <a
              href="https://github.com/SteveMLC/speakerops/blob/main/docs/AIRTABLE.md"
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
              The adapter is intentionally scoped to one provable read/write workflow. Unwired methods fail loudly, and switching back to D1 restores every product path without migration or data dependency.
            </p>
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Current fallback: {data.fallback.toUpperCase()}</p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">The judging demo remains usable even if Airtable throttles, credentials expire, or the base is unavailable.</p>
            </div>
            <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
              <p><span className="font-medium text-zinc-900">Reads:</span> {data.readTables.join(", ")}</p>
              <p className="mt-1"><span className="font-medium text-zinc-900">Writes:</span> {data.writeTable}</p>
            </div>
          </Card>
        </div>
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
