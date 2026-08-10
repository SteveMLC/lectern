import { useState } from "react";
import { useSearchParams } from "react-router";
import type { CommunicationKind, CommunicationPreviewResponse } from "../../../shared/contracts";
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
