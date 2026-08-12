import { Link } from "react-router";
import { Card, ErrorBanner, Spinner } from "../components/ui";
import { apiClient } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { Itinerary } from "../components/Itinerary";

const PREVIEWS = [
  { key: "schedule", title: "Schedule", height: 560 },
  { key: "sessions", title: "Sessions", height: 520 },
  { key: "speakers", title: "Speakers", height: 520 },
] as const;

export function EmbedPreview() {
  const { data: events } = useAsync(() => apiClient.events(), []);
  const slug = events?.events[0]?.slug ?? "horizon-2026";
  const schedule = useAsync(() => apiClient.publicSchedule(slug), [slug]);
  const sessions = useAsync(() => apiClient.publicSessions(slug), [slug]);
  const speakers = useAsync(() => apiClient.publicSpeakers(slug), [slug]);
  const firstError = schedule.error ?? sessions.error ?? speakers.error;
  const loading = schedule.loading || sessions.loading || speakers.loading;

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link to="/docs" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            API docs
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Embed preview
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
                Public iframes for {schedule.data?.event.name ?? slug}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                {schedule.data?.slots.length ?? 0} scheduled slots ·{" "}
                {sessions.data?.sessions.length ?? 0} sessions ·{" "}
                {speakers.data?.speakers.length ?? 0} speakers
              </p>
            </div>
            <Link
              to={`/e/${slug}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Demo event
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {loading ? <Spinner label="Loading public data" /> : null}
        {firstError ? <ErrorBanner message={firstError.message} /> : null}

        {schedule.data ? <Itinerary schedule={schedule.data} /> : null}

        {PREVIEWS.map((preview) => (
          <Card key={preview.key} className="overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">{preview.title}</h2>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                /api/embeds/events/{slug}/{preview.key}
              </p>
            </div>
            <iframe
              title={`${preview.title} embed preview`}
              src={`/api/embeds/events/${encodeURIComponent(slug)}/${preview.key}`}
              className="block w-full bg-white"
              style={{ height: preview.height }}
              loading="lazy"
            />
          </Card>
        ))}
      </main>
    </div>
  );
}
