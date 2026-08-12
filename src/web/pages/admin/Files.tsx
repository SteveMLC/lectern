import { useMemo, useState } from "react";
import type { OrganizerSpeakersResponse } from "../../../shared/contracts";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export type DeliverableFilter = "all" | "has_files" | "missing_files" | "incomplete_tasks";
type OrganizerSpeaker = OrganizerSpeakersResponse["speakers"][number];

export function filterDeliverables(
  speakers: OrganizerSpeaker[],
  query: string,
  filter: DeliverableFilter,
): OrganizerSpeaker[] {
  const needle = query.trim().toLowerCase();
  return speakers.filter((speaker) => {
    const matchesQuery = !needle || [speaker.name, speaker.email, speaker.company]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
    const matchesFilter = filter === "all"
      || (filter === "has_files" && speaker.assets.length > 0)
      || (filter === "missing_files" && speaker.assets.length === 0)
      || (filter === "incomplete_tasks" && speaker.completedTasks < speaker.totalTasks);
    return matchesQuery && matchesFilter;
  });
}

export function Files() {
  const { eventSlug } = useAdminContext();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DeliverableFilter>("all");
  const { data, error, loading } = useAsync(() => apiClient.organizerSpeakers(eventSlug), [eventSlug]);
  const visible = useMemo(
    () => filterDeliverables(data?.speakers ?? [], query, filter),
    [data?.speakers, query, filter],
  );

  if (loading) return <Spinner label="Loading speaker files" />;
  if (error) return <ErrorBanner message={error.message} />;
  const speakers = data?.speakers ?? [];
  const totalFiles = speakers.reduce((sum, speaker) => sum + speaker.assets.length, 0);
  const speakersMissingFiles = speakers.filter((speaker) => speaker.assets.length === 0).length;

  return (
    <div>
      <PageHeader title="Speaker files" subtitle="Track deliverables, outstanding tasks, and every uploaded version in one place." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-2xl font-semibold">{totalFiles}</div><div className="text-xs text-zinc-500">uploaded files</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold">{speakersMissingFiles}</div><div className="text-xs text-zinc-500">speakers missing files</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold">{speakers.filter((speaker) => speaker.completedTasks < speaker.totalTasks).length}</div><div className="text-xs text-zinc-500">speakers with open tasks</div></Card>
      </div>
      <div className="mb-4 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          Search deliverables
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Speaker, email, or company" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          Status
          <select value={filter} onChange={(event) => setFilter(event.target.value as DeliverableFilter)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900">
            <option value="all">All speakers</option>
            <option value="has_files">Has uploaded files</option>
            <option value="missing_files">Missing files</option>
            <option value="incomplete_tasks">Has incomplete tasks</option>
          </select>
        </label>
      </div>
      <p className="mb-3 text-sm text-zinc-500" aria-live="polite">{visible.length} of {speakers.length} speakers</p>
      {speakers.length === 0 ? (
        <EmptyState title="No speakers yet" />
      ) : visible.length === 0 ? (
        <EmptyState title="No deliverables match" body="Clear the search or choose another status filter." />
      ) : (
        <div className="space-y-5">
          {visible.map((speaker) => {
            const latest = new Set(
              [...new Set(speaker.assets.map((asset) => asset.kind))]
                .map((kind) => speaker.assets.find((asset) => asset.kind === kind)!.id),
            );
            return (
              <Card key={speaker.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-semibold">{speaker.name}</h2><p className="mt-1 text-xs text-zinc-500">{speaker.email}</p></div>
                  <Badge tone={speaker.completedTasks === speaker.totalTasks ? "emerald" : "amber"}>{speaker.completedTasks} / {speaker.totalTasks} tasks complete</Badge>
                </div>
                {speaker.assets.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No files uploaded.</p>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {speaker.assets.map((asset) => (
                      <a key={asset.id} href={`/api/assets/${asset.id}`} className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50">
                        <div><span className="font-medium">{asset.filename}</span>{latest.has(asset.id) ? <Badge className="ml-2" tone="emerald">Latest</Badge> : null}</div>
                        <p className="mt-1 text-xs text-zinc-500">{asset.kind} · {formatDateTime(asset.uploadedAt, data!.event.timezone)}</p>
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
