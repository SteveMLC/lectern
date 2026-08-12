-- Criteria are round-scoped, so the same key (for example "relevance") can
-- legitimately appear in multiple rounds with different scales or weights.
CREATE TABLE rubric_criteria_v2 (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES evaluation_plans(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  max_score INTEGER NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (round_id, key)
);

INSERT INTO rubric_criteria_v2
  (id, plan_id, round_id, key, label, description, max_score, weight, sort_order)
SELECT id, plan_id, round_id, key, label, description, max_score, weight, sort_order
FROM rubric_criteria
WHERE round_id IS NOT NULL;

DROP TABLE rubric_criteria;
ALTER TABLE rubric_criteria_v2 RENAME TO rubric_criteria;
CREATE INDEX idx_rubric_criteria_round ON rubric_criteria(round_id);
