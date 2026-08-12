import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { OrganizerSpeakersResponse } from "../../../shared/contracts";
import { SpeakerAvatar } from "../../components/SpeakerAvatar";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export type SpeakerTaskFilter = "all" | "needs_work" | "complete" | "no_tasks";
export type SpeakerWithTaskProgress = OrganizerSpeakersResponse["speakers"][number];

export function filterSpeakerRoster(
  speakers: SpeakerWithTaskProgress[],
  query: string,
  taskFilter: SpeakerTaskFilter,
): SpeakerWithTaskProgress[] {
  const needle = query.trim().toLowerCase();
  return speakers.filter((speaker) => {
    const matchesQuery = !needle || [speaker.name, speaker.title, speaker.company]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
    const matchesTasks = taskFilter === "all"
      || (taskFilter === "needs_work" && speaker.completedTasks < speaker.totalTasks)
      || (taskFilter === "complete" && speaker.totalTasks > 0 && speaker.completedTasks === speaker.totalTasks)
      || (taskFilter === "no_tasks" && speaker.totalTasks === 0);
    return matchesQuery && matchesTasks;
  });
}

export function Speakers() {
  const { eventSlug } = useAdminContext();
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<SpeakerTaskFilter>("all");
  const { data, error, loading } = useAsync(() => apiClient.organizerSpeakers(eventSlug), [eventSlug]);
  const filtered = useMemo(
    () => filterSpeakerRoster(data?.speakers ?? [], query, taskFilter),
    [data?.speakers, query, taskFilter],
  );

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
        <>
          <div className="mb-4 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Search speakers
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, title, or company"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Task progress
              <select
                value={taskFilter}
                onChange={(event) => setTaskFilter(event.target.value as SpeakerTaskFilter)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                <option value="all">All speakers</option>
                <option value="needs_work">Has incomplete tasks</option>
                <option value="complete">All tasks complete</option>
                <option value="no_tasks">No assigned tasks</option>
              </select>
            </label>
          </div>
          <p className="mb-3 text-sm text-zinc-500" aria-live="polite">
            {filtered.length} of {data.speakers.length} speakers
          </p>
          {filtered.length === 0 ? (
            <EmptyState title="No speakers match" body="Clear the search or choose another task-progress filter." />
          ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((speaker) => (
            <Card key={speaker.id} className="flex min-h-52 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <SpeakerAvatar name={speaker.name} headshotUrl={speaker.headshotUrl} />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-zinc-900">{speaker.name}</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {[speaker.title, speaker.company].filter(Boolean).join(", ") || "Speaker"}
                    </p>
                  </div>
                </div>
                <Badge tone={speaker.headshotUrl ? "indigo" : "amber"}>
                  {speaker.headshotUrl ? "Headshot in" : "No headshot"}
                </Badge>
              </div>
              {speaker.bio ? (
                <p className="mt-4 flex-1 text-sm leading-6 text-zinc-600 line-clamp-3">{speaker.bio}</p>
              ) : (
                <p className="mt-4 flex-1 text-sm italic text-zinc-400">Bio still needed.</p>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Speaker tasks</span>
                  <span>{speaker.completedTasks} / {speaker.totalTasks} complete</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${speaker.totalTasks ? (speaker.completedTasks / speaker.totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <Link
                to={`/speaker/${speaker.id}`}
                className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Open speaker portal
              </Link>
            </Card>
          ))}
        </div>}
        </>
      )}
    </div>
  );
}
