const Database = require('better-sqlite3');
const path = require('path');

// Use volume mount if available (Railway), otherwise local
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hooks.db');

// Ensure directory exists
const fs = require('fs');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    method TEXT,
    headers TEXT,
    body TEXT,
    query TEXT,
    content_type TEXT,
    ip TEXT,
    size INTEGER DEFAULT 0,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_hooks_channel ON hooks(channel);
  CREATE INDEX IF NOT EXISTS idx_hooks_received_at ON hooks(received_at DESC);
`);

module.exports = db;
