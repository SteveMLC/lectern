import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  CfpSubmissionRequest,
  SessionFormat,
  type SubmitterAccountDashboardResponse,
  type FormField as FormFieldContract,
} from "../../shared/contracts";
import { isCfpOpen } from "../../shared/domain/cfp";
import { isFieldVisible, missingRequiredFields } from "../../shared/domain/rules";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "../components/ui";
import { ApiRequestError, apiClient } from "../lib/api";
import { useAsync } from "../lib/useAsync";

const FORMAT_LABELS: Record<SessionFormat, string> = {
  talk: "Talk (45 min)",
  workshop: "Workshop",
  panel: "Panel",
  lightning: "Lightning talk (10 min)",
  keynote: "Keynote (invited)",
};

/** Formats a proposer can choose; keynotes are invited by the organizer. */
const PROPOSABLE_FORMATS = SessionFormat.options.filter((f) => f !== "keynote");

interface FormState {
  name: string;
  email: string;
  company: string;
  role: string;
  bio: string;
  title: string;
  abstract: string;
  trackId: string;
  format: SessionFormat;
  answers: Record<string, unknown>;
  coSpeakers: Array<{ name: string; email: string; company: string; role: string; bio: string }>;
}

const INITIAL: FormState = {
  name: "",
  email: "",
  company: "",
  role: "",
  bio: "",
  title: "",
  abstract: "",
  trackId: "",
  format: "talk",
  answers: {},
  coSpeakers: [],
};

/** How long the confirmation page waits before it takes a submitter to their
 *  speaker portal: long enough to read the confirmation and to stop the trip. */
const PORTAL_REDIRECT_SECONDS = 10;

/**
 * Countdown copy for the post-submission redirect. Spelled out in words, so a
 * submitter reads what is about to happen instead of being thrown at it.
 */
export function portalRedirectCountdownText(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Taking you to your speaker portal now…";
  return `Taking you to your speaker portal in ${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"}…`;
}

/**
 * The form a submitter gets when they start another proposal: blank, and a
 * fresh object every time so answers cannot leak from the sent proposal into
 * the next one. A signed-in account keeps its name and email, because the form
 * renders those two read-only and a blank read-only field cannot be submitted.
 */
export function blankFormAfterSubmission(account: { name: string; email: string } | null): FormState {
  return {
    ...INITIAL,
    name: account?.name ?? "",
    email: account?.email ?? "",
    answers: {},
    coSpeakers: [],
  };
}

export function CfpPage() {
  const { slug = "", formId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftToken = searchParams.get("draft");
  const { data, error, loading } = useAsync(() => apiClient.eventBundle(slug, formId), [slug, formId]);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [submitterToken, setSubmitterToken] = useState<string | null>(null);
  const [submitterAccount, setSubmitterAccount] = useState<{ name: string; email: string } | null>(null);
  const [submitterSessionPending, setSubmitterSessionPending] = useState(() =>
    typeof window !== "undefined"
      && Boolean(window.localStorage.getItem(`lectern.submitter.${slug}`)),
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);

  useEffect(() => {
    // React Router reuses this page when someone follows the link from one
    // open call to another. Clear every form-scoped state value so answers,
    // errors, and confirmation details cannot cross that boundary.
    setForm(blankFormAfterSubmission(submitterAccount));
    setFieldErrors({});
    setServerError(null);
    setSubmitting(false);
    setSubmittedId(null);
    setSubmittedRef(null);
    setPortalToken(null);
    setSavingDraft(false);
    setDraftSavedAt(null);
    setResumeUrl(null);
    setDraftLoadError(null);
    setSubmitterSessionPending(
      typeof window !== "undefined"
        && Boolean(window.localStorage.getItem(`lectern.submitter.${slug}`)),
    );
  }, [slug, formId]);

  useEffect(() => {
    if (!draftToken) return;
    let active = true;
    setDraftLoadError(null);
    void apiClient.cfpDraft(slug, draftToken).then((response) => {
      if (!active) return;
      const draft = response.draft;
      setForm({
        name: draft.speaker?.name ?? "",
        email: draft.speaker?.email ?? "",
        company: draft.speaker?.company ?? "",
        role: draft.speaker?.title ?? "",
        bio: draft.speaker?.bio ?? "",
        title: draft.title,
        abstract: draft.abstract ?? "",
        trackId: draft.trackId ?? "",
        format: draft.format ?? "talk",
        answers: draft.answers ?? {},
        coSpeakers: (draft.coSpeakers ?? []).map((speaker) => ({
          name: speaker.name ?? "",
          email: speaker.email ?? "",
          company: speaker.company ?? "",
          role: speaker.title ?? "",
          bio: speaker.bio ?? "",
        })),
      });
      setDraftSavedAt(response.savedAt);
      setResumeUrl(new URL(response.resumeUrl, window.location.origin).toString());
    }).catch((caught) => {
      if (!active) return;
      setDraftLoadError(caught instanceof ApiRequestError ? caught.message : "Draft could not be restored.");
    });
    return () => { active = false; };
  }, [draftToken, slug]);

  const ruleCtx = useMemo(
    () => ({ format: form.format, answers: form.answers }),
    [form.format, form.answers],
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading form" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <ErrorBanner message={error?.message ?? "Event not found."} />
      </div>
    );
  }

  const { event, tracks, cfp } = data;
  const otherOpenCalls = (data.cfpForms ?? []).filter(
    (candidate) => candidate.id !== cfp?.form.id && candidate.isOpen,
  );
  if (!cfp || !isCfpOpen(cfp.form, new Date().toISOString())) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">{event.name}</h1>
        <p className="mt-3 text-sm text-zinc-600">The call for speakers is closed.</p>
        <Link
          to={`/e/${event.slug}`}
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to the event page
        </Link>
      </div>
    );
  }

  /** Back to a blank form, as if the submitter had just opened the page: no
   *  reference id, no portal link, no field values, no errors, and no draft
   *  token left in the query string to restore what they have already sent. */
  function submitAnother() {
    setForm(blankFormAfterSubmission(submitterAccount));
    setFieldErrors({});
    setServerError(null);
    setSubmittedId(null);
    setSubmittedRef(null);
    setPortalToken(null);
    setDraftSavedAt(null);
    setResumeUrl(null);
    setDraftLoadError(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("draft");
        return next;
      },
      { replace: true },
    );
  }

  if (submittedId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <SubmissionConfirmation
          eventName={event.name}
          eventSlug={event.slug}
          submittedId={submittedId}
          referenceCode={submittedRef}
          portalToken={portalToken}
          thankYouText={cfp.form.thankYouText}
          onSubmitAnother={submitAnother}
        />
      </div>
    );
  }

  const visibleCustomFields = cfp.fields.filter((f) => isFieldVisible(f, cfp.rules, ruleCtx));

  const setAnswer = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, answers: { ...prev.answers, [key]: value } }));

  async function saveDraft() {
    setServerError(null);
    if (!form.title.trim()) {
      setFieldErrors((current) => ({ ...current, title: "Add a title before saving your draft." }));
      return;
    }
    setSavingDraft(true);
    try {
      const response = await apiClient.saveCfpDraft(slug, draftToken, {
        speaker: {
          name: form.name,
          email: form.email,
          company: form.company,
          title: form.role,
          bio: form.bio,
        },
        coSpeakers: form.coSpeakers.map((speaker) => ({
          name: speaker.name,
          email: speaker.email,
          company: speaker.company,
          title: speaker.role,
          bio: speaker.bio,
        })),
        title: form.title.trim(),
        abstract: form.abstract,
        trackId: form.trackId,
        format: form.format,
        answers: form.answers,
      }, formId);
      setDraftSavedAt(response.savedAt);
      const resumePath = formId
        ? `/e/${encodeURIComponent(slug)}/cfp/${encodeURIComponent(formId)}?draft=${encodeURIComponent(response.token)}`
        : response.resumeUrl;
      setResumeUrl(new URL(resumePath, window.location.origin).toString());
      if (!draftToken) setSearchParams({ draft: response.token }, { replace: true });
    } catch (caught) {
      setServerError(caught instanceof ApiRequestError ? caught.message : "Draft could not be saved.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const payload: CfpSubmissionRequest = {
      formId: cfp?.form.id ?? null,
      speaker: {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        title: form.role.trim() || undefined,
        bio: form.bio.trim() || undefined,
      },
      coSpeakers: form.coSpeakers.map((speaker) => ({
        name: speaker.name.trim(), email: speaker.email.trim(),
        company: speaker.company.trim() || undefined,
        title: speaker.role.trim() || undefined,
        bio: speaker.bio.trim() || undefined,
      })),
      title: form.title.trim(),
      abstract: form.abstract.trim(),
      trackId: form.trackId,
      format: form.format,
      answers: form.answers,
    };

    const errors: Record<string, string> = {};
    const parsed = CfpSubmissionRequest.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!errors[key]) errors[key] = issue.message;
      }
    }
    if (!payload.trackId) errors["trackId"] = "Pick a track.";
    for (const field of missingRequiredFields(cfp!.fields, cfp!.rules, ruleCtx)) {
      errors[`answers.${field.key}`] = "Required.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await apiClient.submitCfp(slug, parsed.success ? parsed.data : payload, submitterToken);
      setSubmittedId(res.submission.id);
      setSubmittedRef(res.submission.referenceCode ?? null);
      setPortalToken(res.submission.speakers[0]?.speakerId ?? null);
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError ? err.message : "Submission failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to={`/e/${event.slug}`}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← {event.name}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {cfp.form.title}
        </h1>
        {cfp.form.welcomeText ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{cfp.form.welcomeText}</p>
        ) : null}
        {otherOpenCalls.length > 0 ? (
          <p className="mt-3 text-xs text-zinc-500">
            This event is also running{" "}
            {otherOpenCalls.map((call, index) => (
              <span key={call.id}>
                {index > 0 ? " and " : ""}
                <Link
                  className="font-medium text-accent hover:underline"
                  to={call.isPrimary ? `/e/${event.slug}/cfp` : `/e/${event.slug}/cfp/${call.id}`}
                >
                  {call.title}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : null}

        <SubmitterAccountCard
          slug={event.slug}
          onSession={(token, account) => {
            setSubmitterToken(token);
            setSubmitterAccount(account);
            setSubmitterSessionPending(false);
            if (account) {
              setForm((current) => ({ ...current, name: account.name, email: account.email }));
              setFieldErrors((current) => {
                const next = { ...current };
                delete next["speaker.name"];
                delete next["speaker.email"];
                return next;
              });
            }
          }}
        />
        <LinkRecoveryCard slug={event.slug} />

        {draftLoadError ? <div className="mt-4"><ErrorBanner message={draftLoadError} /></div> : null}
        {draftSavedAt ? (
          <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Draft saved · {new Date(draftSavedAt).toLocaleString()}</p>
            <p className="mt-1 text-xs">Keep this private return link to finish later from any browser.</p>
            {resumeUrl ? <Input className="mt-2" aria-label="Private draft return link" value={resumeUrl} readOnly onFocus={(event) => event.currentTarget.select()} /> : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
          <Card className="space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              About you
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name" required error={fieldErrors["speaker.name"]}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ada Okafor"
                  autoComplete="name"
                  readOnly={Boolean(submitterToken)}
                />
              </Field>
              <Field label="Email" htmlFor="email" required error={fieldErrors["speaker.email"]}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  autoComplete="email"
                  readOnly={Boolean(submitterToken)}
                />
              </Field>
              <Field label="Company" htmlFor="company" error={fieldErrors["speaker.company"]}>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </Field>
              <Field label="Role" htmlFor="role" error={fieldErrors["speaker.title"]}>
                <Input
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Staff Engineer"
                />
              </Field>
            </div>
            <Field
              label="Short bio"
              htmlFor="bio"
              help="Two or three sentences, third person. Shown on the public site if accepted. No headshot needed yet — if we accept you, your speaker portal will ask for it."
              error={fieldErrors["speaker.bio"]}
            >
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </Field>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Co-presenters</h2><p className="mt-1 text-xs text-zinc-500">Names and role labels stay attached to this proposal and its accepted session.</p></div>
              {form.coSpeakers.length < Math.max(0, cfp.form.maxSpeakersPerSubmission - 1) ? <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, coSpeakers: [...current.coSpeakers, { name: "", email: "", company: "", role: "Co-presenter", bio: "" }] }))}>Add co-presenter</Button> : null}
            </div>
            {form.coSpeakers.map((speaker, index) => <div key={index} className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2"><Field label="Full name" htmlFor={`co-name-${index}`} required error={fieldErrors[`coSpeakers.${index}.name`]}><Input id={`co-name-${index}`} value={speaker.name} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Email" htmlFor={`co-email-${index}`} required error={fieldErrors[`coSpeakers.${index}.email`]}><Input id={`co-email-${index}`} type="email" value={speaker.email} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item) }))} /></Field><Field label="Company" htmlFor={`co-company-${index}`}><Input id={`co-company-${index}`} value={speaker.company} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, company: event.target.value } : item) }))} /></Field><Field label="Role label" htmlFor={`co-role-${index}`}><Input id={`co-role-${index}`} value={speaker.role} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) }))} /></Field><div className="sm:col-span-2"><Field label="Short bio"><Textarea value={speaker.bio} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, bio: event.target.value } : item) }))} /></Field></div><div className="sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.filter((_, itemIndex) => itemIndex !== index) }))}>Remove co-presenter</Button></div></div>)}
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Your proposal
            </h2>
            <Field label="Session title" htmlFor="title" required error={fieldErrors["title"]}>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What Broke When We Shipped It"
              />
            </Field>
            <Field
              label="Abstract"
              htmlFor="abstract"
              required
              help="What will the audience learn? Real numbers and real failures beat theory."
              error={fieldErrors["abstract"]}
            >
              <Textarea
                id="abstract"
                value={form.abstract}
                onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                className="min-h-36"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Track" htmlFor="track" required error={fieldErrors["trackId"]}>
                <Select
                  id="track"
                  value={form.trackId}
                  onChange={(e) => setForm({ ...form, trackId: e.target.value })}
                >
                  <option value="">Choose a track…</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Format" htmlFor="format" required error={fieldErrors["format"]}>
                <Select
                  id="format"
                  value={form.format}
                  onChange={(e) =>
                    setForm({ ...form, format: e.target.value as SessionFormat })
                  }
                >
                  {PROPOSABLE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {visibleCustomFields.map((field) => (
              <CustomField
                key={field.id}
                field={field}
                value={form.answers[field.key]}
                error={fieldErrors[`answers.${field.key}`]}
                onChange={(value) => setAnswer(field.key, value)}
              />
            ))}
          </Card>

          {serverError ? <ErrorBanner message={serverError} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              Up to {cfp.form.maxSpeakersPerSubmission} speakers per session.
            </p>
            <div className="flex gap-2">
              {cfp.form.allowDrafts ? (
                <Button type="button" variant="secondary" disabled={savingDraft || submitting || submitterSessionPending} onClick={() => void saveDraft()}>
                  {savingDraft ? "Saving draft…" : draftToken ? "Update draft" : "Save and finish later"}
                </Button>
              ) : null}
              <Button type="submit" disabled={submitting || savingDraft || submitterSessionPending}>
                {submitting ? "Submitting…" : submitterSessionPending ? "Restoring account…" : "Submit proposal"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * What a submitter sees the moment their proposal lands. It walks them into
 * their speaker portal ten seconds later, counted down out loud, with both
 * exits on screen the whole time: go now, or stay put.
 */
function SubmissionConfirmation({
  eventName,
  eventSlug,
  submittedId,
  referenceCode,
  portalToken,
  thankYouText,
  onSubmitAnother,
}: {
  eventName: string;
  eventSlug: string;
  submittedId: string;
  referenceCode: string | null;
  portalToken: string | null;
  thankYouText: string | null;
  onSubmitAnother: () => void;
}) {
  const navigate = useNavigate();
  const portalPath = portalToken ? `/speaker/${portalToken}` : null;
  const [secondsLeft, setSecondsLeft] = useState(PORTAL_REDIRECT_SECONDS);
  /** Cancelling is sticky: nothing sets this back to true, so a submitter who
   *  says stay is never grabbed a second time. */
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (!portalPath || !redirecting) return;
    if (secondsLeft <= 0) {
      void navigate(portalPath);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1_000);
    return () => clearTimeout(timer);
  }, [navigate, portalPath, redirecting, secondsLeft]);

  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
        ✓
      </div>
      <h1 className="text-xl font-semibold text-zinc-900">Proposal received</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        {thankYouText ?? "Thanks — your proposal is in."}
      </p>
      <p className="mt-4 text-xs text-zinc-400">Reference: {referenceCode ?? submittedId}</p>

      {portalPath ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p aria-live="polite" className="text-sm text-zinc-700">
            {redirecting
              ? portalRedirectCountdownText(secondsLeft)
              : "Staying on this page. Open your speaker portal whenever you are ready."}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => void navigate(portalPath)}>
              Go now
            </Button>
            {/* The cancel control stays on screen after it is used: unmounting
                the button a keyboard user has just pressed drops their focus. */}
            <Button type="button" variant="secondary" onClick={() => setRedirecting(false)}>
              Stay on this page
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to={`/e/${eventSlug}`} className="text-sm font-medium text-accent hover:underline">
          Back to {eventName}
        </Link>
        {portalPath ? (
          <Link to={portalPath} className="text-sm font-medium text-accent hover:underline">
            Open speaker portal
          </Link>
        ) : null}
      </div>

      <div className="mt-6 border-t border-zinc-100 pt-5">
        <Button type="button" variant="secondary" onClick={onSubmitAnother}>
          Submit another proposal
        </Button>
        <p className="mt-2 text-xs text-zinc-500">Opens a blank form for your next session.</p>
      </div>
    </Card>
  );
}

function CustomField({
  field,
  value,
  error,
  onChange,
}: {
  field: FormFieldContract;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const id = `custom-${field.key}`;

  if (field.fieldType === "checkbox") {
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-zinc-800" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 rounded border-zinc-300 accent-[#4f46e5]"
          />
          {field.label}
          {field.required ? <span className="text-rose-600">*</span> : null}
        </label>
        {field.helpText ? <p className="text-xs text-zinc-500">{field.helpText}</p> : null}
        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      </div>
    );
  }

  if (field.fieldType === "select") {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} help={field.helpText} error={error}>
        <Select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.fieldType === "multiselect") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <Field label={field.label} required={field.required} help={field.helpText} error={error}>
        <div className="space-y-1.5">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, o] : selected.filter((s) => s !== o),
                  )
                }
                className="size-4 rounded border-zinc-300 accent-[#4f46e5]"
              />
              {o}
            </label>
          ))}
        </div>
      </Field>
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} help={field.helpText} error={error}>
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    );
  }

  const inputType =
    field.fieldType === "email" ? "email" : field.fieldType === "url" ? "url" : field.fieldType === "number" ? "number" : "text";

  return (
    <Field label={field.label} htmlFor={id} required={field.required} help={field.helpText} error={error}>
      <Input
        id={id}
        type={inputType}
        value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
        onChange={(e) =>
          onChange(field.fieldType === "number" ? e.target.valueAsNumber : e.target.value)
        }
      />
    </Field>
  );
}

function SubmitterAccountCard({
  slug,
  onSession,
}: {
  slug: string;
  onSession: (token: string | null, account: { name: string; email: string } | null) => void;
}) {
  const storageKey = `lectern.submitter.${slug}`;
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState<SubmitterAccountDashboardResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(storageKey);
    if (!token) return;
    let active = true;
    void apiClient.submitterDashboard(slug, token).then((response) => {
      if (!active) return;
      setDashboard(response);
      setEmail(response.account.email);
      setName(response.account.name);
      onSession(token, response.account);
    }).catch(() => {
      if (!active) return;
      localStorage.removeItem(storageKey);
      onSession(null, null);
    });
    return () => { active = false; };
  }, [slug, storageKey]);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = mode === "signup"
        ? await apiClient.createSubmitterAccount(slug, { name, email, password })
        : await apiClient.signInSubmitterAccount(slug, { email, password });
      localStorage.setItem(storageKey, response.sessionToken);
      setDashboard({ account: response.account, proposals: response.proposals, portalPath: response.portalPath });
      setName(response.account.name);
      setEmail(response.account.email);
      setPassword("");
      setNotice(mode === "signup" ? "Submitter account created. Complete your proposal below." : "Signed in to your submitter dashboard.");
      onSession(response.sessionToken, response.account);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "The submitter account could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  if (dashboard) {
    return (
      <Card className="mt-5 border-indigo-200 bg-indigo-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-950">Submitter dashboard · signed in</p>
            <p className="mt-1 text-xs text-indigo-800">{dashboard.account.name} · {dashboard.account.email}</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => {
            localStorage.removeItem(storageKey);
            setDashboard(null);
            setNotice(null);
            onSession(null, null);
          }}>Sign out</Button>
        </div>
        {notice ? <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {dashboard.proposals.length > 0 ? (
          <div className="mt-3 space-y-2" aria-label="My submissions">
            {dashboard.proposals.map((proposal) => (
              <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm">
                <span className="font-medium text-zinc-900">{proposal.title}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold capitalize text-indigo-800">{proposal.status.replaceAll("_", " ")}</span>
              </div>
            ))}
            {dashboard.portalPath ? <Link className="inline-block text-sm font-medium text-accent hover:underline" to={dashboard.portalPath}>Open full speaker portal</Link> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-indigo-900">No proposals yet. Complete the form below; your submitted proposal and status will appear here.</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="mt-5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Speaker submitter account</p>
          <p className="mt-1 text-xs text-zinc-500">Create an account to keep proposals and statuses together, or submit without one and use a private capability link.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={mode === "signup" ? "secondary" : "ghost"} onClick={() => { setMode("signup"); setError(null); }}>Create account</Button>
          <Button type="button" variant={mode === "signin" ? "secondary" : "ghost"} onClick={() => { setMode("signin"); setError(null); }}>Sign in</Button>
        </div>
      </div>
      <form onSubmit={authenticate} className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
        {mode === "signup" ? <Field label="Full name" htmlFor="account-name" required><Input id="account-name" value={name} required autoComplete="name" onChange={(event) => setName(event.target.value)} /></Field> : null}
        <Field label="Email" htmlFor="account-email" required><Input id="account-email" type="email" value={email} required autoComplete="email" onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="Password" htmlFor="account-password" required help="At least 8 characters."><Input id="account-password" type="password" minLength={8} value={password} required autoComplete={mode === "signup" ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} /></Field>
        <div className="flex items-end"><Button type="submit" disabled={busy}>{busy ? "Working…" : mode === "signup" ? "Create submitter account" : "Sign in to dashboard"}</Button></div>
        {notice ? <p role="status" className="sm:col-span-2 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <div className="sm:col-span-2"><ErrorBanner message={error} /></div> : null}
      </form>
    </Card>
  );
}

function LinkRecoveryCard({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiClient.recoverSpeakerLinks(slug, email.trim());
      setNotice(response.message);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "The request could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Submitted without an account?</span> Your private capability link
          is still your access. Lost it?
        </p>
        <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Email me my links"}
        </Button>
      </div>
      {open ? (
        <form onSubmit={send} className="mt-3 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-3">
          <div className="min-w-56 flex-1">
            <Field label="The email you submitted with" htmlFor="recovery-email" required>
              <Input
                id="recovery-email"
                type="email"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
          </div>
          <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send my links"}</Button>
          {notice ? <p role="status" className="w-full text-sm font-medium text-emerald-700">{notice}</p> : null}
          {error ? <div className="w-full"><ErrorBanner message={error} /></div> : null}
        </form>
      ) : null}
    </div>
  );
}
