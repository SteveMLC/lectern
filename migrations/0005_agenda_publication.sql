-- A durable organizer publication receipt for AIA-07. Existing events remain
-- public; the timestamp records an explicit publish/go-live action.
ALTER TABLE events ADD COLUMN agenda_published_at TEXT;
