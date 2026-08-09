import { Link, useParams } from "react-router";
import type { ResourcePage, SpeakerTask } from "../../shared/contracts";
import { Badge, Card, EmptyState, ErrorBanner, Spinner } from "../components/ui";
import { apiClient } from "../lib/api";
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
  const { data, error, loading } = useAsync(() => apiClient.speakerPortal(token), [token]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading speaker portal" />
      </div>
    );
  }

  if (error || !data) {
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

  const completedTasks = data.tasks.filter((item) => item.task.status === "complete").length;
  const nextDue = data.tasks
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
            <Metric label="Next due" value={nextDue ? formatDateTime(nextDue) : "None"} />
          </div>

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
                        {session.startsAt ? formatDateTime(session.startsAt) : "Time pending"}
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
                    <p className="mt-2 text-xs text-zinc-500">Due {formatDateTime(definition.dueAt)}</p>
                  ) : null}
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
          </Card>
        </aside>
      </main>
    </div>
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
