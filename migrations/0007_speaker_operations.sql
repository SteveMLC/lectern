ALTER TABLE speakers ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'invited'
  CHECK (workflow_status IN ('prospect','invited','confirmed','declined'));
ALTER TABLE speakers ADD COLUMN logistics_notes TEXT;
CREATE INDEX idx_speakers_event_workflow ON speakers(event_id, workflow_status);
