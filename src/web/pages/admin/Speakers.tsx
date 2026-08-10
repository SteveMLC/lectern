import { Link } from "react-router";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export function Speakers() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading } = useAsync(() => apiClient.publicSpeakers(eventSlug), [eventSlug]);

  return (
    <div>
      <PageHeader
        title="Speakers"
        subtitle="Open the same portal each speaker uses to manage their profile, tasks, and files."
      />
      {loading ? (
        <Spinner label="Loading speakers" />
      ) : error ? (
        <ErrorBanner message={error.message} />
      ) : !data || data.speakers.length === 0 ? (
        <EmptyState title="No confirmed speakers" body="Speakers appear here when they join a confirmed session." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.speakers.map((speaker) => (
            <Card key={speaker.id} className="flex min-h-52 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-900">{speaker.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {[speaker.title, speaker.company].filter(Boolean).join(", ") || "Speaker"}
                  </p>
                </div>
                <Badge tone="indigo">Portal ready</Badge>
              </div>
              {speaker.bio ? (
                <p className="mt-4 flex-1 text-sm leading-6 text-zinc-600 line-clamp-3">{speaker.bio}</p>
              ) : (
                <p className="mt-4 flex-1 text-sm italic text-zinc-400">Bio still needed.</p>
              )}
              <Link
                to={`/speaker/${speaker.id}`}
                className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Open speaker portal
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
