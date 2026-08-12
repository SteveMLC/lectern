import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from "../../components/ui";
import { apiClient } from "../../lib/api";
import { formatDateTime } from "../../lib/status";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

export function Files() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading } = useAsync(async () => {
    const speakers = await apiClient.publicSpeakers(eventSlug);
    return Promise.all(speakers.speakers.map((speaker) => apiClient.speakerPortal(speaker.id)));
  }, [eventSlug]);
  if (loading) return <Spinner label="Loading speaker files" />;
  if (error) return <ErrorBanner message={error.message} />;
  const portals = data ?? [];
  return <div><PageHeader title="Speaker files" subtitle="Every upload version remains available; the newest file of each kind is marked." />{portals.every((portal) => portal.assets.length === 0) ? <EmptyState title="No speaker files yet" /> : <div className="space-y-5">{portals.filter((portal) => portal.assets.length > 0).map((portal) => { const latest = new Set([...new Set(portal.assets.map((asset) => asset.kind))].map((kind) => portal.assets.find((asset) => asset.kind === kind)!.id)); return <Card key={portal.speaker.id} className="p-5"><h2 className="font-semibold">{portal.speaker.name}</h2><p className="mt-1 text-xs text-zinc-500">{portal.speaker.email}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{portal.assets.map((asset) => <a key={asset.id} href={`/api/assets/${asset.id}`} className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"><div><span className="font-medium">{asset.filename}</span>{latest.has(asset.id) ? <Badge className="ml-2" tone="emerald">Latest</Badge> : null}</div><p className="mt-1 text-xs text-zinc-500">{asset.kind} · {formatDateTime(asset.uploadedAt, portal.event.timezone)}</p></a>)}</div></Card>; })}</div>}</div>;
}
