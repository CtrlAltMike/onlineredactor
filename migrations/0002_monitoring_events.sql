CREATE TABLE IF NOT EXISTS client_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_code TEXT NOT NULL,
  route TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_events_code_created ON client_events(event_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_user_created ON client_events(user_id, created_at DESC);
