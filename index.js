const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));

// Raw body capture for webhooks (before express.json)
app.use('/hook', express.raw({ type: '*/*', limit: '10mb' }));

// JSON for API routes
app.use('/api', express.json());

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

// ============ Start Server ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
// Staging deployment trigger Sat Jan 17 10:59:05 UTC 2026
// Trigger staging Sat Jan 17 11:01:11 UTC 2026
