// Serves a built site to the agent and logs every request. The build under test names its own origin in its links
// (https://lede.cloudcompute.com), so text files have that origin replaced with this server's, and a release's registry
// URL, /r/vX.Y.Z/{name}.json, is served from the build's /r/{name}.json. Nothing else in a file changes.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

export const SITE_ORIGIN = 'https://lede.cloudcompute.com';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const TEXT = new Set(['.html', '.md', '.txt', '.json', '.css', '.js', '.svg']);

/**
 * @param {{ root: string, rewriteOrigin?: boolean, port?: number }} options
 * @returns {Promise<{ url: string, log: { path: string, status: number, bytes: number }[], close: () => Promise<void> }>}
 */
export async function serve({ root, rewriteOrigin = true, port = 0 }) {
  const base = resolve(root);
  const log = [];
  let origin = '';

  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.replace(/^\/r\/v\d+\.\d+\.\d+\//, '/r/');
    if (file.endsWith('/')) file += 'index.html';
    let full = normalize(join(base, file));
    let status = 200;
    let body;
    try {
      if (!full.startsWith(base)) throw new Error('outside root');
      if ((await stat(full)).isDirectory()) full = join(full, 'index.html');
      body = await readFile(full);
    } catch {
      // A built single-page app answers unknown paths with its index, as the deployed site does.
      try {
        if (extname(file)) throw new Error('missing file');
        body = await readFile(join(base, 'index.html'));
        full = join(base, 'index.html');
      } catch {
        status = 404;
        body = Buffer.from('Not found\n');
      }
    }
    const ext = status === 200 ? extname(full) : '.txt';
    if (rewriteOrigin && TEXT.has(ext)) body = Buffer.from(body.toString('utf8').replaceAll(SITE_ORIGIN, origin));
    res.writeHead(status, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
    log.push({ path, status, bytes: body.length });
  });

  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`;
  return {
    url: origin,
    log,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
