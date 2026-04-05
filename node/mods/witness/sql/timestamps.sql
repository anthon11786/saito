CREATE TABLE IF NOT EXISTS timestamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_hash TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  tx_sig TEXT UNIQUE NOT NULL,
  sender TEXT NOT NULL,
  block_id INTEGER,
  block_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timestamps_hash ON timestamps(file_hash);
CREATE INDEX IF NOT EXISTS idx_timestamps_sig ON timestamps(tx_sig);

