-- Multi-reviewer evaluation workflow. The existing reviews table remains the
-- source of submitted scorecards; these tables add round-scoped membership
-- and assignments without changing the final-decision flow.
ALTER TABLE evaluation_rounds ADD COLUMN blind_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rubric_criteria ADD COLUMN round_id TEXT REFERENCES evaluation_rounds(id) ON DELETE CASCADE;

UPDATE rubric_criteria
SET round_id = (
  SELECT er.id FROM evaluation_rounds er
  WHERE er.plan_id = rubric_criteria.plan_id
  ORDER BY er.round_number LIMIT 1
)
WHERE round_id IS NULL;

CREATE INDEX idx_rubric_criteria_round ON rubric_criteria(round_id);

CREATE TABLE round_reviewers (
  round_id TEXT NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewer_token TEXT NOT NULL UNIQUE,
  assignment_cap INTEGER NOT NULL DEFAULT 5 CHECK (assignment_cap > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (round_id, reviewer_email)
);

CREATE TABLE review_assignments (
  round_id TEXT NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  reviewer_email TEXT NOT NULL,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL,
  UNIQUE (round_id, reviewer_email, submission_id),
  FOREIGN KEY (round_id, reviewer_email)
    REFERENCES round_reviewers(round_id, reviewer_email) ON DELETE CASCADE
);
CREATE INDEX idx_review_assignments_reviewer ON review_assignments(round_id, reviewer_email);
CREATE INDEX idx_review_assignments_submission ON review_assignments(submission_id);
