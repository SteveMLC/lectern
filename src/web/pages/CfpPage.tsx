import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  CfpSubmissionRequest,
  SessionFormat,
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

export function CfpPage() {
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftToken = searchParams.get("draft");
  const { data, error, loading } = useAsync(() => apiClient.eventBundle(slug), [slug]);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);

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

  if (submittedId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Proposal received</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            {cfp.form.thankYouText ?? "Thanks — your proposal is in."}
          </p>
          <p className="mt-4 text-xs text-zinc-400">Reference: {submittedId}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to={`/e/${event.slug}`} className="text-sm font-medium text-accent hover:underline">
              Back to {event.name}
            </Link>
            {portalToken ? (
              <Link
                to={`/speaker/${portalToken}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                Open speaker portal
              </Link>
            ) : null}
          </div>
        </Card>
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
      });
      setDraftSavedAt(response.savedAt);
      setResumeUrl(new URL(response.resumeUrl, window.location.origin).toString());
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
      const res = await apiClient.submitCfp(slug, parsed.success ? parsed.data : payload);
      setSubmittedId(res.submission.id);
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
            {form.coSpeakers.map((speaker, index) => <div key={index} className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2"><Field label="Full name" required error={fieldErrors[`coSpeakers.${index}.name`]}><Input value={speaker.name} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Email" required error={fieldErrors[`coSpeakers.${index}.email`]}><Input type="email" value={speaker.email} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item) }))} /></Field><Field label="Company"><Input value={speaker.company} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, company: event.target.value } : item) }))} /></Field><Field label="Role label"><Input value={speaker.role} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) }))} /></Field><div className="sm:col-span-2"><Field label="Short bio"><Textarea value={speaker.bio} onChange={(event) => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.map((item, itemIndex) => itemIndex === index ? { ...item, bio: event.target.value } : item) }))} /></Field></div><div className="sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, coSpeakers: current.coSpeakers.filter((_, itemIndex) => itemIndex !== index) }))}>Remove co-presenter</Button></div></div>)}
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
                <Button type="button" variant="secondary" disabled={savingDraft || submitting} onClick={() => void saveDraft()}>
                  {savingDraft ? "Saving draft…" : draftToken ? "Update draft" : "Save and finish later"}
                </Button>
              ) : null}
              <Button type="submit" disabled={submitting || savingDraft}>
                {submitting ? "Submitting…" : "Submit proposal"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
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
