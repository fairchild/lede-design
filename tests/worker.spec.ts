// The Worker in worker/index.ts, called in Node with an in-memory bucket and assets binding. Each case checks a route,
// the release marker, the CORS headers or the media headers through what fetch() answers and which keys it reads.
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

/** A path the typecheck doesn't follow: the Worker's types come from wrangler and aren't the site's. */
const WORKER = resolve('worker/index.ts');
type Handler = { fetch: (request: Request, env: unknown) => Promise<Response> };
const load = async (): Promise<Handler> => (await import(WORKER)).default;

interface Stored { body: string; contentType?: string }

const MARKDOWN = ['/overview.md', '/components.md', '/blocks/data-table.md'];

/**
 * An R2 bucket of `objects` that logs each head and get, and an assets binding that answers JSON under /r/ and keeps
 * each Request it's given.
 */
function binding(objects: Record<string, Stored> = {}, { failing = false } = {}) {
  const reads: string[] = [];
  const forwarded: Request[] = [];
  const object = (key: string) => {
    const stored = objects[key];
    return stored && {
      body: new Response(stored.body).body,
      httpEtag: `"${key.length}"`,
      httpMetadata: { contentType: stored.contentType },
      uploaded: new Date('2026-01-02T03:04:05Z'),
    };
  };
  const env = {
    BUCKET: {
      head: async (key: string) => { reads.push(`head ${key}`); if (failing) throw new Error('R2 down'); return object(key); },
      get: async (key: string) => { reads.push(`get ${key}`); if (failing) throw new Error('R2 down'); return object(key) ?? null; },
    },
    ASSETS: {
      fetch: async (input: Request | string) => {
        const { pathname } = new URL(typeof input === 'string' ? input : input.url);
        reads.push(`asset ${pathname}`);
        if (typeof input !== 'string') forwarded.push(input);
        // The docs pages' Markdown twins; any other .md is missing, as `not_found_handling: "none"` answers.
        if (pathname.endsWith('.md')) {
          return MARKDOWN.includes(pathname)
            ? new Response(`# ${pathname}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
            : new Response('Not found', { status: 404 });
        }
        return pathname.startsWith('/r/')
          ? new Response('{}', { headers: { 'content-type': 'application/json', etag: '"a"' } })
          : new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
      },
    },
  };
  return { env, reads, forwarded };
}

const ask = async (path: string, objects?: Record<string, Stored>, init?: RequestInit & { failing?: boolean }) => {
  const { env, reads, forwarded } = binding(objects, { failing: init?.failing });
  const logged = console.error;
  console.error = () => {};
  const response = await (await load()).fetch(new Request(`https://lede.test${path}`, init), env).finally(() => { console.error = logged; });
  return { response, reads, forwarded, status: response.status, header: (name: string) => response.headers.get(name) };
};

const RELEASE = { 'r/v0.4.0/registry.json': { body: '{}' }, 'r/v0.4.0/button.json': { body: '{"name":"button"}' } };

test('routes a release, next, the latest, media and the site, each to its own store and key', async () => {
  const cases: [string, string[]][] = [
    ['/r/v0.4.0/button.json', ['head r/v0.4.0/registry.json', 'get r/v0.4.0/button.json']],
    ['/r/v1.2.3-rc.1/button.json', ['head r/v1.2.3-rc.1/registry.json']],
    ['/r/v0.4.0/registry.json', ['get r/v0.4.0/registry.json']],
    ['/r/next/button.json', ['get r/next/button.json']],
    ['/r/button.json', ['asset /r/button.json']],
    ['/media/logos/lede.svg', ['get media/logos/lede.svg']],
    ['/docs/components', ['asset /']],
  ];
  for (const [path, reads] of cases) expect((await ask(path, RELEASE)).reads, path).toEqual(reads);
});

test('answers 404 without a read for a path outside the patterns', async () => {
  for (const path of ['/r/v0.4/button.json', '/r/v0.4.0/Button.json', '/r/v0.4.0/button.txt', '/r/v0.4.0/a/b.json', '/r/x/y', '/r/', '/media/', '/media/a%20b.png', '/media/a%2fb.png', '/media/a%00.png']) {
    const { status, reads } = await ask(path, RELEASE);
    expect(status, path).toBe(404);
    expect(reads, path).toEqual([]);
  }
});

// wrangler.jsonc sends a path outside /r/ and /media/ here only when no asset matches it.
test('answers 404 for a missing file and the shell for a route, with the request’s method and headers', async () => {
  for (const path of ['/nope.md', '/llms-full.txt', '/sitemap.xml', '/components.md', '/assets/index-old.js', '/a/b/c.JSON', '/.env']) {
    for (const method of ['GET', 'HEAD']) {
      const { status, reads, header, response } = await ask(path, {}, { method });
      expect(status, `${method} ${path}`).toBe(404);
      expect(reads, path).toEqual([]);
      expect(header('content-type'), path).toBe('text/plain; charset=utf-8');
      expect(header('cache-control'), path).toBe('no-store');
      if (method === 'GET') expect(await response.text(), path).toBe('Not found. The docs index is /llms.txt\n');
    }
  }
  for (const path of ['/components', '/app/inbox/m1', '/blocks/data-table/items/WI-1001', '/foo.bar/baz', '/layouts/', '/missing']) {
    const { status, reads, forwarded } = await ask(path, {}, { method: 'HEAD', headers: { 'if-none-match': '"shell"', 'sec-fetch-mode': 'navigate' } });
    expect(status, path).toBe(200);
    expect(reads, path).toEqual(['asset /']);
    expect(forwarded[0].method, path).toBe('HEAD');
    expect(forwarded[0].headers.get('if-none-match'), path).toBe('"shell"');
  }
});

test('answers a docs route with its Markdown when the request ranks text/markdown first, and says the answer varies', async () => {
  const markdown = { headers: { accept: 'text/markdown, text/html;q=0.9' } };
  for (const [path, file] of [['/', '/overview.md'], ['/components', '/components.md'], ['/blocks/data-table/', '/blocks/data-table.md']]) {
    const { status, reads, header, response } = await ask(path, {}, markdown);
    expect(status, path).toBe(200);
    expect(reads, path).toEqual([`asset ${file}`]);
    expect(await response.text(), path).toBe(`# ${file}`);
    expect(header('vary'), path).toBe('Accept');
  }
  // Ranked equal with HTML, Markdown wins: the client named it, and a browser never does.
  const tied = await ask('/components', {}, { headers: { accept: 'text/html, text/markdown' } });
  expect(tied.reads).toEqual(['asset /components.md']);
  // A route with no Markdown, such as the demo app, gets the shell after one look for it.
  const app = await ask('/app/inbox', {}, markdown);
  expect(app.reads).toEqual(['asset /app/inbox.md', 'asset /']);
  expect(await app.response.text()).toBe('<!doctype html>');
  // A browser, a client that asks for nothing, one that prefers HTML and one that refuses Markdown get the page.
  for (const accept of ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', '', 'text/markdown;q=0.5, text/html', 'text/markdown;q=0, */*']) {
    const { reads, header } = await ask('/components', {}, { headers: accept ? { accept } : {} });
    expect(reads, accept).toEqual(['asset /']);
    expect(header('vary'), accept).toBe('Accept');
  }
});

test('names the index a fetcher can read next in a registry 404, and nothing in a media 404', async () => {
  const registry = 'Not found. The registry index is /r/registry.json\n';
  for (const path of ['/r/', '/r/x/y', '/r/v0.4.0/missing.json', '/r/v0.5.0/button.json', '/r/next/missing.json']) {
    const { status, response, header } = await ask(path, RELEASE);
    expect(status, path).toBe(404);
    expect(await response.text(), path).toBe(registry);
    expect(header('access-control-allow-origin'), path).toBe('*');
  }
  const { env } = binding();
  env.ASSETS.fetch = async () => new Response(null, { status: 404 });
  const latest = await (await load()).fetch(new Request('https://lede.test/r/missing.json'), env);
  expect(await latest.text(), 'a missing latest item').toBe(registry);
  for (const path of ['/media/', '/media/missing.png']) expect(await (await ask(path)).response.text(), path).toBe('Not found\n');
});

test('keeps an encoded or climbing path inside the prefix the URL resolves to', async () => {
  const cases: [string, string[]][] = [
    ['/media/%2e%2e/r/v0.4.0/button.json', ['head r/v0.4.0/registry.json', 'get r/v0.4.0/button.json']],
    ['/media/../r/next/button.json', ['get r/next/button.json']],
    ['/r/v0.4.0/../../media/x.png', ['get media/x.png']],
    ['/r/next/%2E%2E/v0.4.0/button.json', ['head r/v0.4.0/registry.json', 'get r/v0.4.0/button.json']],
    ['/media/a/%2e%2e/%2e%2e/%2e%2e/etc/passwd', ['asset /']],
    ['/media/a/%2e%2e/%2e%2e/%2e%2e/etc/passwd.txt', []],
    ['/r/v0.4.0/..%2fregistry.json', []],
  ];
  for (const [path, reads] of cases) expect((await ask(path, RELEASE)).reads, path).toEqual(reads);
});

test('answers 404 for a release item until its marker exists, and then serves it as immutable', async () => {
  const before = await ask('/r/v0.4.0/button.json', { 'r/v0.4.0/button.json': RELEASE['r/v0.4.0/button.json'] });
  expect(before.status).toBe(404);
  expect(before.reads).toEqual(['head r/v0.4.0/registry.json']);
  expect(before.header('cache-control')).toBe('no-store');
  const after = await ask('/r/v0.4.0/button.json', RELEASE);
  expect(after.status).toBe(200);
  expect(await after.response.text()).toBe('{"name":"button"}');
  expect(after.header('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(after.header('content-type')).toBe('application/json; charset=utf-8');
  expect(after.header('access-control-allow-origin')).toBe('*');
  expect((await ask('/r/next/button.json', { 'r/next/button.json': { body: '{}' } })).status, 'next needs no marker').toBe(200);
});

test('sends the CORS header on every registry error, and answers a preflight on registry paths', async () => {
  const errors = [
    await ask('/r/v0.4.0/missing.json', RELEASE),
    await ask('/r/v0.4/button.json'),
    await ask('/r/v0.4.0/button.json', RELEASE, { failing: true }),
    await ask('/r/v0.4.0/button.json', RELEASE, { headers: { 'if-match': '"nope"' } }),
    await ask('/r/next/button.json', {}, { method: 'POST' }),
  ];
  expect(errors.map(({ status }) => status)).toEqual([404, 404, 503, 412, 405]);
  for (const { header } of errors) expect(header('access-control-allow-origin')).toBe('*');
  const preflight = await ask('/r/v0.4.0/button.json', RELEASE, {
    method: 'OPTIONS',
    headers: { origin: 'https://example.com', 'access-control-request-method': 'GET', 'access-control-request-headers': 'if-none-match' },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.reads).toEqual([]);
  expect(preflight.header('access-control-allow-origin')).toBe('*');
  expect(preflight.header('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
  expect(preflight.header('access-control-allow-headers')).toBe('*');
  expect((await ask('/docs', {}, { method: 'OPTIONS' })).status, 'the site keeps its 405').toBe(405);
});

test('types media by its extension alone, sandboxed and unsniffed', async () => {
  const stored = { 'media/a.svg': { body: '<svg/>', contentType: 'text/html' }, 'media/b.constructor': { body: 'x' }, 'media/c.__proto__': { body: 'x' }, 'media/d.PNG': { body: 'x' } };
  const types = await Promise.all(['/media/a.svg', '/media/b.constructor', '/media/c.__proto__', '/media/d.PNG'].map(async (path) => (await ask(path, stored)).header('content-type')));
  expect(types).toEqual(['image/svg+xml', 'application/octet-stream', 'application/octet-stream', 'image/png']);
  const svg = await ask('/media/a.svg', stored);
  expect(svg.header('content-security-policy')).toMatch(/^sandbox; default-src 'none'(;|$)/);
  expect(svg.header('x-content-type-options')).toBe('nosniff');
  expect(svg.header('access-control-allow-origin')).toBeNull();
});
