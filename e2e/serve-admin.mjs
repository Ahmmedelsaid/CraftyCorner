// Serves the built dashboard (dist/admin/browser) for the browser tests, with /api and /uploads forwarded to the
// real API. The dashboard's production build calls "/api" on its own address, so this stands in for the reverse
// proxy a real deployment would have, and the tests run against the same build that would be shipped.
//
//   npx ng build admin && node e2e/serve-admin.mjs   (Playwright starts it itself when E2E_START_ADMIN=1)
//
// E2E_API_ORIGIN (default http://localhost:5034) is the API; E2E_ADMIN_PORT (default 4201) is where this listens.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// the build lives at the repository root, whatever folder this runs from
const root = fileURLToPath(new URL('../dist/admin/browser', import.meta.url));
const api = new URL(process.env.E2E_API_ORIGIN ?? 'http://localhost:5034');
const port = Number(process.env.E2E_ADMIN_PORT ?? 4201);

if (!existsSync(join(root, 'index.html'))) {
  console.error(`Build the dashboard first (npx ng build admin): ${root}/index.html is missing.`);
  process.exit(1);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  // the API (and the uploaded photos it serves)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    const upstream = request(
      {
        host: api.hostname,
        port: api.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: api.host },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end('The API is not reachable');
    });
    req.pipe(upstream);
    return;
  }

  // a file of the build, or index.html for any route of the single-page app
  const wanted = normalize(join(root, decodeURIComponent(url.pathname)));
  const file =
    wanted.startsWith(root) && existsSync(wanted) && statSync(wanted).isFile()
      ? wanted
      : join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Dashboard on http://localhost:${port} (API ${api.origin})`));
