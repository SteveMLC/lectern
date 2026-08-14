-- Human-readable submission codes.
--
-- Sessionboard shows submissions as SESS-3, SESS-4 — short enough to say on a
-- call. Ours read sub_9hjfxjzjrnpb, which no organizer will ever read aloud.
-- Each submission gains a per-event sequential code; the opaque id stays the
-- primary key, so nothing that already points at a submission has to change.

ALTER TABLE submissions ADD COLUMN reference_code TEXT;

-- Backfill in submission order so existing demo data reads naturally.
UPDATE submissions
SET reference_code = 'SUB-' || (
  SELECT COUNT(*)
  FROM submissions AS earlier
  WHERE earlier.event_id = submissions.event_id
    AND (
      earlier.created_at < submissions.created_at
      OR (earlier.created_at = submissions.created_at AND earlier.id <= submissions.id)
    )
);

CREATE UNIQUE INDEX idx_submissions_reference ON submissions(event_id, reference_code);
