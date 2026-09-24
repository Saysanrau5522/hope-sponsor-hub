-- Migration 0002: Queue and Pacing additions
ALTER TABLE outreaches ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE outreaches ADD COLUMN next_due_at TEXT;
CREATE INDEX IF NOT EXISTS idx_outreaches_next_due ON outreaches(status, next_due_at);
