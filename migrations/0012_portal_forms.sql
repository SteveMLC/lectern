-- Portal forms: the brief's "Portal > Forms — For speakers to fill out a form
-- in a Task" (hotel stay, flight reimbursement, finalize bio, and so on).
--
-- The form engine already exists for the CFP — fields, conditional rules,
-- validation. Rather than clone it, `forms.kind` widens to accept 'portal' so
-- a portal form is the same object with a different consumer. SQLite cannot
-- alter a CHECK constraint, so the table is rebuilt; ids are preserved, which
-- keeps every form_fields, conditional_rules, and submissions reference valid.

PRAGMA defer_foreign_keys = true;

CREATE TABLE forms_rebuilt (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('cfp','portal')),
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

INSERT INTO forms_rebuilt
  (id, event_id, kind, title, welcome_text, thank_you_text, is_open, opens_at,
   closes_at, max_speakers_per_submission, allow_drafts, created_at, updated_at)
SELECT
  id, event_id, kind, title, welcome_text, thank_you_text, is_open, opens_at,
  closes_at, max_speakers_per_submission, allow_drafts, created_at, updated_at
FROM forms;

DROP TABLE forms;
ALTER TABLE forms_rebuilt RENAME TO forms;

-- A task definition with a form_id is a form-fill task: the speaker answers
-- the form in their portal instead of uploading a file or ticking a box.
ALTER TABLE task_definitions ADD COLUMN form_id TEXT REFERENCES forms(id) ON DELETE SET NULL;

CREATE TABLE task_form_responses (
  id TEXT PRIMARY KEY,
  task_definition_id TEXT NOT NULL REFERENCES task_definitions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE (task_definition_id, speaker_id)
);
CREATE INDEX idx_task_form_responses_form ON task_form_responses(form_id);
