import { useState } from "react";
import type {
  CreatePortalFormRequest,
  PortalFormFieldInput,
  PortalFormsResponse,
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
} from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

type PortalFormFieldType = PortalFormFieldInput["fieldType"];
type PortalForm = PortalFormsResponse["forms"][number];

const FIELD_TYPES: { value: PortalFormFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Choice list" },
  { value: "checkbox", label: "Checkbox" },
  { value: "email", label: "Email" },
  { value: "url", label: "Web address" },
  { value: "number", label: "Number" },
];

/** Keyed loosely: a stored field carries the wider CFP field-type union. */
const FIELD_TYPE_LABEL = new Map<string, string>(FIELD_TYPES.map((type) => [type.value, type.label]));

/** The answer key the API stores this field under. Must match `/^[a-z][a-z0-9_]*$/`. */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Turns a human field label into a storage key: lowercase, every run of
 * non-alphanumerics becomes one underscore, and leading digits are dropped
 * because a key has to start with a letter.
 */
export function deriveFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[0-9_]+/, "")
    .replace(/_+$/, "")
    .slice(0, 80);
}

/** First problem with the draft keys, phrased for the organizer, or null when they are fine. */
export function fieldKeyError(fields: readonly { label: string; key: string }[]): string | null {
  const seen = new Set<string>();
  for (const [index, field] of fields.entries()) {
    const name = field.label.trim() ? `“${field.label.trim()}”` : `field ${index + 1}`;
    if (!field.key.trim()) {
      return `Give ${name} an answer key — letters, numbers, and underscores, starting with a letter.`;
    }
    if (!KEY_PATTERN.test(field.key.trim())) {
      return `The key “${field.key.trim()}” on ${name} must start with a lowercase letter and use only lowercase letters, numbers, and underscores.`;
    }
    if (seen.has(field.key.trim())) {
      return `Two fields share the key “${field.key.trim()}”. Every key must be unique within a form — rename the one on ${name}.`;
    }
    seen.add(field.key.trim());
  }
  return null;
}

/** Splits the comma-separated choice-list input into trimmed, non-empty options. */
export function parseOptionList(raw: string): string[] {
  return raw
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

/** Renders one stored answer for the organizer's response table. */
export function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => formatAnswerValue(item)).join(", ");
  return String(value);
}

interface FieldDraft {
  label: string;
  key: string;
  /** Once the organizer edits the key by hand, the label stops overwriting it. */
  keyEdited: boolean;
  fieldType: PortalFormFieldType;
  required: boolean;
  helpText: string;
  options: string;
}

function blankField(): FieldDraft {
  return { label: "", key: "", keyEdited: false, fieldType: "text", required: false, helpText: "", options: "" };
}

export function PortalForms() {
  const { eventSlug } = useAdminContext();
  const forms = useAsync(() => apiClient.portalForms(eventSlug), [eventSlug]);
  const speakers = useAsync(() => apiClient.organizerSpeakers(eventSlug), [eventSlug]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<FieldDraft[]>([blankField()]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (forms.loading) return <Spinner label="Loading portal forms" />;
  if (forms.error) return <ErrorBanner message={forms.error.message} />;

  const roster = speakers.data?.speakers ?? [];
  const timezone = speakers.data?.event.timezone;

  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((current) => current.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function resetBuilder() {
    setTitle("");
    setInstructions("");
    setDueAt("");
    setSelectedIds(new Set());
    setFields([blankField()]);
  }

  async function createForm(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    if (selectedIds.size === 0) {
      setActionError("Choose at least one speaker to assign this form to.");
      return;
    }
    if (fields.length === 0) {
      setActionError("Add at least one field before assigning the form.");
      return;
    }
    const keyProblem = fieldKeyError(fields);
    if (keyProblem) {
      setActionError(keyProblem);
      return;
    }
    const body: CreatePortalFormRequest = {
      title: title.trim(),
      instructions: instructions.trim() || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      speakerIds: [...selectedIds],
      fields: fields.map((field) => ({
        label: field.label.trim(),
        key: field.key.trim(),
        fieldType: field.fieldType,
        required: field.required,
        helpText: field.helpText.trim() || null,
        options: field.fieldType === "select" ? parseOptionList(field.options) : null,
      })),
    };
    setBusy(true);
    try {
      const result = await apiClient.createPortalForm(eventSlug, body);
      setNotice(
        `“${body.title}” assigned to ${result.assigned} speaker${result.assigned === 1 ? "" : "s"}. It shows up as a task in their portal.`,
      );
      resetBuilder();
      setBuilderOpen(false);
      forms.reload();
    } catch (caught) {
      setActionError(caught instanceof ApiRequestError ? caught.message : "The form could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Portal forms"
        subtitle="Build a form — hotel stay, flight reimbursement, dietary needs — and assign it as a task speakers fill out from their own portal."
        actions={
          <Button type="button" onClick={() => setBuilderOpen((open) => !open)} aria-expanded={builderOpen}>
            {builderOpen ? "Cancel" : "New form"}
          </Button>
        }
      />

      {notice ? (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      ) : null}
      {actionError ? <div className="mb-4"><ErrorBanner message={actionError} /></div> : null}

      {builderOpen ? (
        <Card className="mb-6 p-5">
          <h2 className="text-base font-semibold text-zinc-900">New portal form</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Every selected speaker gets one task. Answers come back here as soon as they submit.
          </p>
          <form onSubmit={createForm} className="mt-5 space-y-5 border-t border-zinc-100 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Form title" htmlFor="portal-form-title" required>
                <Input
                  id="portal-form-title"
                  value={title}
                  required
                  minLength={2}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Hotel stay details"
                />
              </Field>
              <Field label="Due date and time" htmlFor="portal-form-due">
                <Input
                  id="portal-form-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Instructions" htmlFor="portal-form-instructions" help="Shown above the form in the speaker portal.">
                  <Textarea
                    id="portal-form-instructions"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    placeholder="We cover two nights at the conference hotel. Tell us the nights you need and any access requirements."
                  />
                </Field>
              </div>
            </div>

            <fieldset className="rounded-lg border border-zinc-200 p-4">
              <legend className="px-1 text-sm font-medium text-zinc-800">Assign to speakers</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500" aria-live="polite">
                  {selectedIds.size} of {roster.length} speakers selected
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => setSelectedIds(new Set(roster.map((speaker) => speaker.id)))}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              {speakers.loading ? (
                <div className="mt-3"><Spinner label="Loading speakers" /></div>
              ) : roster.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No speakers on this event yet.</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {roster.map((speaker) => (
                    <div key={speaker.id} className="flex items-center gap-2">
                      <input
                        id={`portal-form-speaker-${speaker.id}`}
                        type="checkbox"
                        className="size-4 rounded border-zinc-300"
                        checked={selectedIds.has(speaker.id)}
                        onChange={(event) =>
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(speaker.id);
                            else next.delete(speaker.id);
                            return next;
                          })
                        }
                      />
                      <label htmlFor={`portal-form-speaker-${speaker.id}`} className="min-w-0 text-sm text-zinc-700">
                        <span className="block truncate font-medium text-zinc-900">{speaker.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{speaker.email}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Fields</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    The key is what the answer is stored under; it fills itself in from the label and stays editable.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setFields((current) => [...current, blankField()])}>
                  Add field
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={index} className="rounded-lg border border-zinc-200 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Field label" htmlFor={`portal-form-field-label-${index}`} required>
                      <Input
                        id={`portal-form-field-label-${index}`}
                        value={field.label}
                        required
                        minLength={2}
                        placeholder="Nights required"
                        onChange={(event) => {
                          const label = event.target.value;
                          updateField(index, field.keyEdited ? { label } : { label, key: deriveFieldKey(label) });
                        }}
                      />
                    </Field>
                    <Field label="Field key" htmlFor={`portal-form-field-key-${index}`} required>
                      <Input
                        id={`portal-form-field-key-${index}`}
                        value={field.key}
                        required
                        onChange={(event) => updateField(index, { key: event.target.value, keyEdited: true })}
                      />
                    </Field>
                    <Field label="Field type" htmlFor={`portal-form-field-type-${index}`} required>
                      <Select
                        id={`portal-form-field-type-${index}`}
                        value={field.fieldType}
                        onChange={(event) => updateField(index, { fieldType: event.target.value as PortalFormFieldType })}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Help text" htmlFor={`portal-form-field-help-${index}`}>
                      <Input
                        id={`portal-form-field-help-${index}`}
                        value={field.helpText}
                        onChange={(event) => updateField(index, { helpText: event.target.value })}
                        placeholder="Shown under the input in the portal"
                      />
                    </Field>
                    {field.fieldType === "select" ? (
                      <div className="sm:col-span-2">
                        <Field
                          label="Options"
                          htmlFor={`portal-form-field-options-${index}`}
                          help="Separate each choice with a comma."
                        >
                          <Input
                            id={`portal-form-field-options-${index}`}
                            value={field.options}
                            onChange={(event) => updateField(index, { options: event.target.value })}
                            placeholder="One night, Two nights, Three nights"
                          />
                        </Field>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <input
                        id={`portal-form-field-required-${index}`}
                        type="checkbox"
                        className="size-4 rounded border-zinc-300"
                        checked={field.required}
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                      />
                      <label htmlFor={`portal-form-field-required-${index}`} className="text-sm text-zinc-700">
                        Required
                      </label>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        aria-label={`Remove field ${index + 1}${field.label.trim() ? `: ${field.label.trim()}` : ""}`}
                        disabled={fields.length === 1}
                        onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove field
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit" disabled={busy}>
              {busy ? "Assigning…" : `Assign form to ${selectedIds.size} speaker${selectedIds.size === 1 ? "" : "s"}`}
            </Button>
          </form>
        </Card>
      ) : null}

      {(forms.data?.forms.length ?? 0) === 0 ? (
        <EmptyState
          title="No portal forms yet"
          body="Build a hotel-stay or reimbursement form and it lands in every selected speaker's task list."
          action={<Button type="button" onClick={() => setBuilderOpen(true)}>New form</Button>}
        />
      ) : (
        <div className="space-y-4">
          {(forms.data?.forms ?? []).map((form) => (
            <PortalFormCard
              key={form.formId}
              form={form}
              timezone={timezone}
              expanded={expanded.has(form.formId)}
              onToggleResponses={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(form.formId)) next.delete(form.formId);
                  else next.add(form.formId);
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PortalFormCard({
  form,
  timezone,
  expanded,
  onToggleResponses,
}: {
  form: PortalForm;
  timezone: string | undefined;
  expanded: boolean;
  onToggleResponses: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{form.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {form.dueAt ? `Due ${formatDateTime(form.dueAt, timezone)}` : "No due date"} · {form.fields.length} field
            {form.fields.length === 1 ? "" : "s"}
          </p>
          {form.instructions ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">{form.instructions}</p>
          ) : null}
        </div>
        <Badge tone={form.completed === form.assigned ? "emerald" : "amber"}>
          {form.completed} of {form.assigned} complete
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {form.fields.map((field) => (
          <span
            key={field.id}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600"
          >
            {field.label}
            <span className="ml-1 text-zinc-400">{FIELD_TYPE_LABEL.get(field.fieldType) ?? field.fieldType}</span>
            {field.required ? <span className="ml-1 font-medium text-rose-600">required</span> : null}
          </span>
        ))}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <Button
          type="button"
          variant="secondary"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} responses: ${form.title}`}
          onClick={onToggleResponses}
        >
          {expanded ? "Hide responses" : `Responses (${form.responses.length})`}
        </Button>
        {expanded ? (
          form.responses.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
              No speaker has submitted this form yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {form.responses.map((response) => (
                <div key={response.speakerId} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900">{response.speakerName}</p>
                    <p className="text-xs text-zinc-500">
                      Submitted {formatDateTime(response.submittedAt, timezone)}
                    </p>
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {form.fields.map((field) => (
                      <div key={field.id}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{field.label}</dt>
                        <dd className="mt-0.5 text-sm text-zinc-800">{formatAnswerValue(response.answers[field.key])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </Card>
  );
}
