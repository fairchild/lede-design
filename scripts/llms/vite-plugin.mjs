// Runs scripts/llms/generate.mjs in the site's builds (dist, dist-fixtures, dist-strict) and its dev server, so each
// serves the Markdown files with no step of its own, and gives the preview server the site's content type for them.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { generate } from './generate.mjs';
import { twinPath } from './markdown.mjs';
import { PAGES } from './pages.mjs';

/**
 * Every generated file is served as plain text, `.md` too, as `public/_headers` makes the site do. A fetch tool that
 * reads `text/markdown` as HTML drops the JSX in the code blocks and joins the lines; plain text reaches it intact.
 */
const PLAIN = 'text/plain; charset=utf-8';
const PAGE_FILES = new Set(PAGES.map((page) => twinPath(page.route).slice(1)));
/**
 * A path the generator writes, or would write for a registry item: only these reach it, so Vite's own requests don't.
 * `reference/index.md` matches with the reference pages.
 */
const isGenerated = (path) =>
  PAGE_FILES.has(path) || /^reference\/[^/]+\.md$/.test(path) || ['index.md', 'llms.txt', 'llms-full.txt'].includes(path);
/** The request's path without its leading slash, or null for a request with a query, such as Vite's `?import&raw`. */
const pathOf = (url = '/') => {
  const { pathname, search } = new URL(url, 'http://localhost');
  return search ? null : pathname.slice(1);
};
const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', PLAIN);
  res.end(body);
};

/** @returns {import('vite').Plugin} */
export function llms() {
  let config;
  return {
    name: 'lede-llms',
    configResolved(resolved) {
      config = resolved;
    },
    async generateBundle() {
      // Pages render on a server of their own, with the site's aliases and none of its plugins: Vite's own transform
      // compiles their TSX, and CSS doesn't matter to static markup.
      const server = await createServer({
        configFile: false,
        root: config.root,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, ws: false },
        resolve: { alias: config.resolve.alias },
      });
      try {
        for (const [fileName, source] of await generate((id) => server.ssrLoadModule(id))) {
          this.emitFile({ type: 'asset', fileName, source });
        }
      } finally {
        await server.close();
      }
    },
    configureServer(server) {
      // Built on the first request and again after any file changes.
      let files = null;
      server.watcher.on('all', () => { files = null; });
      server.middlewares.use(async (req, res, next) => {
        const path = pathOf(req.url);
        if (path === null) return next();
        // Any other Markdown path is a file the site doesn't have: 404, as the Worker and the preview server answer.
        if (!isGenerated(path)) return path.endsWith('.md') ? send(res, 404, 'Not found\n') : next();
        try {
          files ??= generate((id) => server.ssrLoadModule(id));
          const body = (await files).get(path);
          // A registry item that doesn't exist: 404, as the site's Worker answers.
          send(res, body === undefined ? 404 : 200, body ?? 'Not found\n');
        } catch (error) {
          files = null;
          next(error);
        }
      });
    },
    configurePreviewServer(server) {
      // `vite preview`, which the tests serve, reads no `_headers` and sends `.txt` without a charset, so it gets the
      // site's type here, and a missing Markdown file is a 404, as on the site.
      const outDir = resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, res, next) => {
        const path = pathOf(req.url);
        if (path === null || !(path.endsWith('.md') || isGenerated(path))) return next();
        const file = resolve(outDir, path);
        if (!file.startsWith(`${outDir}/`) || !existsSync(file)) return send(res, 404, 'Not found\n');
        send(res, 200, readFileSync(file));
      });
    },
  };
}
