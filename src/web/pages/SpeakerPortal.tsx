import { Link, useParams } from "react-router";
import { useState } from "react";
import type {
  AssetKind,
  ResourcePage,
  Speaker,
  SpeakerPortalResponse,
  SpeakerTask,
} from "../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "../components/ui";
import { ApiRequestError, apiClient } from "../lib/api";
import { formatDateRange, formatDateTime } from "../lib/status";
import { useAsync } from "../lib/useAsync";

const TASK_TONE: Record<SpeakerTask["status"], "amber" | "emerald" | "rose"> = {
  pending: "amber",
  complete: "emerald",
  blocked: "rose",
};

const TASK_LABEL: Record<SpeakerTask["status"], string> = {
  pending: "Pending",
  complete: "Complete",
  blocked: "Blocked",
};

const FORMAT_LABEL: Record<string, string> = {
  talk: "Talk",
  workshop: "Workshop",
  panel: "Panel",
  lightning: "Lightning",
  keynote: "Keynote",
};

export function SpeakerPortal() {
  const { token = "" } = useParams();
  const { data: loaded, error, loading } = useAsync(() => apiClient.speakerPortal(token), [token]);
  const [portalOverride, setPortalOverride] = useState<SpeakerPortalResponse | null>(null);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading speaker portal" />
      </div>
    );
  }

  if (error || !loaded) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <ErrorBanner message={error?.message ?? "Speaker portal not found."} />
        <p className="mt-4 text-sm text-zinc-500">Try one of the demo speaker portals.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="text-sm font-medium text-accent hover:underline" to="/speaker/spk_ada">
            Ada Okafor
          </Link>
          <Link className="text-sm font-medium text-accent hover:underline" to="/speaker/spk_priya">
            Priya Sharma
          </Link>
          <Link className="text-sm font-medium text-accent hover:underline" to="/">
            Back to SpeakerOps
          </Link>
        </div>
      </div>
    );
  }

  const data = portalOverride ?? loaded;

  async function toggleTask(task: SpeakerTask) {
    setTaskBusyId(task.id);
    setTaskError(null);
    try {
      const updated = await apiClient.updateSpeakerTask(token, task.id, {
        status: task.status === "complete" ? "pending" : "complete",
      });
      setPortalOverride(updated);
    } catch (caught) {
      setTaskError(caught instanceof ApiRequestError ? caught.message : "Task could not be updated.");
    } finally {
      setTaskBusyId(null);
    }
  }

  const completedTasks = data.tasks.filter((item) => item.task.status === "complete").length;
  const nextDue = data.tasks
    .filter((item) => item.task.status !== "complete")
    .map((item) => item.definition.dueAt)
    .filter((due): due is string => Boolean(due))
    .sort()[0];

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Link
            to={`/e/${data.event.slug}`}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            {data.event.name}
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {data.speaker.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {[data.speaker.title, data.speaker.company].filter(Boolean).join(", ") ||
                  data.speaker.email}
              </p>
            </div>
            <Badge tone="indigo">{formatDateRange(data.event.startsOn, data.event.endsOn)}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Tasks complete" value={`${completedTasks}/${data.tasks.length}`} />
            <Metric label="Sessions" value={String(data.sessions.length)} />
            <Metric
              label="Next due"
              value={nextDue ? formatDateTime(nextDue, data.event.timezone) : "None"}
            />
          </div>

          <ProfileEditor token={token} speaker={data.speaker} onUpdated={setPortalOverride} />

          <Card className="p-5">
            <h2 className="text-base font-semibold text-zinc-900">Sessions</h2>
            {data.sessions.length === 0 ? (
              <EmptyState
                title="No confirmed sessions yet"
                body="Accepted and invited sessions appear here when the organizer confirms them."
              />
            ) : (
              <div className="mt-4 divide-y divide-zinc-100">
                {data.sessions.map((session) => (
                  <article key={session.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="sky">{FORMAT_LABEL[session.format] ?? session.format}</Badge>
                      <span className="text-xs text-zinc-500">
                        {session.startsAt
                          ? formatDateTime(session.startsAt, data.event.timezone)
                          : "Time pending"}
                        {session.roomName ? ` · ${session.roomName}` : ""}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-zinc-900">{session.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                      {session.abstract}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Resources resources={data.resources} />
        </section>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-zinc-900">Speaker tasks</h2>
            <div className="mt-4 space-y-3">
              {taskError ? <ErrorBanner message={taskError} /> : null}
              {data.tasks.map(({ task, definition }) => (
                <div key={task.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{definition.label}</p>
                      {definition.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                          {definition.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={TASK_TONE[task.status]}>{TASK_LABEL[task.status]}</Badge>
                  </div>
                  {definition.dueAt ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Due {formatDateTime(definition.dueAt, data.event.timezone)}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant={task.status === "complete" ? "ghost" : "secondary"}
                    className="mt-3 w-full px-3 py-1.5 text-xs"
                    disabled={taskBusyId !== null}
                    onClick={() => void toggleTask(task)}
                  >
                    {taskBusyId === task.id
                      ? "Saving…"
                      : task.status === "complete"
                        ? "Mark pending"
                        : "Mark complete"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-zinc-900">Files on record</h2>
            {data.assets.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No files have been uploaded yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {data.assets.map((asset) => (
                  <a
                    key={asset.id}
                    href={`/api/assets/${asset.id}`}
                    className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <span className="font-medium text-zinc-900">{asset.filename}</span>
                    <span className="ml-2 text-xs text-zinc-500">{asset.kind}</span>
                  </a>
                ))}
              </div>
            )}
            <AssetUploader
              token={token}
              onUploaded={async () => setPortalOverride(await apiClient.speakerPortal(token))}
            />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function ProfileEditor({
  token,
  speaker,
  onUpdated,
}: {
  token: string;
  speaker: Speaker;
  onUpdated: (portal: SpeakerPortalResponse) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(speaker.name);
  const [title, setTitle] = useState(speaker.title ?? "");
  const [company, setCompany] = useState(speaker.company ?? "");
  const [location, setLocation] = useState(speaker.location ?? "");
  const [bio, setBio] = useState(speaker.bio ?? "");
  const [website, setWebsite] = useState(speaker.socials?.website ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiClient.updateSpeakerProfile(token, {
        name,
        title: title.trim() || null,
        company: company.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        socials: website.trim()
          ? { ...(speaker.socials ?? {}), website: website.trim() }
          : speaker.socials
            ? { ...speaker.socials, website: undefined }
            : null,
      });
      onUpdated(updated);
      setSaved(true);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Public speaker profile</h2>
          <p className="mt-1 text-sm text-zinc-500">Keep the bio shown on the event site accurate.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditing((value) => !value)}>
          {editing ? "Cancel" : "Edit profile"}
        </Button>
      </div>
      {saved ? <p role="status" className="mt-3 text-sm font-medium text-emerald-700">Profile saved.</p> : null}
      {editing ? (
        <form onSubmit={save} className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2">
          <Field label="Name" required><Input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
          <Field label="Role"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Company"><Input value={company} onChange={(event) => setCompany(event.target.value)} /></Field>
          <Field label="Location"><Input value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Website"><Input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Bio"><Textarea value={bio} onChange={(event) => setBio(event.target.value)} /></Field></div>
          {error ? <div className="sm:col-span-2"><ErrorBanner message={error} /></div> : null}
          <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button></div>
        </form>
      ) : null}
    </Card>
  );
}

function AssetUploader({ token, onUploaded }: { token: string; onUploaded: () => Promise<void> }) {
  const [kind, setKind] = useState<AssetKind>("headshot");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.uploadSpeakerAsset(token, file, kind);
      await onUploaded();
      setNotice(`${file.name} uploaded.`);
      setFile(null);
      setInputKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "File could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="mt-5 space-y-3 border-t border-zinc-100 pt-5">
      <Field label="Upload a file" help="Headshots, slides, and documents up to 10 MB.">
        <Input key={inputKey} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <Select aria-label="File kind" value={kind} onChange={(event) => setKind(event.target.value as AssetKind)}>
        <option value="headshot">Headshot</option>
        <option value="slides">Slides</option>
        <option value="document">Document</option>
      </Select>
      {notice ? <p role="status" className="text-xs font-medium text-emerald-700">{notice}</p> : null}
      {error ? <ErrorBanner message={error} /> : null}
      <Button type="submit" className="w-full" disabled={!file || uploading}>{uploading ? "Uploading…" : "Upload to event team"}</Button>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </Card>
  );
}

function Resources({ resources }: { resources: ResourcePage[] }) {
  if (resources.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold text-zinc-900">Resources</h2>
        <EmptyState title="No published resources yet" />
      </Card>
    );
  }

  const primary = resources[0]!;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">Resources</h2>
        <div className="flex flex-wrap gap-2">
          {resources.map((resource) => (
            <span
              key={resource.id}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600"
            >
              {resource.title}
            </span>
          ))}
        </div>
      </div>
      <article className="prose mt-4 max-w-none text-sm leading-relaxed text-zinc-700">
        <MarkdownBody body={primary.bodyMd} />
      </article>
      {primary.embedHtml ? (
        <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500">
          Additional venue materials will appear here when they are ready.
        </p>
      ) : null}
    </Card>
  );
}

function MarkdownBody({ body }: { body: string }) {
  return (
    <>
      {body.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("# ")) {
          return (
            <h3 key={index} className="mb-3 text-base font-semibold text-zinc-900">
              {cleanMarkdown(trimmed.slice(2))}
            </h3>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <p key={index} className="pl-4 text-sm text-zinc-700">
              <span className="-ml-4 mr-2 text-zinc-400">-</span>
              {cleanMarkdown(trimmed.slice(2))}
            </p>
          );
        }
        return (
          <p key={index} className="mb-2 text-sm text-zinc-700">
            {cleanMarkdown(trimmed)}
          </p>
        );
      })}
    </>
  );
}

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*/g, "");
}
