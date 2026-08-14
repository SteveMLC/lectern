-- The Form Settings controls still missing from the organizer's captures.
--
-- Their "Submission capacity" panel caps how many sessions one submitter may
-- have for a form, counting saved drafts as well as sent proposals. Their
-- "Validation rules" panel caps the combined length of several text fields —
-- the example on screen is a printed program block, where the physical page
-- is the constraint, not any single field. Their Notifications step names the
-- admins emailed when a submission arrives or changes.

ALTER TABLE forms ADD COLUMN submission_limit INTEGER;
ALTER TABLE forms ADD COLUMN notify_emails TEXT;

-- One row per combined-length rule. `field_keys_json` is the ordered set of
-- form field keys whose lengths are summed; `max_chars` is the cap.
CREATE TABLE form_length_rules (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_keys_json TEXT NOT NULL,
  max_chars INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_form_length_rules_form ON form_length_rules(form_id);
