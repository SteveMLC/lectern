import { useState } from "react";
import type { ResourcePage, SaveResourcePageRequest } from "../../../shared/contracts";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, PageHeader, Spinner, Textarea } from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

const EMPTY_RESOURCE: SaveResourcePageRequest = {
  slug: "",
  title: "",
  bodyMd: "",
  embedHtml: null,
  isPublished: false,
};

function editValue(resource: ResourcePage): SaveResourcePageRequest {
  return {
    slug: resource.slug,
    title: resource.title,
    bodyMd: resource.bodyMd,
    embedHtml: resource.embedHtml,
    isPublished: resource.isPublished,
  };
}

export function Resources() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading, reload } = useAsync(() => apiClient.resourcePages(eventSlug), [eventSlug]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SaveResourcePageRequest>(EMPTY_RESOURCE);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_RESOURCE);
    setNotice(null);
    setFormError(null);
  }

  function startEdit(resource: ResourcePage) {
    setEditingId(resource.id);
    setForm(editValue(resource));
    setNotice(null);
    setFormError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingId === "new") await apiClient.createResourcePage(eventSlug, form);
      else if (editingId) await apiClient.updateResourcePage(eventSlug, editingId, form);
      setNotice(`${form.title} ${form.isPublished ? "is published in speaker portals" : "was saved as a draft"}.`);
      setEditingId(null);
      setForm(EMPTY_RESOURCE);
      reload();
    } catch (caught) {
      setFormError(caught instanceof ApiRequestError ? caught.message : "The resource could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal resources"
        subtitle="Publish speaker guides, support notes, and sanitized HTML embeds inside every speaker portal."
        actions={<Button onClick={startNew}>New resource</Button>}
      />

      <Card className="border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm font-semibold text-indigo-950">Non-negotiable path · Speaker self-service</p>
        <p className="mt-1 text-sm leading-6 text-indigo-800">Anything published here appears under Resources in the speaker portal. Embed HTML is sanitized before it renders.</p>
      </Card>

      {notice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div> : null}
      {editingId ? (
        <Card className="p-5">
          <h2 className="font-semibold text-zinc-900">{editingId === "new" ? "New portal resource" : "Edit portal resource"}</h2>
          {formError ? <div className="mt-3"><ErrorBanner message={formError} /></div> : null}
          <form className="mt-4 grid gap-4" onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required><Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
              <Field label="URL slug" required help="Lowercase words separated by hyphens."><Input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} /></Field>
            </div>
            <Field label="Guide content" required help="Simple Markdown headings, paragraphs, and bullet lists render in the portal.">
              <Textarea required rows={10} value={form.bodyMd} onChange={(event) => setForm({ ...form, bodyMd: event.target.value })} />
            </Field>
            <Field label="Optional HTML embed" help="Use for a schedule, video, or support widget. Scripts and unsafe attributes are stripped in the portal.">
              <Textarea rows={4} value={form.embedHtml ?? ""} onChange={(event) => setForm({ ...form, embedHtml: event.target.value.trim() ? event.target.value : null })} placeholder={'<iframe src="https://…" title="…"></iframe>'} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" className="size-4 rounded border-zinc-300 text-accent focus:ring-accent" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
              Publish in speaker portals
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save resource"}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? <Spinner label="Loading portal resources" /> : error ? <ErrorBanner message={error.message} /> : !data || data.resources.length === 0 ? (
        <EmptyState title="No portal resources" body="Create a speaker guide or support page, then publish it when it is ready." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.resources.map((resource) => (
            <Card key={resource.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-900">{resource.title}</h2>
                  <p className="mt-1 text-xs text-zinc-500">/{resource.slug}</p>
                </div>
                <Badge tone={resource.isPublished ? "emerald" : "amber"}>{resource.isPublished ? "Published" : "Draft"}</Badge>
              </div>
              <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6 text-zinc-600">{resource.bodyMd}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                <span className="text-xs text-zinc-500">{resource.embedHtml ? "HTML embed included" : "Guide content only"}</span>
                <Button type="button" variant="secondary" onClick={() => startEdit(resource)}>Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
