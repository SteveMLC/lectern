import { Link, useParams } from "react-router";
import { useState } from "react";
import type {
  AssetKind,
  FormField,
  ResourcePage,
  Speaker,
  SpeakerPortalResponse,
  SpeakerPortalProposal,
  SpeakerTask,
} from "../../shared/contracts";
import { canEditSpeakerProposal, speakerProposalLockReason } from "../../shared/domain/cfp";
import { isFieldVisible } from "../../shared/domain/rules";
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
import { sanitizeEmbedHtml } from "../lib/sanitizeEmbedHtml";
import { formatDateRange, formatDateTime, pipelineStage } from "../lib/status";
import { useAsync } from "../lib/useAsync";
import { AssetComments } from "../components/AssetComments";

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
            Back to Lectern
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
  const latestAssetIds = new Set(
    [...new Set(data.assets.map((asset) => asset.kind))]
      .map((kind) => data.assets.find((asset) => asset.kind === kind)?.id)
      .filter((id): id is string => Boolean(id)),
  );

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
            <h2 className="text-base font-semibold text-zinc-900">Your proposals</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Track each submission and update it while the call for speakers is open.
            </p>
            {data.proposals.length === 0 ? (
              <EmptyState title="No proposals yet" body="Submissions made with this speaker email appear here." />
            ) : (
              <div className="mt-4 space-y-4">
                {data.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    token={token}
                    proposal={proposal}
                    cfp={data.cfp}
                    onUpdated={setPortalOverride}
                  />
                ))}
              </div>
            )}
          </Card>

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
              {data.tasks.map(({ task, definition, form, formResponse }) => (
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
                  {form ? (
                    <TaskForm
                      token={token}
                      taskId={task.id}
                      taskLabel={definition.label}
                      fields={form.fields}
                      savedAnswers={formResponse}
                      onSubmitted={setPortalOverride}
                    />
                  ) : (
                    <Button
                      type="button"
                      aria-label={`${task.status === "complete" ? "Mark pending" : "Mark complete"}: ${definition.label}`}
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
                  )}
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
                  <div key={asset.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                    <a href={`/api/assets/${asset.id}`} aria-label={`Download ${asset.filename} (${asset.kind})`} className="block hover:text-accent">
                      <span className="font-medium text-zinc-900">{asset.filename}</span>
                      <span className="ml-2 text-xs text-zinc-500">{asset.kind}</span>
                      {latestAssetIds.has(asset.id) ? <Badge className="ml-2" tone="emerald">Latest</Badge> : null}
                      <span className="mt-1 block text-xs text-zinc-400">Uploaded {formatDateTime(asset.uploadedAt, data.event.timezone)}</span>
                    </a>
                    <AssetComments filename={asset.filename} comments={data.assetComments.filter((comment) => comment.assetId === asset.id)} timezone={data.event.timezone} onSubmit={async (body) => setPortalOverride(await apiClient.addSpeakerAssetComment(token, asset.id, { body }))} />
                  </div>
                ))}
              </div>
            )}
            <AssetUploader
              token={token}
              tasks={data.tasks}
              sessions={data.sessions}
              onUploaded={async () => setPortalOverride(await apiClient.speakerPortal(token))}
            />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function ProposalCard({
  token,
  proposal,
  cfp,
  onUpdated,
}: {
  token: string;
  proposal: SpeakerPortalProposal;
  cfp: SpeakerPortalResponse["cfp"];
  onUpdated: (portal: SpeakerPortalResponse) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(proposal.title);
  const [abstract, setAbstract] = useState(proposal.abstract);
  const [answers, setAnswers] = useState<Record<string, unknown>>(proposal.answers);
  const [coSpeakers, setCoSpeakers] = useState(
    proposal.coSpeakers.map((speaker) => ({
      name: speaker.name,
      email: speaker.email,
      company: speaker.company ?? "",
      role: speaker.roleLabel ?? "",
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const stage = pipelineStage({ status: proposal.status, reviews: [] });
  const editable = cfp
    ? canEditSpeakerProposal(cfp.form, proposal.status, new Date().toISOString())
    : false;
  const lockReason = cfp
    ? speakerProposalLockReason(cfp.form, proposal.status, new Date().toISOString())
    : "Editing is locked because this call for speakers is unavailable.";
  const visibleFields = cfp
    ? cfp.fields.filter((field) =>
        isFieldVisible(field, cfp.rules, { format: proposal.format, answers }),
      )
    : [];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiClient.updateSpeakerProposal(token, proposal.id, {
        title,
        abstract,
        answers,
        coSpeakers: coSpeakers.map((speaker) => ({
          name: speaker.name.trim(),
          email: speaker.email.trim(),
          company: speaker.company.trim() || undefined,
          title: speaker.role.trim() || undefined,
        })),
      });
      onUpdated(updated);
      setSaved(true);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Proposal could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={stage.tone}>{stage.label}</Badge>
            <span className="text-xs text-zinc-500">
              {[proposal.trackName, FORMAT_LABEL[proposal.format] ?? proposal.format]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-zinc-900">{proposal.title}</h3>
          {proposal.coSpeakers.length > 0 ? (
            <p className="mt-1 text-xs text-zinc-500">
              With {proposal.coSpeakers
                .map((speaker) => [speaker.name, speaker.company, speaker.roleLabel].filter(Boolean).join(" · "))
                .join("; ")}
            </p>
          ) : null}
        </div>
        {editable ? (
          <Button type="button" variant="secondary" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel" : "Edit proposal"}
          </Button>
        ) : null}
      </div>
      {!editing ? <p className="mt-2 text-sm leading-relaxed text-zinc-600">{proposal.abstract}</p> : null}
      {!editable ? <p className="mt-3 text-xs font-medium text-zinc-500">{lockReason}</p> : null}
      {saved ? <p role="status" className="mt-3 text-sm font-medium text-emerald-700">Proposal saved.</p> : null}
      {editing ? (
        <form onSubmit={save} className="mt-4 grid gap-4 border-t border-zinc-100 pt-4">
          <Field label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <Field label="Abstract" required>
            <Textarea value={abstract} onChange={(event) => setAbstract(event.target.value)} required rows={7} />
          </Field>
          {visibleFields.map((field) => (
            <Field key={field.id} label={field.label} required={field.required} help={field.helpText ?? undefined}>
              {field.fieldType === "select" ? (
                <Select
                  value={String(answers[field.key] ?? "")}
                  onChange={(event) => setAnswers((current) => ({ ...current, [field.key]: event.target.value }))}
                  required={field.required}
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
              ) : field.fieldType === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={answers[field.key] === true}
                    onChange={(event) => setAnswers((current) => ({ ...current, [field.key]: event.target.checked }))}
                  />
                  Yes
                </label>
              ) : (
                <Textarea
                  value={String(answers[field.key] ?? "")}
                  onChange={(event) => setAnswers((current) => ({ ...current, [field.key]: event.target.value }))}
                  required={field.required}
                />
              )}
            </Field>
          ))}
          <div className="rounded-lg border border-zinc-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Co-presenters</p>
                <p className="mt-1 text-xs text-zinc-500">Add or update co-presenters and their role labels at any time while editing is open.</p>
              </div>
              {coSpeakers.length < 2 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCoSpeakers((current) => [...current, { name: "", email: "", company: "", role: "Co-presenter" }])}
                >
                  Add co-presenter
                </Button>
              ) : null}
            </div>
            {coSpeakers.map((speaker, index) => (
              <div key={index} className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
                <Field label="Full name" htmlFor={`portal-co-name-${index}`} required>
                  <Input
                    id={`portal-co-name-${index}`}
                    value={speaker.name}
                    required
                    onChange={(event) => setCoSpeakers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                  />
                </Field>
                <Field label="Email" htmlFor={`portal-co-email-${index}`} required>
                  <Input
                    id={`portal-co-email-${index}`}
                    type="email"
                    value={speaker.email}
                    required
                    onChange={(event) => setCoSpeakers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item))}
                  />
                </Field>
                <Field label="Company" htmlFor={`portal-co-company-${index}`}>
                  <Input
                    id={`portal-co-company-${index}`}
                    value={speaker.company}
                    onChange={(event) => setCoSpeakers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, company: event.target.value } : item))}
                  />
                </Field>
                <Field label="Role label" htmlFor={`portal-co-role-${index}`}>
                  <Input
                    id={`portal-co-role-${index}`}
                    value={speaker.role}
                    onChange={(event) => setCoSpeakers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item))}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCoSpeakers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Remove co-presenter
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save proposal"}</Button>
        </form>
      ) : null}
    </article>
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

/**
 * A task the organizer built as a portal form — hotel stay, reimbursement,
 * dietary needs. The speaker answers it here rather than marking it complete by
 * hand; submitting stores the answers and completes the task in one call.
 */
function TaskForm({
  token,
  taskId,
  taskLabel,
  fields,
  savedAnswers,
  onSubmitted,
}: {
  token: string;
  taskId: string;
  taskLabel: string;
  fields: FormField[];
  savedAnswers: Record<string, unknown> | null;
  onSubmitted: (portal: SpeakerPortalResponse) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({ ...(savedAnswers ?? {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setAnswer(key: string, value: unknown) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onSubmitted(await apiClient.submitTaskForm(token, taskId, { answers }));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "The form could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      {savedAnswers ? (
        <p className="text-xs font-medium text-emerald-700">
          Submitted — your answers are saved. Change anything below and submit again.
        </p>
      ) : null}
      {fields.map((field) => {
        const inputId = `task-${taskId}-${field.key}`;
        const value = answers[field.key];
        const text = value === null || value === undefined ? "" : String(value);
        return (
          <Field
            key={field.id}
            label={field.label}
            htmlFor={inputId}
            required={field.required}
            help={field.helpText}
          >
            {field.fieldType === "textarea" ? (
              <Textarea
                id={inputId}
                value={text}
                required={field.required}
                onChange={(event) => setAnswer(field.key, event.target.value)}
              />
            ) : field.fieldType === "select" ? (
              <Select
                id={inputId}
                value={text}
                required={field.required}
                onChange={(event) => setAnswer(field.key, event.target.value)}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            ) : field.fieldType === "checkbox" ? (
              <input
                id={inputId}
                type="checkbox"
                className="size-4 rounded border-zinc-300"
                checked={value === true}
                required={field.required}
                onChange={(event) => setAnswer(field.key, event.target.checked)}
              />
            ) : field.fieldType === "number" ? (
              <Input
                id={inputId}
                type="number"
                value={text}
                required={field.required}
                onChange={(event) => {
                  const raw = event.target.value;
                  const parsed = Number(raw);
                  setAnswer(field.key, raw === "" || !Number.isFinite(parsed) ? raw : parsed);
                }}
              />
            ) : (
              <Input
                id={inputId}
                type={field.fieldType === "email" ? "email" : field.fieldType === "url" ? "url" : "text"}
                value={text}
                required={field.required}
                onChange={(event) => setAnswer(field.key, event.target.value)}
              />
            )}
          </Field>
        );
      })}
      {error ? <ErrorBanner message={error} /> : null}
      {saved && !error ? (
        <p role="status" className="text-xs font-medium text-emerald-700">Form submitted.</p>
      ) : null}
      <Button
        type="submit"
        aria-label={`${savedAnswers ? "Update" : "Submit"} form: ${taskLabel}`}
        className="w-full px-3 py-1.5 text-xs"
        disabled={saving}
      >
        {saving ? "Submitting…" : savedAnswers ? "Update form" : "Submit form"}
      </Button>
    </form>
  );
}

function AssetUploader({ token, tasks, sessions, onUploaded }: {
  token: string;
  tasks: SpeakerPortalResponse["tasks"];
  sessions: SpeakerPortalResponse["sessions"];
  onUploaded: () => Promise<void>;
}) {
  const [kind, setKind] = useState<AssetKind>("headshot");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [association, setAssociation] = useState("");

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const [contextType, contextId] = association.split(":", 2);
      await apiClient.uploadSpeakerAsset(token, file, kind, {
        taskId: contextType === "task" ? contextId : undefined,
        sessionId: contextType === "session" ? contextId : undefined,
      });
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
      <Select aria-label="Attach upload to a task or session" value={association} onChange={(event) => setAssociation(event.target.value)}>
        <option value="">General speaker file</option>
        {tasks.filter(({ task }) => task.status !== "complete").map(({ task, definition }) => <option key={task.id} value={`task:${task.id}`}>Complete task: {definition.label}</option>)}
        {sessions.map((session) => <option key={session.id} value={`session:${session.id}`}>Session: {session.title}</option>)}
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
        <SanitizedEmbed html={primary.embedHtml} />
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

/**
 * Organizer-authored HTML embed (venue maps, external schedules). Always
 * rendered through the allowlist sanitizer — never raw — and hidden entirely
 * when nothing safe survives.
 */
function SanitizedEmbed({ html }: { html: string }) {
  const safe = sanitizeEmbedHtml(html);
  if (!safe) return null;
  return (
    <div
      className="mt-4 overflow-hidden rounded-lg border border-zinc-200 [&_iframe]:w-full"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
