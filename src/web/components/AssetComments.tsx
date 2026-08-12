import { useState } from "react";
import type { AssetComment } from "../../shared/contracts";
import { ApiRequestError } from "../lib/api";
import { formatDateTime } from "../lib/status";
import { Button, ErrorBanner, Textarea } from "./ui";

export function AssetComments({
  filename,
  comments,
  timezone,
  onSubmit,
}: {
  filename: string;
  comments: AssetComment[];
  timezone: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(comments.length > 0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try { await onSubmit(body.trim()); setBody(""); setOpen(true); }
    catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : "Comment could not be posted."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2 border-t border-zinc-100 pt-2">
      <button type="button" className="text-xs font-medium text-accent hover:underline" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide" : "Show"} comments ({comments.length})
      </button>
      {open ? <div className="mt-2" aria-label={`Comments on ${filename}`}>
        {comments.length === 0 ? <p className="text-xs text-zinc-500">No comments yet. Start the review thread here.</p> : (
          <div className="space-y-2">{comments.map((comment) => <div key={comment.id} className="rounded-md bg-zinc-50 p-2 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-zinc-800">{comment.authorName} · {comment.authorRole}</span><time className="text-zinc-400">{formatDateTime(comment.createdAt, timezone)}</time></div><p className="mt-1 whitespace-pre-wrap leading-5 text-zinc-700">{comment.body}</p></div>)}</div>
        )}
        <form onSubmit={submit} className="mt-2 space-y-2">
          <Textarea aria-label={`Add comment to ${filename}`} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add feedback or a question…" className="min-h-20 text-xs" />
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post comment"}</Button>
        </form>
      </div> : null}
    </div>
  );
}
