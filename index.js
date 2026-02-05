const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));

// Raw body capture for webhooks (before express.json)
app.use('/hook', express.raw({ type: '*/*', limit: '10mb' }));

// JSON for API routes — 50MB limit for health data (workout payloads with GPS routes can be large)
app.use('/api/health-data', express.json({ limit: '50mb' }));
app.use('/api', express.json({ limit: '1mb' }));

// ============ Health ============
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
});

// ============ Character Counter API ============
app.post('/api/count', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.json({ success: false, error: 'Text required' });
  }
  
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split(/\n/).length : 0;
  
  res.json({ success: true, data: { chars, charsNoSpaces, words, lines } });
});

// ============ Webhook Capture ============
app.all('/hook/:channel', (req, res) => {
  const { channel } = req.params;
  const headers = JSON.stringify(req.headers);
  const query = JSON.stringify(req.query);
  const contentType = req.headers['content-type'] || '';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  
  // Get body as string
  let body = '';
  if (req.body) {
    body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
  }
  
  const size = Buffer.byteLength(body, 'utf8');
  
  // Store in database
  const stmt = db.prepare(`
    INSERT INTO hooks (channel, method, headers, body, query, content_type, ip, size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(channel, req.method, headers, body, query, contentType, ip, size);
  
  res.json({
    success: true,
    message: 'Webhook received',
    id: result.lastInsertRowid,
    channel
  });
});

// ============ Webhook API ============

// List hooks (with optional channel filter)
app.get('/api/hooks', (req, res) => {
  const { channel, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT id, channel, method, content_type, size, ip, received_at FROM hooks';
  const params = [];
  
  if (channel) {
    query += ' WHERE channel = ?';
    params.push(channel);
  }
  
  query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  
  const hooks = db.prepare(query).all(...params);
  
  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM hooks';
  if (channel) {
    countQuery += ' WHERE channel = ?';
  }
  const { total } = db.prepare(countQuery).get(...(channel ? [channel] : []));
  
  res.json({ success: true, data: hooks, total, limit: Number(limit), offset: Number(offset) });
});

// List channels
app.get('/api/hooks/channels', (req, res) => {
  const channels = db.prepare(`
    SELECT channel, COUNT(*) as count, MAX(received_at) as last_received
    FROM hooks
    GROUP BY channel
    ORDER BY last_received DESC
  `).all();
  
  res.json({ success: true, data: channels });
});

// Get single hook
app.get('/api/hooks/:id', (req, res) => {
  const { id } = req.params;
  const hook = db.prepare('SELECT * FROM hooks WHERE id = ?').get(id);
  
  if (!hook) {
    return res.status(404).json({ success: false, error: 'Hook not found' });
  }
  
  // Parse JSON fields
  try {
    hook.headers = JSON.parse(hook.headers);
    hook.query = JSON.parse(hook.query);
    // Try to parse body as JSON
    if (hook.content_type && hook.content_type.includes('application/json')) {
      try {
        hook.bodyParsed = JSON.parse(hook.body);
      } catch (e) {
        hook.bodyParsed = null;
      }
    }
  } catch (e) {
    // Keep as string if parse fails
  }
  
  res.json({ success: true, data: hook });
});

// Delete hook
app.delete('/api/hooks/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM hooks WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Hook not found' });
  }
  
  res.json({ success: true, message: 'Hook deleted' });
});

// Clear channel
app.delete('/api/hooks/channel/:channel', (req, res) => {
  const { channel } = req.params;
  const result = db.prepare('DELETE FROM hooks WHERE channel = ?').run(channel);
  
  res.json({ success: true, message: `Deleted ${result.changes} hooks from channel: ${channel}` });
});

// ============ Health Data Ingestion (Health Auto Export) ============
const HEALTH_API_KEY = process.env.HEALTH_API_KEY || 'keystone-health-2026';

// POST /api/health-data — receive Health Auto Export JSON payloads
// Also accept /api/health-data/:key for apps that strip query params
app.post('/api/health-data/:pathKey?', (req, res) => {
  // Auth check — header, query param, or path param
  const authKey = req.headers['x-api-key'] || req.query.key || req.params.pathKey;
  if (authKey !== HEALTH_API_KEY) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const payload = req.body;
    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: 'Invalid payload — expected { data: { metrics, workouts } }' });
    }

    const data = payload.data;
    let metricsCount = 0, sleepCount = 0, workoutsCount = 0;

    // Ingest metrics
    if (data.metrics && Array.isArray(data.metrics)) {
      const metricStmt = db.prepare(`
        INSERT OR REPLACE INTO health_metrics (name, date, qty, unit, extra)
        VALUES (?, ?, ?, ?, ?)
      `);

      const sleepStmt = db.prepare(`
        INSERT OR REPLACE INTO health_sleep (date, total_sleep, asleep, core, deep, rem, in_bed, sleep_start, sleep_end, in_bed_start, in_bed_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const metric of data.metrics) {
        const metricName = (metric.name || '').toLowerCase().replace(/\s+/g, '_');

        // Sleep analysis gets its own table
        if (metricName === 'sleep_analysis') {
          if (metric.data && Array.isArray(metric.data)) {
            for (const entry of metric.data) {
              const date = (entry.date || '').split(' ')[0]; // yyyy-MM-dd
              if (!date) continue;
              sleepStmt.run(
                date,
                entry.totalSleep || null,
                entry.asleep || null,
                entry.core || null,
                entry.deep || null,
                entry.rem || null,
                entry.inBed || null,
                entry.sleepStart || null,
                entry.sleepEnd || null,
                entry.inBedStart || null,
                entry.inBedEnd || null
              );
              sleepCount++;
            }
          }
          continue;
        }

        // All other metrics
        if (metric.data && Array.isArray(metric.data)) {
          for (const entry of metric.data) {
            const date = (entry.date || '').split(' ')[0];
            if (!date) continue;

            // Handle different metric formats
            let qty = entry.qty;
            let extra = null;

            // Heart rate has Min/Avg/Max
            if (entry.Min !== undefined || entry.Avg !== undefined || entry.Max !== undefined) {
              qty = entry.Avg || entry.Min || entry.Max;
              extra = JSON.stringify({ min: entry.Min, avg: entry.Avg, max: entry.Max });
            }
            // Blood pressure
            if (entry.systolic !== undefined) {
              extra = JSON.stringify({ systolic: entry.systolic, diastolic: entry.diastolic });
              qty = entry.systolic;
            }

            metricStmt.run(
              metricName,
              entry.date || date, // Keep full timestamp for metrics
              qty,
              metric.units || null,
              extra
            );
            metricsCount++;
          }
        }
      }
    }

    // Ingest workouts (handles both v1 and v2 Health Auto Export format)
    if (data.workouts && Array.isArray(data.workouts)) {
      const wkStmt = db.prepare(`
        INSERT OR REPLACE INTO health_workouts (name, date, start_time, end_time, duration, active_energy, active_energy_unit, total_energy, total_energy_unit, distance, distance_unit, hr_avg, hr_max, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Add unique index for dedup if not exists
      try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_dedup ON health_workouts(name, start_time)'); } catch(e) {}

      for (const w of data.workouts) {
        const date = (w.start || '').split(' ')[0];
        // v2 format: heartRate.avg.qty / heartRate.max.qty
        // v1 format: heartRateData[0].Avg / heartRateData[0].Max
        const hrAvg = w.heartRate?.avg?.qty || w.avgHeartRate?.qty || w.heartRateData?.[0]?.Avg || null;
        const hrMax = w.heartRate?.max?.qty || w.maxHeartRate?.qty || w.heartRateData?.[0]?.Max || null;

        wkStmt.run(
          w.name || null,
          date,
          w.start || null,
          w.end || null,
          w.duration || null,
          w.activeEnergyBurned?.qty || null,
          w.activeEnergyBurned?.units || null,
          w.totalEnergy?.qty || null,
          w.totalEnergy?.units || null,
          w.distance?.qty || null,
          w.distance?.units || null,
          hrAvg,
          hrMax,
          w.source || 'Health Auto Export'
        );
        workoutsCount++;
      }
    }

    // Log the sync
    db.prepare(`
      INSERT INTO health_sync_log (metrics_count, sleep_count, workouts_count, payload_size)
      VALUES (?, ?, ?, ?)
    `).run(metricsCount, sleepCount, workoutsCount, JSON.stringify(req.body).length);

    res.json({
      success: true,
      ingested: { metrics: metricsCount, sleep: sleepCount, workouts: workoutsCount }
    });
  } catch (err) {
    console.error('Health data ingestion error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/health-data/dump — download raw SQLite DB file
app.get('/api/health-data/dump', (req, res) => {
  const authKey = req.headers['x-api-key'] || req.query.key;
  if (authKey !== HEALTH_API_KEY) return res.status(401).json({ success: false, error: 'unauthorized' });
  
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hooks.db');
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch(e) {}
  if (!fs.existsSync(dbPath)) return res.status(404).json({ success: false, error: 'no database' });
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename=health-data.db');
  fs.createReadStream(dbPath).pipe(res);
});

// GET /api/health-data — query stored health data
app.get('/api/health-data', (req, res) => {
  const { type = 'summary', days = 7, name } = req.query;

  try {
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    if (type === 'summary') {
      const metrics = db.prepare(`SELECT name, COUNT(*) as count, MAX(date) as latest FROM health_metrics WHERE date >= ? GROUP BY name`).all(since);
      const sleep = db.prepare(`SELECT COUNT(*) as count, MAX(date) as latest FROM health_sleep WHERE date >= ?`).get(since);
      const workouts = db.prepare(`SELECT COUNT(*) as count, MAX(date) as latest FROM health_workouts WHERE date >= ?`).get(since);
      const lastSync = db.prepare(`SELECT received_at FROM health_sync_log ORDER BY id DESC LIMIT 1`).get();
      return res.json({ success: true, data: { metrics, sleep, workouts, lastSync: lastSync?.received_at } });
    }

    if (type === 'sleep') {
      const rows = db.prepare(`SELECT * FROM health_sleep WHERE date >= ? ORDER BY date DESC`).all(since);
      return res.json({ success: true, data: rows });
    }

    if (type === 'workouts') {
      const rows = db.prepare(`SELECT * FROM health_workouts WHERE date >= ? ORDER BY date DESC`).all(since);
      return res.json({ success: true, data: rows });
    }

    if (type === 'metrics' && name) {
      const rows = db.prepare(`SELECT * FROM health_metrics WHERE name = ? AND date >= ? ORDER BY date DESC`).all(name, since);
      return res.json({ success: true, data: rows });
    }

    if (type === 'metrics') {
      const rows = db.prepare(`SELECT * FROM health_metrics WHERE date >= ? ORDER BY name, date DESC`).all(since);
      return res.json({ success: true, data: rows });
    }

    res.json({ success: false, error: 'Unknown type. Use: summary, sleep, workouts, metrics' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/health-data/sync-log — recent syncs
app.get('/api/health-data/sync-log', (req, res) => {
  const rows = db.prepare(`SELECT * FROM health_sync_log ORDER BY id DESC LIMIT 20`).all();
  res.json({ success: true, data: rows });
});

// ============ Research Docs API ============
const RESEARCH_PATH = path.join(__dirname, 'research');
const DECISIONS_FILE = path.join(__dirname, 'decisions.json');

// Load decisions
function loadDecisions() {
  try {
    if (fs.existsSync(DECISIONS_FILE)) {
      return JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading decisions:', err);
  }
  return {};
}

// Save decisions
function saveDecisions(decisions) {
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
}

// Get all decisions
app.get('/api/decisions', (req, res) => {
  res.json({ success: true, data: loadDecisions() });
});

// Save a decision
app.post('/api/decisions', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key required' });
    }
    const decisions = loadDecisions();
    decisions[key] = {
      value,
      updatedAt: new Date().toISOString()
    };
    saveDecisions(decisions);
    res.json({ success: true, data: decisions[key] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// List all research docs
app.get('/api/research', (req, res) => {
  try {
    const files = fs.readdirSync(RESEARCH_PATH).filter(f => f.endsWith('.md'));
    
    const docs = files.map(file => {
      const content = fs.readFileSync(path.join(RESEARCH_PATH, file), 'utf8');
      const title = content.split('\n')[0]?.replace(/^#\s*/, '') || file;
      const isReadout = file.includes('readout');
      return { file, title, isReadout };
    });
    
    // Sort: readouts first, then alphabetical
    docs.sort((a, b) => {
      if (a.isReadout && !b.isReadout) return -1;
      if (!a.isReadout && b.isReadout) return 1;
      return a.title.localeCompare(b.title);
    });
    
    res.json({ success: true, data: docs });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get single research doc
app.get('/api/research/:file', (req, res) => {
  try {
    const filePath = path.join(RESEARCH_PATH, req.params.file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Doc not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const title = content.split('\n')[0]?.replace(/^#\s*/, '') || req.params.file;
    res.json({ success: true, data: { file: req.params.file, title, content } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ============ Knowledge Base API ============
const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge');

// List all atoms
app.get('/api/knowledge/atoms', (req, res) => {
  try {
    const atomsDir = path.join(KNOWLEDGE_PATH, 'atoms');
    const files = fs.readdirSync(atomsDir).filter(f => f.endsWith('.md'));
    
    const atoms = files.map(file => {
      const content = fs.readFileSync(path.join(atomsDir, file), 'utf8');
      const frontmatter = parseFrontmatter(content);
      return {
        file,
        ...frontmatter,
        preview: content.split('---')[2]?.trim().slice(0, 200) + '...'
      };
    });
    
    res.json({ success: true, data: atoms });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// List all topics
app.get('/api/knowledge/topics', (req, res) => {
  try {
    const topicsDir = path.join(KNOWLEDGE_PATH, 'topics');
    const files = fs.readdirSync(topicsDir).filter(f => f.endsWith('.md'));
    
    const topics = files.map(file => {
      const content = fs.readFileSync(path.join(topicsDir, file), 'utf8');
      const title = content.split('\n')[0]?.replace(/^#\s*/, '') || file;
      return { file, title, content };
    });
    
    res.json({ success: true, data: topics });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get single atom
app.get('/api/knowledge/atoms/:id', (req, res) => {
  try {
    const atomsDir = path.join(KNOWLEDGE_PATH, 'atoms');
    const files = fs.readdirSync(atomsDir).filter(f => f.startsWith(req.params.id));
    
    if (files.length === 0) {
      return res.status(404).json({ success: false, error: 'Atom not found' });
    }
    
    const content = fs.readFileSync(path.join(atomsDir, files[0]), 'utf8');
    const frontmatter = parseFrontmatter(content);
    const body = content.split('---')[2]?.trim() || '';
    
    res.json({ success: true, data: { file: files[0], ...frontmatter, body } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Helper to parse YAML frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const yaml = match[1];
  const result = {};
  yaml.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      let value = valueParts.join(':').trim();
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      }
      result[key.trim()] = value;
    }
  });
  return result;
}

// ============ Dashboard View Tracking ============

// Record a view (called by beacon in dashboard HTML — no auth required)
app.post('/api/views/:dashboard', (req, res) => {
  const { dashboard } = req.params;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  // Rate limit: ignore duplicate views from same IP within 5 minutes
  const recent = db.prepare(`
    SELECT id FROM dashboard_views
    WHERE dashboard = ? AND ip = ? AND viewed_at > datetime('now', '-5 minutes')
  `).get(dashboard, ip);

  if (recent) {
    return res.json({ success: true, deduplicated: true });
  }

  db.prepare(`
    INSERT INTO dashboard_views (dashboard, ip, user_agent) VALUES (?, ?, ?)
  `).run(dashboard, ip, userAgent);

  res.json({ success: true });
});

// Get view history for a dashboard (auth required)
app.get('/api/views/:dashboard', (req, res) => {
  const authKey = req.headers['x-api-key'] || req.query.key;
  if (authKey !== HEALTH_API_KEY) return res.status(401).json({ success: false, error: 'unauthorized' });

  const { dashboard } = req.params;
  const { days = 90, limit = 100 } = req.query;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const views = db.prepare(`
    SELECT id, viewed_at, ip, user_agent FROM dashboard_views
    WHERE dashboard = ? AND viewed_at >= ?
    ORDER BY viewed_at DESC LIMIT ?
  `).all(dashboard, since, Number(limit));

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM dashboard_views WHERE dashboard = ? AND viewed_at >= ?
  `).get(dashboard, since);

  const lastView = db.prepare(`
    SELECT viewed_at FROM dashboard_views WHERE dashboard = ? ORDER BY viewed_at DESC LIMIT 1
  `).get(dashboard);

  res.json({
    success: true,
    dashboard,
    totalViews: total.count,
    lastViewedAt: lastView?.viewed_at || null,
    views
  });
});

// Summary of all dashboard views (auth required)
app.get('/api/views', (req, res) => {
  const authKey = req.headers['x-api-key'] || req.query.key;
  if (authKey !== HEALTH_API_KEY) return res.status(401).json({ success: false, error: 'unauthorized' });

  const { days = 90 } = req.query;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const summary = db.prepare(`
    SELECT dashboard, COUNT(*) as views, MAX(viewed_at) as last_viewed
    FROM dashboard_views
    WHERE viewed_at >= ?
    GROUP BY dashboard
    ORDER BY last_viewed DESC
  `).all(since);

  res.json({ success: true, data: summary });
});

// ============ Chat Bridge (Dashboard <-> Keel) ============
const chatPool = new Pool({
  connectionString: process.env.CHAT_DATABASE_URL || 
    'postgresql://postgres:wQQMKpkZSbkgtkFzJCHicFSCLkaOmGSc@nozomi.proxy.rlwy.net:40682/railway',
});

// POST /api/chat - Dashboard sends message (no Telegram - isolated session handles it)
app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;
  
  if (!message?.trim()) {
    return res.status(400).json({ error: 'message required' });
  }
  
  const ticketId = crypto.randomUUID().slice(0, 8);
  
  try {
    await chatPool.query(
      `INSERT INTO chat_messages (ticket_id, user_message, context, status) 
       VALUES ($1, $2, $3, 'pending')`,
      [ticketId, message.trim(), context ? JSON.stringify(context) : null]
    );
    
    console.log(`[Chat ${ticketId}] New message queued`);
    res.json({ ticketId, status: 'pending' });
  } catch (err) {
    console.error('Chat insert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/poll/:ticketId - Dashboard polls for response
app.get('/api/chat/poll/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  
  try {
    const result = await chatPool.query(
      'SELECT status, keel_response, created_at FROM chat_messages WHERE ticket_id = $1',
      [ticketId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    
    const row = result.rows[0];
    res.json({
      ticketId,
      status: row.status,
      response: row.keel_response,
      elapsed: Date.now() - new Date(row.created_at).getTime()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/pending - Keel fetches pending messages
app.get('/api/chat/pending', async (req, res) => {
  try {
    const result = await chatPool.query(
      `SELECT ticket_id, user_message, context, created_at 
       FROM chat_messages WHERE status = 'pending' ORDER BY created_at ASC`
    );
    res.json({
      pending: result.rows.map(r => ({
        ticketId: r.ticket_id,
        message: r.user_message,
        context: typeof r.context === 'string' ? JSON.parse(r.context) : r.context,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/respond - Keel posts response
app.post('/api/chat/respond', async (req, res) => {
  const { ticketId, response } = req.body;
  
  if (!ticketId || !response) {
    return res.status(400).json({ error: 'ticketId and response required' });
  }
  
  try {
    const result = await chatPool.query(
      `UPDATE chat_messages SET status = 'completed', keel_response = $1, responded_at = NOW() 
       WHERE ticket_id = $2 RETURNING id`,
      [response, ticketId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ticket not found' });
    }
    
    console.log(`[Chat ${ticketId}] Response posted`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Start Server ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
