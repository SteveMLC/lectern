-- Multiple submission forms per event.
--
-- The organizer's product runs several calls side by side — their list shows
-- three, and the builder titles itself "Session Submission Form #4". The
-- forms/form_fields/conditional_rules tables have supported many rows per
-- event since 0012 (portal forms), and submissions.form_id already records
-- which form a proposal came through. Only the code assumed one CFP.
--
-- The one schema piece missing is the event-level capacity default their
-- Submission capacity panel shows as "Event max: 3 — applies when no
-- form-level limit is set."

ALTER TABLE events ADD COLUMN submission_max INTEGER;
