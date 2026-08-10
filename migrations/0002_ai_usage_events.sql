-- Privacy-safe provider counters for AI calls made by the SpeakerOps runtime.
-- Prompts, reviewer reasoning, and generated email bodies are deliberately
-- excluded. Provider request ids make retries/export idempotent.

CREATE TABLE ai_usage_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_request_id TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_creation_input_tokens >= 0),
  cache_creation_5m_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_creation_5m_input_tokens >= 0),
  cache_creation_1h_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_creation_1h_input_tokens >= 0),
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_read_input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  evidence_sha256 TEXT NOT NULL CHECK (length(evidence_sha256) = 64),
  measurement TEXT NOT NULL DEFAULT 'provider_reported' CHECK (measurement = 'provider_reported')
);

CREATE INDEX idx_ai_usage_events_occurred ON ai_usage_events(occurred_at);
