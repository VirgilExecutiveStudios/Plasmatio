'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const allowed = new Set(['index.html', 'app.js', 'styles.css', 'heptagon.js', 'layer-engine.js', ...fs.readdirSync(path.join(root,'pages')).filter(x=>x.endsWith('.js')).map(x=>'pages/'+x), 'assets/branding/plasmatio.png', ...[1, 2, 3, 4, 5, 6].map(n => `assets/${n}.png`)]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const port = Number(process.env.PORT || 5173);

http.createServer((request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!allowed.has(name)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-cache' });
  fs.createReadStream(path.join(root, name)).pipe(response);
}).listen(port, '0.0.0.0', () => console.log(`PLASMATIO UI listening on port ${port}`));
