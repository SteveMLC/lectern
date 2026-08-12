import { useState } from "react";
import { useSearchParams } from "react-router";
import type {
  CommunicationKind,
  CommunicationPreviewResponse,
  ScheduleNoticeDraftResponse,
  SimulateCommunicationResponse,
} from "../../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
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
  const [sent, setSent] = useState<SimulateCommunicationResponse | null>(null);
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
      setSendError(caught instanceof ApiRequestError ? caught.message : "Email delivery failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Communications"
        subtitle="Preview the exact speaker email, download its calendar handoff, and deliver it through the configured safe transport."
      />

      <BulkComposer eventSlug={eventSlug} />

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
              Delivery is simulated and receipted by default. When Resend is explicitly enabled, only allowlisted recipients receive real email.
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
      <Outbox eventSlug={eventSlug} />
    </div>
  );
}

function BulkComposer({ eventSlug }: { eventSlug: string }) {
  const roster = useAsync(() => apiClient.organizerSpeakers(eventSlug), [eventSlug]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const speakers = roster.data?.speakers ?? [];
  return <Card className="mb-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Bulk email and portal invitations</h2><p className="mt-1 text-xs text-zinc-500">Compose freely or send a personalized portal invitation; every recipient gets an individual receipt.</p></div><Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>{open ? "Close composer" : "Compose bulk email"}</Button></div>
    {open ? <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4">
      {roster.loading ? <Spinner label="Loading roster" /> : roster.error ? <ErrorBanner message={roster.error.message} /> : <div><div className="mb-2 flex gap-2"><Button type="button" variant="ghost" onClick={() => setSelected(new Set(speakers.map((speaker) => speaker.id)))}>Select all</Button><Button type="button" variant="ghost" onClick={() => setSelected(new Set(speakers.filter((speaker) => speaker.workflowStatus === "confirmed").map((speaker) => speaker.id)))}>Select confirmed</Button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{speakers.map((speaker) => <label key={speaker.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"><input type="checkbox" checked={selected.has(speaker.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(speaker.id); else next.delete(speaker.id); return next; })} />{speaker.name} <span className="text-xs text-zinc-400">{speaker.workflowStatus}</span></label>)}</div></div>}
      <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="secondary" onClick={() => { setSubject(`Your ${eventSlug} speaker portal`); setBodyMd("Hi {{speaker_name}},\n\nYour speaker portal for {{event_name}} is ready:\n\n{{portal_link}}\n\nUse this private link to update your profile, complete tasks, and upload requested files."); }}>Use portal invitation</Button><p className="text-xs text-zinc-500">Personalizes <code>{"{{speaker_name}}"}</code>, <code>{"{{event_name}}"}</code>, and each speaker's private portal link at send time.</p></div>
      <Field label="Subject" required><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
      <Field label="Message" required><Textarea className="min-h-32" value={bodyMd} onChange={(event) => setBodyMd(event.target.value)} /></Field>
      {notice ? <p role="status" className="text-sm font-medium text-emerald-700">{notice}</p> : null}{error ? <ErrorBanner message={error} /> : null}
      <Button type="button" disabled={selected.size === 0 || !subject.trim() || !bodyMd.trim() || sending} onClick={async () => { setSending(true); setError(null); setNotice(null); try { const result = await apiClient.sendBulkCommunication(eventSlug, { speakerIds: [...selected], subject, bodyMd }); setNotice(`${result.sent} messages recorded in the outbox: ${result.recipientEmails.join(", ")}.`); setSubject(""); setBodyMd(""); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Bulk message failed."); } finally { setSending(false); } }}>{sending ? "Sending…" : `Send to ${selected.size} selected`}</Button>
    </div> : null}
  </Card>;
}

function Outbox({ eventSlug }: { eventSlug: string }) {
  const { data, error, loading, reload } = useAsync(() => apiClient.outbox(eventSlug), [eventSlug]);
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 p-5">
        <div><h2 className="text-base font-semibold text-zinc-900">Sent messages</h2><p className="mt-1 text-sm text-zinc-500">Persistent simulated and real-delivery receipts.</p></div>
        <Button variant="secondary" onClick={reload}>Refresh outbox</Button>
      </div>
      {loading ? <div className="p-5"><Spinner label="Loading outbox" /></div> : error ? <div className="p-5"><ErrorBanner message={error.message} /></div> : data?.messages.length === 0 ? <div className="p-5"><EmptyState title="No messages recorded yet" /></div> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Recipient</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Sent</th><th className="px-5 py-3">Message id</th></tr></thead><tbody className="divide-y divide-zinc-100">{data?.messages.map((message) => <tr key={message.id}><td className="px-5 py-3 font-medium">{message.subject}</td><td className="px-5 py-3 text-zinc-600">{message.toEmail ?? "—"}</td><td className="px-5 py-3"><Badge tone={message.deliveryStatus === "failure" ? "rose" : "emerald"}>{message.status}</Badge></td><td className="px-5 py-3 text-zinc-500">{formatDateTime(message.createdAt)}</td><td className="px-5 py-3 font-mono text-xs text-zinc-500">{message.id}</td></tr>)}</tbody></table></div>
      )}
    </Card>
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
        `Processed ${draft.recipients.length} deliver${draft.recipients.length === 1 ? "y" : "ies"} — ${draft.recipients.map((recipient) => recipient.name).join(", ")} now ${draft.recipients.length === 1 ? "knows" : "know"} their slot.`,
      );
      setDraft(null);
      setNote("");
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Email delivery failed.");
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
                    : `Deliver to ${draft.recipients.length} speaker${draft.recipients.length === 1 ? "" : "s"}`}
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
  sent: SimulateCommunicationResponse | null;
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
            {sending ? "Delivering…" : "Deliver email"}
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
            {sent.status === "failed"
              ? `Delivery failed and was recorded: ${sent.error ?? "Unknown provider error"}`
              : `${sent.mode === "resend" ? "Email sent" : "Simulated delivery recorded"} at ${formatDateTime(sent.deliveredAt!)} · ${sent.providerId ?? sent.messageId}`}
          </div>
        ) : null}
        {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      </div>
    </Card>
  );
}
