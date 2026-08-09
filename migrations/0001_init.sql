-- SpeakerOps initial schema (D1 / SQLite).
--
-- Invariants enforced at the schema level:
--   * sessions.source_submission_id is UNIQUE and nullable: accepting a
--     submission can never produce two sessions (idempotent acceptance),
--     and direct sessions carry NULL lineage.
--   * sessions CHECK ties origin to lineage: accepted_submission <=> non-null
--     source, direct <=> null source.
--   * agenda_slots.session_id references sessions only. Submissions are not
--     schedulable and there is deliberately no submission reference here.
--   * speaker_assets are first-class rows keyed to R2 objects, never URL
--     strings on the speaker row.
--   * reviews are unique per (round, submission, reviewer); aggregates are
--     always derived in code, never stored.
--   * external_id_map is unique per (connection, entity_type, internal_id) so
--     integration retries update instead of duplicating.
--
-- Conventions: TEXT ids with entity prefixes, ISO-8601 UTC timestamps (TEXT),
-- booleans as INTEGER 0/1, JSON payloads as TEXT columns suffixed _json.

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  timezone TEXT NOT NULL,
  venue TEXT,
  website_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tracks_event ON tracks(event_id);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_rooms_event ON rooms(event_id);

CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('cfp')),
  title TEXT NOT NULL,
  welcome_text TEXT,
  thank_you_text TEXT,
  is_open INTEGER NOT NULL DEFAULT 1,
  opens_at TEXT,
  closes_at TEXT,
  max_speakers_per_submission INTEGER NOT NULL DEFAULT 3,
  allow_drafts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_forms_event ON forms(event_id);

CREATE TABLE form_fields (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','textarea','select','multiselect','checkbox','email','url','number')),
  required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  help_text TEXT,
  options_json TEXT,
  UNIQUE (form_id, key)
);

CREATE TABLE conditional_rules (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  source_field_key TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('equals','not_equals','in')),
  values_json TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('show','hide')),
  target_field_key TEXT NOT NULL
);

CREATE TABLE speakers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  bio TEXT,
  location TEXT,
  socials_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, email)
);
CREATE INDEX idx_speakers_event ON speakers(event_id);

CREATE TABLE speaker_assets (
  id TEXT PRIMARY KEY,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('headshot','slides','document')),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_at TEXT NOT NULL
);
CREATE INDEX idx_speaker_assets_speaker ON speaker_assets(speaker_id);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_id TEXT REFERENCES forms(id) ON DELETE SET NULL,
  track_id TEXT REFERENCES tracks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('talk','workshop','panel','lightning','keynote')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','under_review','accepted','rejected','waitlisted','withdrawn')),
  answers_json TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_submissions_event ON submissions(event_id);
CREATE INDEX idx_submissions_status ON submissions(event_id, status);

CREATE TABLE submission_speakers (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary','co_speaker')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (submission_id, speaker_id)
);
CREATE INDEX idx_submission_speakers_speaker ON submission_speakers(speaker_id);

CREATE TABLE evaluation_plans (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE evaluation_rounds (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES evaluation_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','open','closed')),
  opens_at TEXT,
  closes_at TEXT,
  UNIQUE (plan_id, round_number)
);

CREATE TABLE rubric_criteria (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES evaluation_plans(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  max_score INTEGER NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (plan_id, key)
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  scores_json TEXT NOT NULL DEFAULT '{}',
  overall_comment TEXT,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('accept','reject','waitlist','abstain')),
  submitted_at TEXT NOT NULL,
  UNIQUE (round_id, submission_id, reviewer_email)
);
CREATE INDEX idx_reviews_submission ON reviews(submission_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_submission_id TEXT UNIQUE REFERENCES submissions(id) ON DELETE SET NULL,
  track_id TEXT REFERENCES tracks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('talk','workshop','panel','lightning','keynote')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('tentative','confirmed','cancelled')),
  origin TEXT NOT NULL CHECK (origin IN ('accepted_submission','direct')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (origin = 'accepted_submission' AND source_submission_id IS NOT NULL)
    OR (origin = 'direct' AND source_submission_id IS NULL)
  )
);
CREATE INDEX idx_sessions_event ON sessions(event_id);

CREATE TABLE session_speakers (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary','co_speaker')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, speaker_id)
);
CREATE INDEX idx_session_speakers_speaker ON session_speakers(speaker_id);

CREATE TABLE agenda_slots (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_agenda_slots_event ON agenda_slots(event_id);

CREATE TABLE task_definitions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('accepted_speakers','all_speakers')),
  due_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, key)
);

CREATE TABLE speaker_tasks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  task_definition_id TEXT NOT NULL REFERENCES task_definitions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','blocked')),
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (speaker_id, task_definition_id)
);
CREATE INDEX idx_speaker_tasks_event_status ON speaker_tasks(event_id, status);

CREATE TABLE message_templates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  subject TEXT NOT NULL,
  body_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, key)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES message_templates(id) ON DELETE SET NULL,
  speaker_id TEXT REFERENCES speakers(id) ON DELETE SET NULL,
  to_email TEXT,
  subject TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','sent_simulated','sent','failed')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_event ON messages(event_id);

CREATE TABLE delivery_attempts (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attempted_at TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('simulated','resend')),
  status TEXT NOT NULL CHECK (status IN ('success','failure')),
  provider_id TEXT,
  error TEXT
);

CREATE TABLE resource_pages (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  embed_html TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, slug)
);

CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  system TEXT NOT NULL CHECK (system IN ('accelevents','airtable')),
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','awaiting_credentials','configured','error')),
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, system)
);

CREATE TABLE sync_runs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('push','pull')),
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failure')),
  stats_json TEXT,
  log_json TEXT
);

CREATE TABLE external_id_map (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  UNIQUE (connection_id, entity_type, internal_id)
);
