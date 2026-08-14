import { useState } from "react";
import { Link } from "react-router";
import type { CfpFormSummary } from "../../../shared/contracts";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Spinner, Textarea } from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";
import { CopyLinkButton } from "../../components/CopyLinkButton";
import { zonedLocalInputToIso } from "../../../shared/domain/timezone";

/**
 * The event's submission forms, side by side — the organizer's product runs
 * several calls at once (a main CFP beside a lightning-talk call), each with
 * its own questions, window, and capacity. The primary form keeps /cfp; every
 * other call lives at its own link.
 */
export function SubmissionForms() {
  const { eventSlug } = useAdminContext();
  const [reloadKey, setReloadKey] = useState(0);
  const { data, error, loading } = useAsync(
    () => apiClient.eventBundle(eventSlug),
    [eventSlug, reloadKey],
  );

  const [building, setBuilding] = useState(false);
  const [title, setTitle] = useState("");
  const [welcomeText, setWelcomeText] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [submissionLimit, setSubmissionLimit] = useState("");
  const [allowDrafts, setAllowDrafts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <Spinner label="Loading submission forms" />;
  if (error || !data) return <ErrorBanner message={error?.message ?? "Event could not be loaded."} />;

  const forms = data.cfpForms ?? [];
  const timezone = data.event.timezone;

  async function createForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (title.trim().length < 3) {
      setFormError("Give the call a title of at least three characters.");
      return;
    }
    const limit = submissionLimit.trim() === "" ? null : Number(submissionLimit);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      setFormError("The proposal limit must be a whole number of at least 1.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.createCfpForm(eventSlug, {
        title: title.trim(),
        welcomeText: welcomeText.trim() || null,
        thankYouText: null,
        isOpen: true,
        opensAt: null,
        closesAt: closesAt ? zonedLocalInputToIso(closesAt, timezone) : null,
        allowDrafts,
        submissionLimit: limit,
      });
      setNotice(`“${title.trim()}” is live. Its link is in the list below.`);
      setTitle("");
      setWelcomeText("");
      setClosesAt("");
      setSubmissionLimit("");
      setAllowDrafts(true);
      setBuilding(false);
      setReloadKey((k) => k + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiRequestError ? caught.message : "The form could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submission forms"
        subtitle="Run several calls side by side — each with its own questions, window, and capacity. The oldest form keeps the event's main /cfp link."
        actions={
          <Button onClick={() => { setBuilding((open) => !open); setNotice(null); }}>
            {building ? "Close" : "New form"}
          </Button>
        }
      />

      {notice ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</Card>
      ) : null}

      {building ? (
        <Card className="p-5">
          <h2 className="text-base font-semibold text-zinc-900">New call for proposals</h2>
          <p className="mt-1 text-sm text-zinc-500">
            It opens immediately with the standard proposal fields — title, abstract, track, and format.
          </p>
          {formError ? <div className="mt-3"><ErrorBanner message={formError} /></div> : null}
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={createForm}>
            <Field label="Title" htmlFor="new-form-title">
              <Input
                id="new-form-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lightning talks — late call"
              />
            </Field>
            <Field
              label={`Closes at (${timezone})`}
              htmlFor="new-form-closes"
              help={`Entered in the event timezone, ${timezone}. Leave blank to stay open until you close it.`}
            >
              <Input
                id="new-form-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Welcome message" htmlFor="new-form-welcome" help="Shown above the form.">
                <Textarea
                  id="new-form-welcome"
                  rows={2}
                  value={welcomeText}
                  onChange={(e) => setWelcomeText(e.target.value)}
                  placeholder="Ten minutes, one idea. Tell us what you would show."
                />
              </Field>
            </div>
            <Field
              label="Proposal limit per person"
              htmlFor="new-form-limit"
              help="Counts saved drafts as well as sent proposals. Blank means the event default applies."
            >
              <Input
                id="new-form-limit"
                type="number"
                min={1}
                value={submissionLimit}
                onChange={(e) => setSubmissionLimit(e.target.value)}
                placeholder="No form limit"
              />
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-zinc-700" htmlFor="new-form-drafts">
                <input
                  id="new-form-drafts"
                  type="checkbox"
                  className="size-4 rounded border-zinc-300 text-accent focus:ring-accent"
                  checked={allowDrafts}
                  onChange={(e) => setAllowDrafts(e.target.checked)}
                />
                Allow saved drafts
              </label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create form"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {forms.length === 0 ? (
        <EmptyState title="No submission forms" body="This event has no call for speakers yet." />
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <SubmissionFormCard key={form.id} form={form} eventSlug={eventSlug} timezone={timezone} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionFormCard({
  form,
  eventSlug,
  timezone,
}: {
  form: CfpFormSummary;
  eventSlug: string;
  timezone: string;
}) {
  const publicPath = form.isPrimary
    ? `/e/${eventSlug}/cfp`
    : `/e/${eventSlug}/cfp/${form.id}`;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">{form.title}</h3>
            {form.isPrimary ? <Badge tone="indigo">Primary</Badge> : null}
            <Badge tone={form.isOpen ? "emerald" : "zinc"}>{form.isOpen ? "Open" : "Closed"}</Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {form.submissionCount} submission{form.submissionCount === 1 ? "" : "s"}
            {" · "}
            {form.draftCount} draft{form.draftCount === 1 ? "" : "s"}
            {form.closesAt ? ` · closes ${formatDateTime(form.closesAt, timezone)}` : " · no close date"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyLinkButton path={publicPath} label={`Copy link to ${form.title}`} />
          <Link
            to={publicPath}
            className="text-sm font-medium text-accent hover:underline"
          >
            View form
          </Link>
        </div>
      </div>
    </Card>
  );
}
