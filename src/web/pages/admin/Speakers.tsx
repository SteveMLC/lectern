import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { CreateOrganizerSpeakerRequest, OrganizerSpeakersResponse, UpdateOrganizerSpeakerRequest } from "../../../shared/contracts";
import { SpeakerAvatar } from "../../components/SpeakerAvatar";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Select, Spinner, Textarea } from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export type SpeakerTaskFilter = "all" | "needs_work" | "complete" | "no_tasks";
export type SpeakerWithTaskProgress = OrganizerSpeakersResponse["speakers"][number];

const EMPTY_SPEAKER: CreateOrganizerSpeakerRequest = {
  name: "", email: "", company: null, title: null, bio: null,
  workflowStatus: "invited", logisticsNotes: null,
};

export function filterSpeakerRoster(
  speakers: SpeakerWithTaskProgress[],
  query: string,
  taskFilter: SpeakerTaskFilter,
  workflowFilter = "all",
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
    const matchesWorkflow = workflowFilter === "all" || speaker.workflowStatus === workflowFilter;
    return matchesQuery && matchesTasks && matchesWorkflow;
  });
}

export function Speakers() {
  const { eventSlug } = useAdminContext();
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<SpeakerTaskFilter>("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrganizerSpeakerRequest>(EMPTY_SPEAKER);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateOrganizerSpeakerRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => apiClient.organizerSpeakers(eventSlug), [eventSlug]);
  const filtered = useMemo(
    () => filterSpeakerRoster(data?.speakers ?? [], query, taskFilter, workflowFilter),
    [data?.speakers, query, taskFilter, workflowFilter],
  );

  return (
    <div>
      <PageHeader
        title="Speakers"
        subtitle="Manage the roster, workflow status, profiles, logistics, tasks, and speaker portals."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Manual and imported speakers live beside CFP speakers in one event-scoped roster.</p>
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setImportOpen((value) => !value)}>{importOpen ? "Cancel import" : "Import CSV"}</Button><Button type="button" onClick={() => setAddOpen((value) => !value)}>{addOpen ? "Cancel" : "Add speaker"}</Button></div>
      </div>
      {notice ? <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div> : null}
      {actionError ? <div className="mb-4"><ErrorBanner message={actionError} /></div> : null}
      {importOpen ? (
        <Card className="mb-5 p-5">
          <h2 className="font-semibold text-zinc-900">Import speakers from CSV</h2>
          <p className="mt-1 text-sm text-zinc-500">Required columns: Name and Email. Optional: Bio, Company, Role. Existing event emails are updated instead of duplicated.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Choose CSV file" help="The file is validated before any rows are written.">
              <Input type="file" accept=".csv,text/csv" onChange={async (event) => {
                const file = event.target.files?.[0]; setCsvText(file ? await file.text() : "");
              }} />
            </Field>
            <Button type="button" disabled={!csvText || importing} onClick={async () => {
              setImporting(true); setActionError(null);
              try { const result = await apiClient.importOrganizerSpeakers(eventSlug, { csv: csvText }); setNotice(`${result.imported} speaker${result.imported === 1 ? "" : "s"} imported; ${result.updated} existing record${result.updated === 1 ? "" : "s"} updated.`); setCsvText(""); setImportOpen(false); reload(); }
              catch (caught) { setActionError(caught instanceof ApiRequestError ? caught.message : "CSV could not be imported."); }
              finally { setImporting(false); }
            }}>{importing ? "Importing…" : "Import speakers"}</Button>
          </div>
        </Card>
      ) : null}
      {addOpen ? (
        <Card className="mb-5 p-5">
          <h2 className="font-semibold text-zinc-900">Add a speaker manually</h2>
          <p className="mt-1 text-sm text-zinc-500">Useful for invited experts, moderators, and sponsor speakers who never submitted a proposal.</p>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={async (event) => {
            event.preventDefault(); setCreating(true); setActionError(null);
            try {
              await apiClient.createOrganizerSpeaker(eventSlug, createForm);
              setCreateForm(EMPTY_SPEAKER); setAddOpen(false); setNotice("Speaker added to the roster."); reload();
            } catch (caught) { setActionError(caught instanceof ApiRequestError ? caught.message : "Speaker could not be added."); }
            finally { setCreating(false); }
          }}>
            <Field label="Full name" required><Input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></Field>
            <Field label="Email" required><Input required type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></Field>
            <Field label="Title"><Input value={createForm.title ?? ""} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value || null })} /></Field>
            <Field label="Company"><Input value={createForm.company ?? ""} onChange={(event) => setCreateForm({ ...createForm, company: event.target.value || null })} /></Field>
            <div className="sm:col-span-2"><Field label="Bio"><Textarea value={createForm.bio ?? ""} onChange={(event) => setCreateForm({ ...createForm, bio: event.target.value || null })} /></Field></div>
            <Field label="Workflow status"><Select value={createForm.workflowStatus} onChange={(event) => setCreateForm({ ...createForm, workflowStatus: event.target.value as CreateOrganizerSpeakerRequest["workflowStatus"] })}><option value="prospect">Prospect</option><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option></Select></Field>
            <Field label="Logistics / accessibility"><Input value={createForm.logisticsNotes ?? ""} onChange={(event) => setCreateForm({ ...createForm, logisticsNotes: event.target.value || null })} placeholder="Travel, dietary, accessibility notes" /></Field>
            <div className="sm:col-span-2"><Button type="submit" disabled={creating}>{creating ? "Adding…" : "Add speaker to roster"}</Button></div>
          </form>
        </Card>
      ) : null}
      {loading ? (
        <Spinner label="Loading speakers" />
      ) : error ? (
        <ErrorBanner message={error.message} />
      ) : !data || data.speakers.length === 0 ? (
        <EmptyState title="No confirmed speakers" body="Speakers appear here when they join a confirmed session." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_200px_180px]">
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
              Workflow status
              <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900">
                <option value="all">All statuses</option><option value="prospect">Prospect</option><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option>
              </select>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={speaker.workflowStatus === "confirmed" ? "emerald" : speaker.workflowStatus === "declined" ? "rose" : "amber"}>{speaker.workflowStatus}</Badge>
                {speaker.logisticsNotes ? <Badge tone="indigo">Logistics noted</Badge> : null}
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
              <Button type="button" variant="secondary" className="mt-2 w-full" onClick={() => {
                setEditingId(speaker.id);
                setEditForm({ name: speaker.name, company: speaker.company, title: speaker.title, bio: speaker.bio, workflowStatus: speaker.workflowStatus, logisticsNotes: speaker.logisticsNotes });
              }}>Edit organizer record</Button>
              {editingId === speaker.id && editForm ? (
                <form className="mt-3 space-y-3 border-t border-zinc-200 pt-3" onSubmit={async (event) => {
                  event.preventDefault(); setSaving(true); setActionError(null);
                  try { await apiClient.updateOrganizerSpeaker(eventSlug, speaker.id, editForm); setEditingId(null); setEditForm(null); setNotice(`${editForm.name} updated.`); reload(); }
                  catch (caught) { setActionError(caught instanceof ApiRequestError ? caught.message : "Speaker could not be updated."); }
                  finally { setSaving(false); }
                }}>
                  <Field label="Full name" required><Input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
                  <Field label="Title"><Input value={editForm.title ?? ""} onChange={(event) => setEditForm({ ...editForm, title: event.target.value || null })} /></Field>
                  <Field label="Company"><Input value={editForm.company ?? ""} onChange={(event) => setEditForm({ ...editForm, company: event.target.value || null })} /></Field>
                  <Field label="Bio"><Textarea value={editForm.bio ?? ""} onChange={(event) => setEditForm({ ...editForm, bio: event.target.value || null })} /></Field>
                  <Field label="Workflow status"><Select value={editForm.workflowStatus} onChange={(event) => setEditForm({ ...editForm, workflowStatus: event.target.value as UpdateOrganizerSpeakerRequest["workflowStatus"] })}><option value="prospect">Prospect</option><option value="invited">Invited</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option></Select></Field>
                  <Field label="Logistics / accessibility"><Textarea value={editForm.logisticsNotes ?? ""} onChange={(event) => setEditForm({ ...editForm, logisticsNotes: event.target.value || null })} /></Field>
                  <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button><Button type="button" variant="ghost" onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</Button></div>
                </form>
              ) : null}
            </Card>
          ))}
        </div>}
        </>
      )}
    </div>
  );
}
