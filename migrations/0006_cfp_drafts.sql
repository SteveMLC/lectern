-- Capability-link CFP drafts: no submitter account required, but a proposer
-- can save partial work and return from any browser with the unguessable URL.
CREATE TABLE cfp_drafts (
  token TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_cfp_drafts_event ON cfp_drafts(event_id, updated_at);
