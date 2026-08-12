ALTER TABLE speaker_assets ADD COLUMN task_id TEXT REFERENCES speaker_tasks(id) ON DELETE SET NULL;
ALTER TABLE speaker_assets ADD COLUMN session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE speaker_assets ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_speaker_assets_context ON speaker_assets(speaker_id, task_id, session_id, version_number);
