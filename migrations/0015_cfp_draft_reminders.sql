-- Draft reminder emails, tied to the close date.
--
-- The close-date panel in the product we are replacing reads, verbatim: "Set a
-- close date to enable draft reminder emails." We already store forms.closes_at
-- and we already keep saved drafts, but nothing ever told a proposer their
-- draft was about to expire.
--
-- This column is the "we already told them" mark. It is written once, the first
-- time a reminder goes out, so an approaching close date can never nag the same
-- draft twice however often the sweep runs.
ALTER TABLE cfp_drafts ADD COLUMN reminded_at TEXT;

-- The six-hourly sweep asks for un-reminded drafts and joins their form.
CREATE INDEX idx_cfp_drafts_reminded ON cfp_drafts(reminded_at, form_id);
