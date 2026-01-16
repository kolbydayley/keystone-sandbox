const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>Keystone Sandbox</title></head>
    <body style="font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px;">
      <h1>🌀 Keystone Sandbox</h1>
      <p>This is the Keystone AI general-purpose sandbox.</p>
      <p>Deployed: ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
