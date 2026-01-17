const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// API endpoint for character count
app.post('/api/count', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.json({ success: false, error: 'Text required' });
  }
  
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split(/\n/).length : 0;
  
  res.json({
    success: true,
    data: { chars, charsNoSpaces, words, lines }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'healthy' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
