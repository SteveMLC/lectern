import { useMemo, useState } from "react";
import type { OrganizerSpeakersResponse } from "../../../shared/contracts";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Spinner, Textarea } from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";
import { AssetComments } from "../../components/AssetComments";

export type DeliverableFilter = "all" | "has_files" | "missing_files" | "incomplete_tasks";
type OrganizerSpeaker = OrganizerSpeakersResponse["speakers"][number];

export function latestAssetIdsForSpeakers(speakers: OrganizerSpeaker[], selectedIds: Set<string>): string[] {
  const latest = new Map<string, OrganizerSpeaker["assets"][number]>();
  for (const speaker of speakers) {
    if (!selectedIds.has(speaker.id)) continue;
    for (const asset of speaker.assets) {
      const context = asset.taskId ? `task:${asset.taskId}` : asset.sessionId ? `session:${asset.sessionId}` : "speaker";
      const key = `${speaker.id}:${asset.kind}:${context}`;
      const current = latest.get(key);
      if (!current || asset.versionNumber > current.versionNumber || (asset.versionNumber === current.versionNumber && asset.uploadedAt > current.uploadedAt)) latest.set(key, asset);
    }
  }
  return [...latest.values()].map((asset) => asset.id);
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInstructions, setTaskInstructions] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => apiClient.organizerSpeakers(eventSlug), [eventSlug]);
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
      {notice ? <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div> : null}
      {actionError ? <div className="mb-4"><ErrorBanner message={actionError} /></div> : null}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Content requests</h2><p className="mt-1 text-sm text-zinc-500">Select speakers below, then create one due-dated request or send reminders for their open tasks.</p></div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={selectedIds.size === 0 || busy} onClick={async () => {
            setBusy(true); setActionError(null);
            try { const result = await apiClient.remindSpeakerTasks(eventSlug, { speakerIds: [...selectedIds] }); setNotice(`${result.queued} reminder${result.queued === 1 ? "" : "s"} logged to the outbox for ${result.recipientEmails.join(", ") || "no speakers with open tasks"}.`); }
            catch (caught) { setActionError(caught instanceof ApiRequestError ? caught.message : "Reminders could not be sent."); }
            finally { setBusy(false); }
          }}>Send task reminders</Button><Button type="button" variant="secondary" disabled={selectedIds.size === 0 || zipBusy} onClick={async () => {
            const assetIds = latestAssetIdsForSpeakers(speakers, selectedIds);
            if (assetIds.length === 0) { setActionError("The selected speakers do not have files to download."); return; }
            setZipBusy(true); setActionError(null); setNotice(null);
            try {
              const blob = await apiClient.downloadAssetZip(eventSlug, { assetIds });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url; link.download = `${eventSlug}-speaker-files.zip`; document.body.appendChild(link); link.click(); link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1_000);
              setNotice(`ZIP ready with ${assetIds.length} latest file${assetIds.length === 1 ? "" : "s"} from ${selectedIds.size} selected speaker${selectedIds.size === 1 ? "" : "s"}.`);
            } catch (caught) { setActionError(caught instanceof ApiRequestError ? caught.message : "The ZIP could not be generated."); }
            finally { setZipBusy(false); }
          }}>{zipBusy ? "Generating ZIP…" : "Download latest ZIP"}</Button><Button type="button" disabled={selectedIds.size === 0} onClick={() => setTaskOpen((value) => !value)}>{taskOpen ? "Cancel request" : "Create file request"}</Button></div>
        </div>
        {taskOpen ? <form className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2" onSubmit={async (event) => {
          event.preventDefault(); setBusy(true); setActionError(null);
          try { const result = await apiClient.createSpeakerTask(eventSlug, { title: taskTitle, instructions: taskInstructions || null, dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null, speakerIds: [...selectedIds] }); setNotice(`“${result.definition.label}” assigned to ${result.assigned} speaker${result.assigned === 1 ? "" : "s"}.`); setTaskTitle(""); setTaskInstructions(""); setTaskDueAt(""); setTaskOpen(false); reload(); }
          catch (caught) { setActionError(caught instanceof ApiRequestError ? caught.message : "Task could not be created."); }
          finally { setBusy(false); }
        }}><Field label="Request title" required><Input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Upload final slide deck" /></Field><Field label="Due date and time"><Input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Instructions"><Textarea value={taskInstructions} onChange={(event) => setTaskInstructions(event.target.value)} placeholder="PDF or PPTX; include alt text for key diagrams." /></Field></div><div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Creating…" : `Assign to ${selectedIds.size} selected`}</Button></div></form> : null}
      </Card>
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
                  <div className="flex items-start gap-3"><input type="checkbox" aria-label={`Select ${speaker.name}`} checked={selectedIds.has(speaker.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(speaker.id); else next.delete(speaker.id); return next; })} /><div><h2 className="font-semibold">{speaker.name}</h2><p className="mt-1 text-xs text-zinc-500">{speaker.email}</p></div></div>
                  <Badge tone={speaker.completedTasks === speaker.totalTasks ? "emerald" : "amber"}>{speaker.completedTasks} / {speaker.totalTasks} tasks complete</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {speaker.tasks.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No assigned content tasks.</p> : speaker.tasks.map(({ task, definition }) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 p-3 text-sm"><div><p className="font-medium">{definition.label}</p><p className="mt-1 text-xs text-zinc-500">{definition.description || "No additional instructions"}{definition.dueAt ? ` · due ${formatDateTime(definition.dueAt, data!.event.timezone)}` : " · no due date"}</p></div><Badge tone={task.status === "complete" ? "emerald" : task.status === "blocked" ? "rose" : "amber"}>{task.status}</Badge></div>)}
                </div>
                {speaker.assets.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No files uploaded.</p>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {speaker.assets.map((asset) => (
                      <div key={asset.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                        <a href={`/api/assets/${asset.id}`} className="block hover:text-accent"><div><span className="font-medium">{asset.filename}</span>{latest.has(asset.id) ? <Badge className="ml-2" tone="emerald">Latest</Badge> : null}</div><p className="mt-1 text-xs text-zinc-500">{asset.kind} · version {asset.versionNumber} · {asset.taskId ? "task-linked" : asset.sessionId ? "session-linked" : "speaker file"} · {formatDateTime(asset.uploadedAt, data!.event.timezone)}</p></a>
                        <AssetComments filename={asset.filename} comments={speaker.assetComments.filter((comment) => comment.assetId === asset.id)} timezone={data!.event.timezone} onSubmit={async (body) => { await apiClient.addOrganizerAssetComment(eventSlug, asset.id, { body }); setNotice(`Comment posted on ${asset.filename}.`); reload(); }} />
                      </div>
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
