import { Link } from "react-router";
import { Card, ErrorBanner, Spinner } from "../components/ui";
import { apiClient } from "../lib/api";
import { useAsync } from "../lib/useAsync";

const PUBLIC_ENDPOINTS = [
  ["GET", "/api/health", "Service, version, backend, D1/R2 checks"],
  ["GET", "/api/events", "Public event list"],
  ["GET", "/api/events/:slug", "Event bundle for public event and CFP pages"],
  ["GET", "/api/public/events/:slug/schedule", "Schedule JSON for embeds and custom sites"],
  ["GET", "/api/public/events/:slug/sessions", "Confirmed sessions JSON"],
  ["GET", "/api/public/events/:slug/speakers", "Public speaker gallery JSON"],
  ["GET", "/api/embeds/events/:slug/schedule", "Iframe schedule HTML"],
  ["GET", "/api/embeds/events/:slug/sessions", "Iframe sessions HTML"],
  ["GET", "/api/embeds/events/:slug/speakers", "Iframe speaker gallery HTML"],
  ["POST", "/api/events/:slug/drafts", "Save an anonymous CFP draft and receive a private resume URL"],
  ["POST", "/api/events/:slug/submissions", "CFP proposal intake"],
] as const;

const ORGANIZER_ENDPOINTS = [
  ["GET", "/api/events/:slug/submissions", "Bearer passcode", "Organizer submissions list"],
  ["GET", "/api/events/:slug/counts", "Bearer passcode", "Dashboard counts"],
  ["POST", "/api/events/:slug/speaker-tasks", "Bearer passcode", "Create and assign a speaker deliverable"],
  ["POST", "/api/events/:slug/communications/bulk", "Bearer passcode", "Record a bulk speaker communication"],
  ["POST", "/api/events/:slug/agenda/publish", "Bearer passcode", "Publish the reviewed agenda"],
  ["GET", "/api/events/:slug/sessions/:sessionId/versions", "Bearer passcode", "Session content history"],
  ["PATCH", "/api/events/:slug/sessions/:sessionId/content-approval", "Bearer passcode", "Approve or return session content"],
  ["POST", "/api/events/:slug/assets/download.zip", "Bearer passcode", "Download selected current speaker files as ZIP"],
  ["POST", "/api/events/:slug/assets/:assetId/comments", "Bearer passcode", "Comment on a speaker file"],
  ["POST", "/api/speakers/:speakerId/assets", "Bearer passcode", "Multipart upload to R2"],
  ["GET", "/api/admin/ping", "Bearer passcode", "Passcode verification"],
] as const;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
      <code>{children}</code>
    </pre>
  );
}

export function ApiDocs() {
  const { data, error, loading } = useAsync(() => apiClient.events(), []);
  const demoSlug = data?.events[0]?.slug ?? "horizon-2026";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const baseUrl = origin || "https://your-worker.example";

  const scheduleEmbed = `<iframe src="${baseUrl}/api/embeds/events/${demoSlug}/schedule" title="Schedule" width="100%" height="640" loading="lazy"></iframe>`;
  const sessionsEmbed = `<iframe src="${baseUrl}/api/embeds/events/${demoSlug}/sessions" title="Sessions" width="100%" height="640" loading="lazy"></iframe>`;
  const speakersEmbed = `<iframe src="${baseUrl}/api/embeds/events/${demoSlug}/speakers" title="Speakers" width="100%" height="640" loading="lazy"></iframe>`;

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <Link to="/" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            Lectern
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Public API
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
                API docs and embed snippets
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
                The same Worker serves the React app, JSON API, iframe HTML, D1 data, and R2 asset
                streams.
              </p>
            </div>
            <Link
              to="/embed-preview"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
            >
              Preview embeds
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        {loading ? <Spinner label="Loading demo event" /> : null}
        {error ? <ErrorBanner message={error.message} /> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Runtime</p>
            <p className="mt-2 text-sm text-zinc-700">Cloudflare Worker with Hono routes.</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Data</p>
            <p className="mt-2 text-sm text-zinc-700">
              D1 for demo reliability, Airtable behind the repo boundary.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Files</p>
            <p className="mt-2 text-sm text-zinc-700">
              R2-backed speaker assets, stored as first-class records.
            </p>
          </Card>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900">Public endpoints</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {PUBLIC_ENDPOINTS.map(([method, path, purpose]) => (
                  <tr key={path}>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-900">{path}</td>
                    <td className="px-4 py-3 text-zinc-600">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900">Organizer endpoints</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Auth</th>
                  <th className="px-4 py-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {ORGANIZER_ENDPOINTS.map(([method, path, auth, purpose]) => (
                  <tr key={path}>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-900">{path}</td>
                    <td className="px-4 py-3 text-zinc-600">{auth}</td>
                    <td className="px-4 py-3 text-zinc-600">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">Embed snippets</h2>
          <CodeBlock>{scheduleEmbed}</CodeBlock>
          <CodeBlock>{sessionsEmbed}</CodeBlock>
          <CodeBlock>{speakersEmbed}</CodeBlock>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">JSON example</h2>
          <CodeBlock>{`curl ${baseUrl}/api/public/events/${demoSlug}/schedule`}</CodeBlock>
        </section>
      </main>
    </div>
  );
}
