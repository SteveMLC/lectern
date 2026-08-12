import { useMemo, useState } from "react";
import type {
  EvaluationRoundView,
  EvaluationWorkspaceResponse,
  RoundReviewer,
  SaveEvaluationRoundRequest,
} from "../../../shared/contracts";
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, Select, Spinner } from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

function localValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function Evaluations() {
  const { eventSlug } = useAdminContext();
  const { data: loaded, error, loading, reload } = useAsync(() => apiClient.evaluationWorkspace(eventSlug), [eventSlug]);
  const [override, setOverride] = useState<EvaluationWorkspaceResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const data = override ?? loaded;

  if (loading) return <Spinner label="Loading evaluation rounds" />;
  if (error || !data) return <ErrorBanner message={error?.message ?? "Evaluation workspace unavailable."} />;

  return (
    <div>
      <PageHeader
        title="Evaluation rounds"
        subtitle="Round-scoped scorecards, reviewer pools, assignments, progress, and weighted results."
        actions={<div className="flex gap-2">
          <a className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700" href={`/api/events/${encodeURIComponent(eventSlug)}/evaluations.csv`}>Export review CSV</a>
          <Button variant="secondary" onClick={() => { setOverride(null); reload(); }}>Refresh</Button>
          <Button onClick={() => setCreating(true)}>Add round</Button>
        </div>}
      />
      {notice ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
      {creating ? (
        <RoundEditor
          eventSlug={eventSlug}
          round={null}
          nextNumber={data.rounds.length + 1}
          onCancel={() => setCreating(false)}
          onSaved={(workspace) => { setOverride(workspace); setCreating(false); setNotice("Review round created."); }}
        />
      ) : null}
      <div className="space-y-5">
        {data.rounds.map((round) => (
          <RoundCard key={round.id} eventSlug={eventSlug} round={round} workspace={data} onUpdated={setOverride} onNotice={setNotice} />
        ))}
      </div>
      <ResultsTable workspace={data} />
    </div>
  );
}

function RoundCard({ eventSlug, round, workspace, onUpdated, onNotice }: {
  eventSlug: string;
  round: EvaluationRoundView;
  workspace: EvaluationWorkspaceResponse;
  onUpdated: (workspace: EvaluationWorkspaceResponse) => void;
  onNotice: (notice: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function autoDistribute() {
    setBusy(true); setError(null);
    try {
      onUpdated(await apiClient.autoDistributeAssignments(eventSlug, round.id));
      onNotice("Unassigned proposals distributed round-robin within reviewer caps.");
    } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Auto-distribution failed."); }
    finally { setBusy(false); }
  }

  if (editing) return <RoundEditor eventSlug={eventSlug} round={round} nextNumber={round.roundNumber} onCancel={() => setEditing(false)} onSaved={(next) => { onUpdated(next); setEditing(false); onNotice("Round and scorecard saved."); }} />;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-zinc-900">{round.roundNumber}. {round.name}</h2><Badge tone={round.status === "open" ? "emerald" : round.status === "closed" ? "zinc" : "amber"}>{round.status}</Badge>{round.blindMode ? <Badge tone="violet">Blind</Badge> : null}</div>
          <p className="mt-1 text-sm text-zinc-500">{round.opensAt ? new Date(round.opensAt).toLocaleDateString() : "No open date"} – {round.closesAt ? new Date(round.closesAt).toLocaleDateString() : "No close date"}</p>
        </div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => setEditing(true)}>Edit round</Button><Button variant="secondary" disabled={busy || round.reviewers.length === 0} onClick={() => void autoDistribute()}>{busy ? "Distributing…" : "Auto-distribute"}</Button></div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Scorecard</h3>
          <div className="mt-3 space-y-2">{round.criteria.map((criterion) => <div key={criterion.id} className="flex justify-between text-sm"><span>{criterion.label} · 1–{criterion.maxScore}</span><span className="font-medium text-zinc-500">weight {criterion.weight}</span></div>)}</div>
          <div className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600"><p>Recommendation · dropdown (Accept / Maybe / Reject)</p><p className="mt-1">Comments · free text</p></div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Reviewer pool & progress</h3><Button variant="secondary" onClick={() => setAddingReviewer((value) => !value)}>{addingReviewer ? "Cancel" : "Add reviewer"}</Button></div>
          {addingReviewer ? <ReviewerForm eventSlug={eventSlug} roundId={round.id} onSaved={(next) => { onUpdated(next); setAddingReviewer(false); onNotice("Reviewer added to this round only."); }} /> : null}
          <div className="mt-3 space-y-3">{round.reviewers.length === 0 ? <p className="text-sm text-zinc-500">No reviewers in this round.</p> : round.reviewers.map((reviewer) => <ReviewerRow key={reviewer.email} eventSlug={eventSlug} round={round} reviewer={reviewer} submissions={workspace.submissions} onUpdated={onUpdated} onNotice={onNotice} />)}</div>
        </div>
      </div>
      {error ? <div className="mt-3"><ErrorBanner message={error} /></div> : null}
    </Card>
  );
}

function RoundEditor({ eventSlug, round, nextNumber, onCancel, onSaved }: {
  eventSlug: string; round: EvaluationRoundView | null; nextNumber: number;
  onCancel: () => void; onSaved: (workspace: EvaluationWorkspaceResponse) => void;
}) {
  const [name, setName] = useState(round?.name ?? "Initial Review");
  const [number, setNumber] = useState(round?.roundNumber ?? nextNumber);
  const [status, setStatus] = useState<"pending" | "open" | "closed">(round?.status ?? "open");
  const [opensAt, setOpensAt] = useState(localValue(round?.opensAt ?? null));
  const [closesAt, setClosesAt] = useState(localValue(round?.closesAt ?? null));
  const [blindMode, setBlindMode] = useState(round?.blindMode ?? false);
  const [criteria, setCriteria] = useState((round?.criteria.length ? round.criteria : [{ id: "", key: "originality", label: "Originality", maxScore: 5, weight: 2 }, { id: "", key: "relevance", label: "Relevance", maxScore: 5, weight: 1 }]).map((item) => ({ id: item.id || undefined, key: item.key, label: item.label, maxScore: item.maxScore, weight: item.weight })));
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    const body: SaveEvaluationRoundRequest = { name, roundNumber: number, status, opensAt: toIso(opensAt), closesAt: toIso(closesAt), blindMode, criteria };
    try { onSaved(await apiClient.saveEvaluationRound(eventSlug, round?.id ?? null, body)); }
    catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Round could not be saved."); }
    finally { setSaving(false); }
  }
  return <Card className="mb-5 border-indigo-200 p-5"><form onSubmit={save} className="space-y-4"><div className="flex justify-between"><h2 className="text-base font-semibold">{round ? "Edit review round" : "Create review round"}</h2><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div><div className="grid gap-3 sm:grid-cols-3"><Field label="Round name" required><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="Round number" required><Input type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} /></Field><Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="pending">Pending</option><option value="open">Open</option><option value="closed">Closed</option></Select></Field><Field label="Opens"><Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></Field><Field label="Closes"><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></Field><label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={blindMode} onChange={(e) => setBlindMode(e.target.checked)} /> Hide speaker identity from reviewers</label></div><div><div className="flex justify-between"><h3 className="text-sm font-semibold">Numeric criteria</h3><Button type="button" variant="secondary" onClick={() => setCriteria((items) => [...items, { id: undefined, key: `criterion_${items.length + 1}`, label: "New criterion", maxScore: 5, weight: 1 }])}>Add criterion</Button></div><div className="mt-2 space-y-2">{criteria.map((criterion, index) => <div key={`${criterion.key}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"><Input aria-label={`Criterion ${index + 1} label`} value={criterion.label} onChange={(e) => setCriteria((items) => items.map((item, i) => i === index ? { ...item, label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") } : item))} /><Input aria-label={`${criterion.label} maximum`} type="number" min={2} value={criterion.maxScore} onChange={(e) => setCriteria((items) => items.map((item, i) => i === index ? { ...item, maxScore: Number(e.target.value) } : item))} /><Input aria-label={`${criterion.label} weight`} type="number" min={0.1} step={0.1} value={criterion.weight} onChange={(e) => setCriteria((items) => items.map((item, i) => i === index ? { ...item, weight: Number(e.target.value) } : item))} /><Button type="button" variant="ghost" disabled={criteria.length === 1} onClick={() => setCriteria((items) => items.filter((_, i) => i !== index))}>Remove</Button></div>)}</div><p className="mt-2 text-xs text-zinc-500">Every scorecard also includes a Recommendation dropdown and Comments text area.</p></div>{error ? <ErrorBanner message={error} /> : null}<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save round and scorecard"}</Button></form></Card>;
}

function ReviewerForm({ eventSlug, roundId, onSaved }: { eventSlug: string; roundId: string; onSaved: (workspace: EvaluationWorkspaceResponse) => void }) {
  const [name, setName] = useState("Sam Whitfield"); const [email, setEmail] = useState("sam.reviewer@sbek-test.example.com"); const [cap, setCap] = useState(5); const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) { e.preventDefault(); setError(null); try { onSaved(await apiClient.saveRoundReviewer(eventSlug, roundId, { name, email, assignmentCap: cap })); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Reviewer could not be added."); } }
  return <form onSubmit={save} className="mt-3 grid gap-2 border-t border-zinc-100 pt-3"><Input aria-label="Reviewer name" value={name} onChange={(e) => setName(e.target.value)} /><Input aria-label="Reviewer email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><Field label="Assignment cap"><Input type="number" min={1} value={cap} onChange={(e) => setCap(Number(e.target.value))} /></Field>{error ? <ErrorBanner message={error} /> : null}<Button type="submit">Add to round</Button></form>;
}

function ReviewerRow({ eventSlug, round, reviewer, submissions, onUpdated, onNotice }: { eventSlug: string; round: EvaluationRoundView; reviewer: RoundReviewer; submissions: EvaluationWorkspaceResponse["submissions"]; onUpdated: (workspace: EvaluationWorkspaceResponse) => void; onNotice: (notice: string) => void }) {
  const [selected, setSelected] = useState(reviewer.submissionIds); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function saveAssignments() { setBusy(true); setError(null); try { onUpdated(await apiClient.saveAssignments(eventSlug, round.id, { reviewerEmail: reviewer.email, submissionIds: selected })); setOpen(false); onNotice(`Assignments saved for ${reviewer.name}.`); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Assignments could not be saved."); } finally { setBusy(false); } }
  async function nudge() { setBusy(true); setError(null); try { const result = await apiClient.nudgeReviewer(eventSlug, round.id, reviewer.email); onNotice(`Reminder recorded for ${reviewer.name} · ${result.messageId}.`); } catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Reminder could not be recorded."); } finally { setBusy(false); } }
  return <div className="rounded-lg bg-zinc-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{reviewer.name}</p><p className="text-xs text-zinc-500">{reviewer.complete}/{reviewer.assigned} complete · cap {reviewer.assignmentCap}</p></div><div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen((value) => !value)}>Assignments</Button>{reviewer.complete < reviewer.assigned ? <Button variant="secondary" disabled={busy} onClick={() => void nudge()}>Nudge</Button> : null}</div></div><a className="mt-2 block break-all text-xs font-medium text-accent hover:underline" href={`/review/${reviewer.token}`}>Reviewer portal: /review/{reviewer.token}</a>{open ? <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">{submissions.filter((s) => !["draft", "withdrawn"].includes(s.status)).map((submission) => <label key={submission.id} className="flex gap-2 text-xs"><input type="checkbox" checked={selected.includes(submission.id)} disabled={!selected.includes(submission.id) && selected.length >= reviewer.assignmentCap} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, submission.id] : ids.filter((id) => id !== submission.id))} /><span>{submission.title}</span></label>)}<Button disabled={busy} onClick={() => void saveAssignments()}>{busy ? "Saving…" : "Save assignments"}</Button></div> : null}{error ? <div className="mt-2"><ErrorBanner message={error} /></div> : null}</div>;
}

function ResultsTable({ workspace }: { workspace: EvaluationWorkspaceResponse }) {
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const rows = useMemo(() => [...workspace.results].sort((a, b) => direction === "desc" ? (b.aggregate ?? -Infinity) - (a.aggregate ?? -Infinity) : (a.aggregate ?? Infinity) - (b.aggregate ?? Infinity)), [workspace.results, direction]);
  return <Card className="mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-zinc-200 p-5"><div><h2 className="text-base font-semibold">Weighted review results</h2><p className="mt-1 text-sm text-zinc-500">Weights are applied within each scorecard, then completed reviews are averaged.</p></div><Button variant="secondary" onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")}>Score {direction === "desc" ? "high → low" : "low → high"}</Button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">Submission</th><th className="px-5 py-3">Track</th><th className="px-5 py-3">Weighted score</th><th className="px-5 py-3">Reviews</th></tr></thead><tbody className="divide-y divide-zinc-100">{rows.map((row) => <tr key={row.submissionId}><td className="px-5 py-3 font-medium">{row.title}</td><td className="px-5 py-3 text-zinc-500">{row.trackName ?? "—"}</td><td className="px-5 py-3 font-semibold">{row.aggregate === null ? "—" : row.aggregate.toFixed(2)}</td><td className="px-5 py-3 text-zinc-500">{row.completedReviews}</td></tr>)}</tbody></table></div></Card>;
}
