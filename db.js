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

  -- Health data tables (ingested from Health Auto Export)
  CREATE TABLE IF NOT EXISTS health_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    qty REAL,
    unit TEXT,
    extra TEXT,
    source TEXT DEFAULT 'health_auto_export',
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, date)
  );

  CREATE TABLE IF NOT EXISTS health_sleep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total_sleep REAL,
    asleep REAL,
    core REAL,
    deep REAL,
    rem REAL,
    in_bed REAL,
    sleep_start TEXT,
    sleep_end TEXT,
    in_bed_start TEXT,
    in_bed_end TEXT,
    source TEXT DEFAULT 'health_auto_export',
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS health_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration REAL,
    active_energy REAL,
    active_energy_unit TEXT,
    total_energy REAL,
    total_energy_unit TEXT,
    distance REAL,
    distance_unit TEXT,
    hr_avg REAL,
    hr_max REAL,
    source TEXT DEFAULT 'health_auto_export',
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS health_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metrics_count INTEGER DEFAULT 0,
    sleep_count INTEGER DEFAULT 0,
    workouts_count INTEGER DEFAULT 0,
    payload_size INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_health_metrics_name_date ON health_metrics(name, date);
  CREATE INDEX IF NOT EXISTS idx_health_sleep_date ON health_sleep(date);
  CREATE INDEX IF NOT EXISTS idx_health_workouts_date ON health_workouts(date);
`);

module.exports = db;
