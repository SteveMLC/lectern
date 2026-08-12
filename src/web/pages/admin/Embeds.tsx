import { useMemo, useState } from "react";
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, Select, Spinner, Textarea } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

type WidgetType = "schedule" | "sessions" | "speakers" | "itinerary" | "gallery";
type OutputFormat = "styled_html" | "basic_html" | "json" | "xml" | "ical";

interface SavedEmbed {
  id: string;
  name: string;
  widget: WidgetType;
  format: OutputFormat;
  color: string;
  track: string;
  showDescription: boolean;
  showCompany: boolean;
  enabled: boolean;
  createdAt: string;
}

const WIDGETS: Array<{ value: WidgetType; label: string }> = [
  { value: "schedule", label: "Agenda" },
  { value: "sessions", label: "Sessions list" },
  { value: "speakers", label: "Speakers list" },
  { value: "itinerary", label: "Schedule itinerary" },
  { value: "gallery", label: "Speaker gallery" },
];

const FORMATS: Array<{ value: OutputFormat; label: string }> = [
  { value: "styled_html", label: "Styled HTML iframe" },
  { value: "basic_html", label: "Basic HTML iframe" },
  { value: "json", label: "JSON feed" },
  { value: "xml", label: "XML feed" },
  { value: "ical", label: "iCal feed" },
];

function storageKey(slug: string) { return `lectern.embeds.${slug}`; }

function readSaved(slug: string): SavedEmbed[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(slug)) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveAll(slug: string, records: SavedEmbed[]) {
  localStorage.setItem(storageKey(slug), JSON.stringify(records));
}

export function embedCode(origin: string, slug: string, embed: Omit<SavedEmbed, "id" | "enabled" | "createdAt">): string {
  const params = new URLSearchParams();
  params.set("color", embed.color);
  if (embed.track) params.set("track", embed.track);
  params.set("description", embed.showDescription ? "1" : "0");
  params.set("company", embed.showCompany ? "1" : "0");
  const query = params.toString();
  const widget = embed.widget;
  if (embed.format === "json") {
    const resource = widget === "speakers" || widget === "gallery" ? "speakers" : widget === "sessions" ? "sessions" : "schedule";
    return `${origin}/api/public/events/${encodeURIComponent(slug)}/${resource}?${query}`;
  }
  if (embed.format === "xml") return `${origin}/api/public/events/${encodeURIComponent(slug)}/${widget}.xml?${query}`;
  if (embed.format === "ical") return `${origin}/api/public/events/${encodeURIComponent(slug)}/agenda.ics?${query}`;
  const src = `${origin}/api/embeds/events/${encodeURIComponent(slug)}/${widget}?${query}`;
  const style = embed.format === "styled_html" ? ` style="border:1px solid ${embed.color};border-radius:12px"` : "";
  return `<iframe src="${src}" title="${embed.name.replace(/"/g, "&quot;")}" width="100%" height="640" loading="lazy"${style}></iframe>`;
}

export function Embeds() {
  const { eventSlug, eventName } = useAdminContext();
  const { data, error, loading } = useAsync(() => apiClient.eventBundle(eventSlug), [eventSlug]);
  const [name, setName] = useState(`${eventName} agenda`);
  const [widget, setWidget] = useState<WidgetType>("schedule");
  const [format, setFormat] = useState<OutputFormat>("styled_html");
  const [color, setColor] = useState("#4338ca");
  const [track, setTrack] = useState("");
  const [showDescription, setShowDescription] = useState(true);
  const [showCompany, setShowCompany] = useState(true);
  const [saved, setSaved] = useState<SavedEmbed[]>(() => readSaved(eventSlug));
  const [notice, setNotice] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const draft = useMemo(() => ({ name, widget, format, color, track, showDescription, showCompany }), [name, widget, format, color, track, showDescription, showCompany]);
  const code = embedCode(origin, eventSlug, draft);

  if (loading) return <Spinner label="Loading embed builder" />;
  if (error || !data) return <ErrorBanner message={error?.message ?? "Embed builder unavailable."} />;

  function persist(next: SavedEmbed[]) { setSaved(next); saveAll(eventSlug, next); }
  function addEmbed() {
    const record: SavedEmbed = { ...draft, id: crypto.randomUUID(), enabled: true, createdAt: new Date().toISOString() };
    persist([record, ...saved]);
    setNotice(`${record.name} saved. Its code remains retrievable after reload.`);
  }
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setNotice("Embed code copied to the clipboard.");
  }

  return <div>
    <PageHeader title="Embeds" subtitle="Configure, save, preview, and retrieve distributable widgets and feeds." />
    {notice ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-zinc-900">New embed</h2>
        <p className="mt-1 text-sm text-zinc-500">Five widget types, HTML and data feeds, brand color, content filter, and field controls.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Embed name" htmlFor="embed-name"><Input id="embed-name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Widget type" htmlFor="embed-widget"><Select id="embed-widget" value={widget} onChange={(event) => setWidget(event.target.value as WidgetType)}>{WIDGETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Output format" htmlFor="embed-format"><Select id="embed-format" value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}>{FORMATS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Brand color" htmlFor="embed-color"><Input id="embed-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></Field>
          <Field label="Track filter" htmlFor="embed-track"><Select id="embed-track" value={track} onChange={(event) => setTrack(event.target.value)}><option value="">All tracks</option>{data.tracks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <fieldset className="space-y-2"><legend className="text-sm font-medium text-zinc-800">Visible fields</legend><label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={showDescription} onChange={(event) => setShowDescription(event.target.checked)} /> Description / bio</label><label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={showCompany} onChange={(event) => setShowCompany(event.target.checked)} /> Company metadata</label></fieldset>
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><Button onClick={addEmbed} disabled={!name.trim()}>Save embed</Button><Button variant="secondary" onClick={() => copy(code)}>Copy current code</Button></div>
        <Field label="Generated code or feed URL" htmlFor="embed-code" help="This exact value is retained with every saved embed."><Textarea id="embed-code" className="mt-4 min-h-32 font-mono text-xs" readOnly value={code} /></Field>
      </Card>
      <Card className="overflow-hidden p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-zinc-900">Live preview</h2><p className="mt-1 text-sm text-zinc-500">HTML formats render here; feeds show their exact URL above.</p></div><Badge tone="emerald">Non-admin view</Badge></div>
        {format === "styled_html" || format === "basic_html" ? <iframe className="mt-4 h-[520px] w-full rounded-lg border border-zinc-200" title="Embed preview" src={`${origin}/api/embeds/events/${encodeURIComponent(eventSlug)}/${widget}?color=${encodeURIComponent(color)}&track=${encodeURIComponent(track)}&description=${showDescription ? "1" : "0"}&company=${showCompany ? "1" : "0"}`} /> : <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">Select either HTML format for a rendered preview. JSON, XML, and iCal are direct feed URLs.</div>}
      </Card>
    </div>
    <section className="mt-6"><h2 className="text-base font-semibold text-zinc-900">Saved embeds</h2>{saved.length === 0 ? <Card className="mt-3 p-6 text-sm text-zinc-500">No saved embeds yet.</Card> : <div className="mt-3 grid gap-3">{saved.map((record) => { const savedCode = embedCode(origin, eventSlug, record); return <Card key={record.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-zinc-900">{record.name}</p><Badge tone={record.enabled ? "emerald" : "zinc"}>{record.enabled ? "Enabled" : "Disabled"}</Badge></div><p className="mt-1 text-xs text-zinc-500">{WIDGETS.find((item) => item.value === record.widget)?.label} · {FORMATS.find((item) => item.value === record.format)?.label}{record.track ? ` · ${data.tracks.find((item) => item.id === record.track)?.name ?? record.track}` : " · all tracks"}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => copy(savedCode)}>Get code</Button><Button variant="ghost" onClick={() => persist(saved.map((item) => item.id === record.id ? { ...item, enabled: !item.enabled } : item))}>{record.enabled ? "Disable" : "Enable"}</Button><Button variant="ghost" onClick={() => persist(saved.filter((item) => item.id !== record.id))}>Delete</Button></div></div><pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100"><code>{savedCode}</code></pre></Card>; })}</div>}</section>
  </div>;
}
