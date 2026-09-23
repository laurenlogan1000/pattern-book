-- Pattern Book database (Cloudflare D1 / SQLite).
CREATE TABLE IF NOT EXISTS systems (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  name TEXT NOT NULL,
  tagline TEXT,
  rev INTEGER NOT NULL DEFAULT 1,
  brief TEXT,
  author TEXT,
  thumbs TEXT NOT NULL DEFAULT '[]',
  spec TEXT NOT NULL,
  last_feedback TEXT
);
CREATE INDEX IF NOT EXISTS systems_created ON systems (created_at DESC);

-- Earlier versions, saved on every revise.
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  at TEXT NOT NULL,
  spec TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_system ON versions (system_id);

-- Claude calls, for rate limiting. Rows older than a day are pruned.
CREATE TABLE IF NOT EXISTS runs (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_ip_at ON runs (ip, at);
