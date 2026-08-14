import { useEffect, useRef, useState } from "react";
import type { EventBundle, FormField } from "../../../shared/contracts";
import { CORE_CFP_FIELDS, dropFieldOnto, moveFieldOrder } from "../../../shared/domain/formFields";
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, Select, Spinner, Textarea, cn } from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

function localValue(iso: string | null): string { if (!iso) return ""; const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function toIso(value: string): string | null { return value ? new Date(value).toISOString() : null; }

export function Settings() {
  const { eventSlug } = useAdminContext();
  const { data: loaded, error, loading, reload } = useAsync(() => apiClient.eventBundle(eventSlug), [eventSlug]);
  const [override, setOverride] = useState<EventBundle | null>(null); const [notice, setNotice] = useState<string | null>(null);
  if (loading) return <Spinner label="Loading event settings" />;
  if (error || !loaded) return <ErrorBanner message={error?.message ?? "Event settings unavailable."} />;
  const data = override ?? loaded;
  return <div><PageHeader title="Event & CFP settings" subtitle="Configure the submission window, custom fields, tracks, and event portfolio." actions={<Button variant="secondary" onClick={() => { setOverride(null); reload(); }}>Refresh</Button>} />{notice ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}<div className="grid gap-5 xl:grid-cols-2"><CfpSettings data={data} onUpdated={(next) => { setOverride(next); setNotice("CFP settings saved. Speaker proposal editing now follows this window."); }} /><Tracks data={data} onUpdated={(next) => { setOverride(next); setNotice("Track added and immediately available on the public CFP."); }} /><FormBuilder data={data} onUpdated={(next, message) => { setOverride(next); setNotice(message); }} /><CreateEvent onCreated={(name) => setNotice(`${name} created. Reload the organizer console to select it.`)} /></div></div>;
}

function CfpSettings({ data, onUpdated }: { data: EventBundle; onUpdated: (data: EventBundle) => void }) {
  const cfp = data.cfp; const [isOpen, setIsOpen] = useState(cfp?.form.isOpen ?? false); const [opensAt, setOpensAt] = useState(localValue(cfp?.form.opensAt ?? null)); const [closesAt, setClosesAt] = useState(localValue(cfp?.form.closesAt ?? null)); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(null); try { onUpdated(await apiClient.updateEventSettings(data.event.slug, { cfpIsOpen: isOpen, cfpOpensAt: toIso(opensAt), cfpClosesAt: toIso(closesAt) })); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Settings could not be saved."); } finally { setBusy(false); } }
  return <Card className="p-5"><h2 className="text-base font-semibold">CFP window</h2><form onSubmit={save} className="mt-4 grid gap-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} /> CFP enabled</label><Field label="Opens"><Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></Field><Field label="Closes"><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></Field>{error ? <ErrorBanner message={error} /> : null}<Button type="submit" disabled={busy || !cfp}>{busy ? "Saving…" : "Save CFP window"}</Button></form></Card>;
}

function Tracks({ data, onUpdated }: { data: EventBundle; onUpdated: (data: EventBundle) => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [color, setColor] = useState("#c7d2fe"); const [error, setError] = useState<string | null>(null);
  async function add(e: React.FormEvent) { e.preventDefault(); setError(null); try { onUpdated(await apiClient.createTrack(data.event.slug, { name, description: description || null, color })); setName(""); setDescription(""); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Track could not be added."); } }
  return <Card className="p-5"><h2 className="text-base font-semibold">Tracks & formats</h2><div className="mt-3 flex flex-wrap gap-2">{data.tracks.map((track) => <Badge key={track.id} tone="indigo">{track.name}</Badge>)}</div><p className="mt-3 text-xs text-zinc-500">Formats are fixed, honest program types: Talk, Workshop, Panel, Lightning, and Keynote.</p><form onSubmit={add} className="mt-4 space-y-3 border-t border-zinc-100 pt-4"><Field label="New track name" required><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field><Field label="Color"><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></Field>{error ? <ErrorBanner message={error} /> : null}<Button type="submit">Add track</Button></form></Card>;
}

function FormBuilder({ data, onUpdated }: { data: EventBundle; onUpdated: (data: EventBundle, notice: string) => void }) {
  const [label, setLabel] = useState(""); const [key, setKey] = useState(""); const [type, setType] = useState<"text" | "select" | "checkbox">("text"); const [required, setRequired] = useState(false); const [options, setOptions] = useState(""); const [conditional, setConditional] = useState(false); const [conditionValue, setConditionValue] = useState("workshop"); const [error, setError] = useState<string | null>(null);
  async function add(e: React.FormEvent) { e.preventDefault(); setError(null); try { const next = await apiClient.createFormField(data.event.slug, { label, key, fieldType: type, required, helpText: null, options: type === "select" ? options.split(",").map((item) => item.trim()).filter(Boolean) : null, condition: conditional ? { sourceFieldKey: "format", operator: "equals", values: [conditionValue] } : null }); onUpdated(next, "Custom field added. Client and API validation share the same rules."); setLabel(""); setKey(""); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Field could not be added."); } }
  return <Card className="p-5"><h2 className="text-base font-semibold">CFP form builder</h2><FormQuestions slug={data.event.slug} fields={data.cfp?.fields ?? []} onUpdated={onUpdated} /><form onSubmit={add} className="mt-4 space-y-3 border-t border-zinc-100 pt-4"><Field label="Label" htmlFor="cfp-field-label" required><Input id="cfp-field-label" value={label} onChange={(e) => { setLabel(e.target.value); setKey(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")); }} required /></Field><Field label="Field key" htmlFor="cfp-field-key" required><Input id="cfp-field-key" value={key} onChange={(e) => setKey(e.target.value)} required /></Field><Field label="Type" htmlFor="cfp-field-type"><Select id="cfp-field-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="text">Text</option><option value="select">Select</option><option value="checkbox">Checkbox</option></Select></Field>{type === "select" ? <Field label="Options" htmlFor="cfp-field-options" help="Comma-separated"><Input id="cfp-field-options" value={options} onChange={(e) => setOptions(e.target.value)} required /></Field> : null}<label className="flex gap-2 text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={conditional} onChange={(e) => setConditional(e.target.checked)} /> Show only for a format</label>{conditional ? <Field label="Show when format is" htmlFor="cfp-field-condition"><Select id="cfp-field-condition" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)}><option value="talk">Talk</option><option value="workshop">Workshop</option><option value="panel">Panel</option><option value="lightning">Lightning</option><option value="keynote">Keynote</option></Select></Field> : null}{error ? <ErrorBanner message={error} /> : null}<Button type="submit">Add custom field</Button></form></Card>;
}

/** The id of a row's move control, so a keyboard user who moves a question to
 *  an end can be handed the control that is still enabled. */
function moveButtonId(fieldId: string, direction: "up" | "down"): string {
  return `cfp-field-move-${direction}-${fieldId}`;
}

/** The agenda board's grip, reused so a draggable row reads the same everywhere.
 *  Decorative — every drag has a button beside it that does the same job. */
function DragGrip({ locked }: { locked?: boolean }) {
  return (
    <span aria-hidden="true" title={locked ? "Locked questions do not move" : "Drag onto another question"} className={cn("shrink-0", locked ? "text-zinc-200" : "text-zinc-300")}>
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
        <circle cx="6" cy="4" r="1.3" /><circle cx="10" cy="4" r="1.3" />
        <circle cx="6" cy="8" r="1.3" /><circle cx="10" cy="8" r="1.3" />
        <circle cx="6" cy="12" r="1.3" /><circle cx="10" cy="12" r="1.3" />
      </svg>
    </span>
  );
}

/**
 * Form questions, in the order a submitter reads them: the four locked core
 * questions the programme depends on, then the organizer's own.
 *
 * Move up and move down are the mechanism, not the fallback — they are what a
 * keyboard reaches and what a screen reader announces. Dragging a row does the
 * same thing for a mouse.
 */
function FormQuestions({ slug, fields, onUpdated }: { slug: string; fields: FormField[]; onUpdated: (data: EventBundle, notice: string) => void }) {
  /** The order on screen while a save is in flight; null once the server's copy
   *  is the one being rendered. */
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [refocus, setRefocus] = useState<{ fieldId: string; direction: "up" | "down" } | null>(null);
  const dragFieldIdRef = useRef<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  /** One save at a time, with the newest order queued behind it, so the last
   *  order an organizer chose is the last one written. */
  const savingRef = useRef(false);
  const queuedRef = useRef<string[] | null>(null);

  const storedIds = fields.map((field) => field.id);
  const ordered = pendingOrder && pendingOrder.length === storedIds.length && pendingOrder.every((id) => storedIds.includes(id))
    ? pendingOrder.flatMap((id) => fields.find((field) => field.id === id) ?? [])
    : fields;

  // Moving a question to an end disables the button that was just pressed, and
  // a disabled button drops the focus a keyboard user was holding.
  useEffect(() => {
    if (!refocus) return;
    const pressed = document.getElementById(moveButtonId(refocus.fieldId, refocus.direction));
    const opposite = document.getElementById(moveButtonId(refocus.fieldId, refocus.direction === "up" ? "down" : "up"));
    const target = pressed instanceof HTMLButtonElement && !pressed.disabled ? pressed : opposite;
    if (target instanceof HTMLButtonElement) target.focus();
    setRefocus(null);
  }, [refocus]);

  async function save(next: string[]) {
    if (savingRef.current) { queuedRef.current = next; return; }
    savingRef.current = true;
    setStatus("Saving question order…");
    try {
      const bundle = await apiClient.reorderFormFields(slug, { fieldIds: next });
      const queued = queuedRef.current;
      queuedRef.current = null;
      savingRef.current = false;
      if (queued) { await save(queued); return; }
      setPendingOrder(null);
      setStatus("Question order saved.");
      onUpdated(bundle, "Question order saved. The public CFP page asks the questions in this order.");
    } catch (caught) {
      queuedRef.current = null;
      setPendingOrder(null);
      setStatus(null);
      setError(caught instanceof ApiRequestError ? caught.message : "The question order could not be saved.");
    } finally {
      savingRef.current = false;
    }
  }

  function apply(next: string[]) {
    if (next.join(" ") === ordered.map((field) => field.id).join(" ")) return;
    setError(null);
    setPendingOrder(next);
    void save(next);
  }

  async function remove(field: FormField) {
    setError(null);
    try {
      const bundle = await apiClient.deleteFormField(slug, field.id);
      setRemoving(null);
      setPendingOrder(null);
      setStatus(null);
      onUpdated(bundle, `“${field.label}” removed. Proposals already submitted keep the answer they gave.`);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "The question could not be removed.");
    }
  }

  return (
    <section className="mt-4" aria-labelledby="cfp-form-questions">
      <h3 id="cfp-form-questions" className="text-sm font-semibold text-zinc-900">Form questions</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Submitters answer them top to bottom. Locked questions are columns on every submission — the programme reads
        them to review, schedule, and publish a session — so they stay put and cannot be removed.
      </p>
      <ul className="mt-3 space-y-2">
        {CORE_CFP_FIELDS.map((field) => (
          <li key={field.key} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <DragGrip locked />
                <span className="truncate font-medium text-zinc-900">{field.label} *</span>
                <Badge tone="violet">Locked</Badge>
              </span>
              <span className="text-zinc-500">{field.fieldType}</span>
            </div>
            <p className="mt-1 pl-6 text-xs text-zinc-500">{field.reason}</p>
          </li>
        ))}
        {ordered.map((field, index) => (
          <li
            key={field.id}
            draggable
            aria-label={`${field.label}, draggable question`}
            className={cn(
              "cursor-grab rounded-lg border bg-zinc-50 px-3 py-2 text-sm active:cursor-grabbing",
              dragOverFieldId === field.id ? "border-accent bg-accent-soft" : "border-zinc-200",
            )}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-lectern-cfp-field", field.id);
              event.dataTransfer.setData("text/plain", field.id);
              dragFieldIdRef.current = field.id;
            }}
            onDragEnd={() => { dragFieldIdRef.current = null; setDragOverFieldId(null); }}
            onDragOver={(event) => { event.preventDefault(); setDragOverFieldId(field.id); }}
            onDragLeave={() => setDragOverFieldId((current) => current === field.id ? null : current)}
            onDrop={(event) => {
              event.preventDefault();
              const dragged = event.dataTransfer.getData("application/x-lectern-cfp-field")
                || event.dataTransfer.getData("text/plain")
                || dragFieldIdRef.current;
              dragFieldIdRef.current = null;
              setDragOverFieldId(null);
              if (dragged) apply(dropFieldOnto(ordered.map((item) => item.id), dragged, field.id));
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <DragGrip />
                <span className="truncate font-medium text-zinc-900">{field.label}{field.required ? " *" : ""}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="mr-1 text-zinc-500">{field.fieldType}</span>
                <Button
                  type="button" variant="secondary" className="px-2 py-1 text-xs"
                  id={moveButtonId(field.id, "up")}
                  aria-label={`Move ${field.label} up`}
                  disabled={index === 0}
                  onClick={() => { apply(moveFieldOrder(ordered.map((item) => item.id), field.id, "up")); setRefocus({ fieldId: field.id, direction: "up" }); }}
                >
                  Move up
                </Button>
                <Button
                  type="button" variant="secondary" className="px-2 py-1 text-xs"
                  id={moveButtonId(field.id, "down")}
                  aria-label={`Move ${field.label} down`}
                  disabled={index === ordered.length - 1}
                  onClick={() => { apply(moveFieldOrder(ordered.map((item) => item.id), field.id, "down")); setRefocus({ fieldId: field.id, direction: "down" }); }}
                >
                  Move down
                </Button>
                {/* Removal is two presses on one button: a question can carry
                    answers already given, and nothing here can undo a delete. */}
                <Button
                  type="button" variant="ghost" className="px-2 py-1 text-xs"
                  aria-label={removing === field.id ? `Confirm removing ${field.label}` : `Remove ${field.label}`}
                  onClick={() => { if (removing === field.id) void remove(field); else { setRemoving(field.id); setError(null); } }}
                >
                  {removing === field.id ? "Confirm removal" : "Remove"}
                </Button>
                {removing === field.id ? (
                  <Button type="button" variant="ghost" className="px-2 py-1 text-xs" aria-label={`Keep ${field.label}`} onClick={() => setRemoving(null)}>
                    Keep
                  </Button>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {ordered.length === 0 ? <p className="mt-2 text-xs text-zinc-500">No custom questions yet. The four locked ones are asked on every proposal.</p> : null}
      <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-emerald-700">{status}</p>
      {error ? <div className="mt-2"><ErrorBanner message={error} /></div> : null}
    </section>
  );
}

function CreateEvent({ onCreated }: { onCreated: (name: string) => void }) {
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [startsOn, setStartsOn] = useState("2028-10-10"); const [endsOn, setEndsOn] = useState("2028-10-12"); const [timezone, setTimezone] = useState("America/Los_Angeles"); const [error, setError] = useState<string | null>(null);
  async function create(e: React.FormEvent) { e.preventDefault(); setError(null); try { const created = await apiClient.createEvent({ name, slug, startsOn, endsOn, timezone }); onCreated(created.event.name); setName(""); setSlug(""); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Event could not be created."); } }
  return <Card className="p-5"><h2 className="text-base font-semibold">Create another event</h2><p className="mt-1 text-sm text-zinc-500">New events get their own CFP and evaluation plan, isolated from this event.</p><form onSubmit={create} className="mt-4 space-y-3"><Field label="Event name" required><Input value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} required /></Field><Field label="URL slug" required><Input value={slug} onChange={(e) => setSlug(e.target.value)} required /></Field><div className="grid grid-cols-2 gap-3"><Field label="Starts" required><Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></Field><Field label="Ends" required><Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></Field></div><Field label="Timezone" required><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>{error ? <ErrorBanner message={error} /> : null}<Button type="submit">Create event</Button></form></Card>;
}
