import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(root, '.' + name);
      const relative = path.relative(root, file);
      if (
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        relative.split(path.sep).some((p) => p.startsWith('.')) ||
        !mime[path.extname(file)]
      ) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const content = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)],
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Super Volleyball: http://127.0.0.1:${port}`));
