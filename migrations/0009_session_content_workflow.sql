-- Durable content approval and reversible editorial history for program sessions.
-- Existing sessions stay visible: the additive column defaults to approved.

ALTER TABLE sessions ADD COLUMN content_approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (content_approval_status IN ('needs_review', 'approved'));

CREATE TABLE session_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  editor TEXT NOT NULL DEFAULT 'Organizer',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_session_versions_session_created
  ON session_versions(session_id, created_at DESC);
