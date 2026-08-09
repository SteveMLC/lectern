import { Link, useParams } from "react-router";
import { Card, EmptyState, ErrorBanner, Spinner } from "../components/ui";
import { isCfpOpen } from "../../shared/domain/cfp";
import { apiClient } from "../lib/api";
import { formatDateRange, formatDateOnly } from "../lib/status";
import { useAsync } from "../lib/useAsync";

export function EventPage() {
  const { slug = "" } = useParams();
  const { data, error, loading } = useAsync(() => apiClient.eventBundle(slug), [slug]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading event" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <ErrorBanner message={error?.message ?? "Event not found."} />
      </div>
    );
  }

  const { event, tracks, rooms, cfp } = data;
  const cfpOpen = cfp !== null && isCfpOpen(cfp.form, new Date().toISOString());

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <Link to="/" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← SpeakerOps
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
            {event.name}
          </h1>
          {event.tagline ? <p className="mt-2 text-lg text-zinc-600">{event.tagline}</p> : null}
          <p className="mt-3 text-sm text-zinc-500">
            {formatDateRange(event.startsOn, event.endsOn)}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        {event.description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-700">{event.description}</p>
        ) : null}

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Call for speakers</h2>
              {cfp === null ? (
                <p className="mt-1 text-sm text-zinc-500">
                  This event is not accepting proposals.
                </p>
              ) : cfpOpen ? (
                <p className="mt-1 text-sm text-zinc-600">
                  Open now
                  {cfp.form.closesAt
                    ? ` — closes ${formatDateOnly(cfp.form.closesAt.slice(0, 10))}`
                    : ""}
                  . First-time speakers welcome.
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">The call for speakers is closed.</p>
              )}
            </div>
            {cfpOpen ? (
              <Link
                to={`/e/${event.slug}/cfp`}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Submit a proposal
              </Link>
            ) : null}
          </div>
        </Card>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tracks
          </h2>
          {tracks.length === 0 ? (
            <EmptyState title="No tracks yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {tracks.map((t) => (
                <Card key={t.id} className="flex items-start gap-3 p-4">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color ?? "#a1a1aa" }}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                    {t.description ? (
                      <p className="mt-0.5 text-sm text-zinc-500">{t.description}</p>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Venue rooms
          </h2>
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <span
                key={r.id}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600"
              >
                {r.name}
                {r.capacity ? ` · ${r.capacity} seats` : ""}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
