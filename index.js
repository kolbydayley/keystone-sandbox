const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

// ============ Research Docs API ============
const RESEARCH_PATH = path.join(__dirname, 'research');

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

// ============ Start Server ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
