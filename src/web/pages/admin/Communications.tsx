import { useState } from "react";
import { useSearchParams } from "react-router";
import type {
  CommunicationKind,
  CommunicationPreviewResponse,
  ScheduleNoticeDraftResponse,
} from "../../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  cn,
} from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export function Communications() {
  const { eventSlug } = useAdminContext();
  const speakers = useAsync(() => apiClient.publicSpeakers(eventSlug), [eventSlug]);
  // "Request more info" on a review card lands here with the speaker preselected.
  const [searchParams] = useSearchParams();
  const [selectedSpeaker, setSelectedSpeaker] = useState(searchParams.get("speaker") ?? "");
  const [kind, setKind] = useState<CommunicationKind>("reminder");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ messageId: string; deliveredAt: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const speakerId = selectedSpeaker || speakers.data?.speakers[0]?.id || "";
  const preview = useAsync<CommunicationPreviewResponse | null>(
    () =>
      speakerId
        ? apiClient.communicationPreview(eventSlug, speakerId, kind)
        : Promise.resolve(null),
    [eventSlug, speakerId, kind],
  );

  async function simulate() {
    if (!preview.data) return;
    setSending(true);
    setSent(null);
    setSendError(null);
    try {
      const result = await apiClient.simulateCommunication(eventSlug, {
        speakerId: preview.data.speakerId,
        subject: preview.data.subject,
        bodyMd: preview.data.bodyMd,
      });
      setSent(result);
    } catch (caught) {
      setSendError(caught instanceof ApiRequestError ? caught.message : "Simulated send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Communications"
        subtitle="Preview the exact speaker email, download its calendar handoff, and record a safe simulated send."
      />

      <ScheduleNoticeCard eventSlug={eventSlug} preselect={searchParams.get("session") ?? ""} />

      {speakers.loading ? (
        <Spinner label="Loading speakers" />
      ) : speakers.error ? (
        <ErrorBanner message={speakers.error.message} />
      ) : speakers.data?.speakers.length === 0 ? (
        <EmptyState title="No speakers yet" body="Accept a proposal or add a speaker before composing an update." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Message setup</h2>
            <div className="mt-4 space-y-4">
              <Field label="Speaker">
                <Select value={speakerId} onChange={(event) => { setSelectedSpeaker(event.target.value); setSent(null); }}>
                  {speakers.data?.speakers.map((speaker) => (
                    <option key={speaker.id} value={speaker.id}>{speaker.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Template">
                <Select value={kind} onChange={(event) => { setKind(event.target.value as CommunicationKind); setSent(null); }}>
                  <option value="reminder">Outstanding tasks reminder</option>
                  <option value="session_update">Session update + calendar</option>
                </Select>
              </Field>
            </div>
            <div className="mt-5 rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-500">
              Simulated mode writes a message and successful delivery attempt to the outbox without contacting the speaker.
            </div>
          </Card>

          <section>
            {preview.loading ? (
              <Spinner label="Rendering preview" />
            ) : preview.error ? (
              <ErrorBanner message={preview.error.message} />
            ) : preview.data ? (
              <MessagePreview
                preview={preview.data}
                sending={sending}
                sent={sent}
                error={sendError}
                onSimulate={simulate}
              />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * Session-centric schedule notices: pick a slotted session, tell every
 * speaker on it their confirmed day, time, and room. Deliberate — dragging a
 * session never fires an email; this card is where the organizer decides to
 * speak. Drafts are AI-personalized from an optional note; the slot facts
 * arrive from the server pre-formatted in the event timezone and are
 * guaranteed into the body whatever the model writes.
 */
function ScheduleNoticeCard({ eventSlug, preselect }: { eventSlug: string; preselect: string }) {
  const agenda = useAsync(() => apiClient.agenda(eventSlug), [eventSlug]);
  const [selectedSession, setSelectedSession] = useState(preselect);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<ScheduleNoticeDraftResponse | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = (agenda.data?.sessions ?? []).filter(
    (session) => session.slot !== null && session.speakers.length > 0,
  );
  const sessionId = eligible.some((session) => session.id === selectedSession)
    ? selectedSession
    : eligible[0]?.id ?? "";
  const chosen = eligible.find((session) => session.id === sessionId);

  async function draftNotice() {
    if (!sessionId) return;
    setDrafting(true);
    setError(null);
    setDone(null);
    try {
      const result = await apiClient.scheduleNoticeDraft(eventSlug, sessionId, { note });
      setDraft(result);
      setSubject(result.subject);
      setBody(result.bodyMd);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Drafting failed — try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function sendToAll() {
    if (!draft) return;
    setSending(true);
    setError(null);
    try {
      for (const recipient of draft.recipients) {
        await apiClient.simulateCommunication(eventSlug, {
          speakerId: recipient.speakerId,
          subject,
          bodyMd: body,
        });
      }
      setDone(
        `Recorded ${draft.recipients.length} simulated deliver${draft.recipients.length === 1 ? "y" : "ies"} — ${draft.recipients.map((recipient) => recipient.name).join(", ")} now ${draft.recipients.length === 1 ? "knows" : "know"} their slot.`,
      );
      setDraft(null);
      setNote("");
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Simulated send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Schedule notice</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tell a session's speakers their confirmed day, time, and room. Nothing fires when you
            drag the agenda — you decide when the schedule speaks.
          </p>
        </div>
      </div>

      {agenda.loading ? (
        <div className="mt-4">
          <Spinner label="Loading scheduled sessions" />
        </div>
      ) : agenda.error ? (
        <div className="mt-4">
          <ErrorBanner message={agenda.error.message} />
        </div>
      ) : eligible.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No scheduled sessions with speakers yet — place a session on the agenda first.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Session">
              <Select
                value={sessionId}
                onChange={(event) => {
                  setSelectedSession(event.target.value);
                  setDraft(null);
                  setDone(null);
                }}
              >
                {eligible.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} — {session.speakers.map((speaker) => speaker.name).join(", ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note for the draft (optional, stays internal)">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={'e.g. "gave them the post-keynote slot — biggest room of the day"'}
                className="min-h-10 text-xs"
                disabled={drafting}
              />
            </Field>
          </div>

          {draft === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={drafting || !sessionId} onClick={() => void draftNotice()}>
                {drafting ? "Drafting…" : "Draft schedule notice"}
              </Button>
              {chosen ? (
                <span className="text-xs text-zinc-500">
                  Goes to {chosen.speakers.length} speaker{chosen.speakers.length === 1 ? "" : "s"}.
                </span>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-800">
                  To: {draft.recipients.map((recipient) => `${recipient.name} <${recipient.email}>`).join(", ")}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    draft.aiUsed ? "bg-indigo-100 text-indigo-800" : "bg-zinc-200 text-zinc-600",
                  )}
                >
                  {draft.aiUsed
                    ? `Drafted by ${draft.model ?? "Claude"} from your note`
                    : "Template draft — AI not configured"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Slot (guaranteed in the email): {draft.slotSummary}
              </p>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 focus:border-accent focus:outline-none"
                aria-label="Notice subject"
              />
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-1.5 min-h-40 bg-white text-xs leading-5"
                aria-label="Notice body"
              />
              {draft.note ? <p className="mt-1 text-[11px] text-zinc-400">{draft.note}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  className="px-2.5 py-1 text-xs"
                  disabled={sending || !subject.trim() || !body.trim()}
                  onClick={() => void sendToAll()}
                >
                  {sending
                    ? "Sending…"
                    : `Send (simulated) to ${draft.recipients.length} speaker${draft.recipients.length === 1 ? "" : "s"}`}
                </Button>
                <a
                  href={draft.icsUrl}
                  download
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                >
                  Download .ics
                </a>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-xs"
                  disabled={sending}
                  onClick={() => void draftNotice()}
                >
                  Redraft
                </Button>
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-zinc-700"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {done ? (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {done}
            </div>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
        </div>
      )}
    </Card>
  );
}

function MessagePreview({
  preview,
  sending,
  sent,
  error,
  onSimulate,
}: {
  preview: CommunicationPreviewResponse;
  sending: boolean;
  sent: { messageId: string; deliveredAt: string } | null;
  error: string | null;
  onSimulate: () => Promise<void>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email preview</p>
          <p className="mt-1 text-sm font-medium text-zinc-900">To: {preview.speakerName} &lt;{preview.toEmail}&gt;</p>
        </div>
        <Badge tone={preview.kind === "reminder" ? "amber" : "indigo"}>
          {preview.kind === "reminder" ? `${preview.pendingTaskCount} pending` : "Schedule update"}
        </Badge>
      </div>
      <div className="p-5">
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-3">
            <span className="text-xs text-zinc-400">Subject</span>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{preview.subject}</p>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-4 font-sans text-sm leading-6 text-zinc-700">{preview.bodyMd}</pre>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={sending} onClick={() => void onSimulate()}>
            {sending ? "Recording…" : "Send simulated"}
          </Button>
          {preview.icsUrl ? (
            <a
              href={preview.icsUrl}
              download
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Download .ics
            </a>
          ) : null}
        </div>

        {sent ? (
          <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Simulated delivery recorded at {formatDateTime(sent.deliveredAt)} · {sent.messageId}
          </div>
        ) : null}
        {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      </div>
    </Card>
  );
}
