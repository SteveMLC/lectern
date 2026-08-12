-- Optional password-based submitter accounts for the CFP journey.
-- Session tokens are stored only as SHA-256 digests; passwords use PBKDF2
-- with a per-account salt. Existing capability links remain valid.

CREATE TABLE submitter_accounts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  speaker_id TEXT REFERENCES speakers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, email)
);

CREATE INDEX idx_submitter_accounts_speaker
  ON submitter_accounts(event_id, speaker_id);

CREATE TABLE submitter_sessions (
  token_sha256 TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES submitter_accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_submitter_sessions_account
  ON submitter_sessions(account_id, expires_at);
