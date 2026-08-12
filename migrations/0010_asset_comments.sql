-- Cross-role comment threads on uploaded speaker files.

CREATE TABLE asset_comments (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES speaker_assets(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('speaker', 'organizer')),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_asset_comments_asset_created ON asset_comments(asset_id, created_at, id);
