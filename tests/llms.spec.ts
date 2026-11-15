// What an agent reads without JavaScript, as the build serves it: llms.txt, each docs page's Markdown, each registry
// item's reference page and the Open Knowledge Format indexes, from scripts/llms/. The build itself fails a page that
// keeps a live control or skips a heading level; these read what it wrote.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { checkHeadings, withoutCode } from '../scripts/llms/markdown.mjs';

test.skip(({ isMobile }) => isMobile, 'Files read the same at every width: one project is enough.');

const SITE = 'https://lede.cloudcompute.com';
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const registry = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: { name: string; title: string }[] };
const PAGES = ['/overview.md', '/foundations.md', '/components.md', '/blocks.md', '/blocks/data-table.md', '/layouts.md', '/decisions.md', '/integrations.md'];
/** The SPA shell, which a server without the file could answer with. */
const SHELL = /<div id="root"|^\s*<!doctype html/i;

/** Each link on this site, as its path and fragment. */
const siteLinks = (markdown: string) =>
  [...markdown.matchAll(/\]\((https:\/\/lede\.cloudcompute\.com[^)\s]*)\)/g)].map((m) => new URL(m[1]));
/** A heading's fragment as GitHub writes it: lowercase, punctuation gone, spaces as hyphens. */
const slug = (heading: string) => heading.toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');

// Plain text, `.md` included: a fetch tool that reads text/markdown as HTML drops the JSX in the code blocks.
async function read(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  const body = await response.text();
  expect(response.status(), path).toBe(200);
  expect(response.headers()['content-type'], path).toBe('text/plain; charset=utf-8');
  expect(body, path).not.toMatch(SHELL);
  return body;
}

/** OKF reserves `index.md` in every folder for that folder's index (§3.1). */
const isIndex = (path: string) => /(^|\/)index\.md$/.test(path);
/** OKF's index files: the root's, and the reference pages' folder's. */
const INDEXES = ['/index.md', '/reference/index.md'];

/** A Markdown file's YAML front matter, parsed, and the body after it. */
function split(file: string, path: string) {
  const match = file.match(/^---\n([\s\S]*?\n)---\n\n/);
  expect(match, `${path} opens with front matter`).not.toBeNull();
  return { meta: parse(match![1]) as Record<string, unknown>, body: file.slice(match![0].length) };
}

test('llms.txt names this version and every file it links on this site is served, without JavaScript', async ({ request }) => {
  const llms = await read(request, '/llms.txt');
  expect(llms).toContain(`Lede ${version} is`);
  // /r/v<version>/ and /r/next/ come from the Worker's bucket, which a build doesn't hold.
  const files = siteLinks(llms).map((url) => url.pathname).filter((path) => /\.[A-Za-z0-9]+$/.test(path) && !/^\/r\/(v\d|next\/)/.test(path));
  expect(files).toEqual(expect.arrayContaining(['/r/registry.json', '/llms-full.txt', '/components.md']));
  for (const path of files) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).not.toMatch(/^text\/html/);
  }
  // A Markdown file the build doesn't have is a 404, as on the site.
  expect((await request.get('/reference/nope.md')).status()).toBe(404);
});

test('the site serves Markdown as plain text through public/_headers, which the preview server doesn’t read', () => {
  expect(readFileSync('public/_headers', 'utf8')).toMatch(/^\/\*\.md\n {2}Content-Type: text\/plain; charset=utf-8$/m);
});

/** Every concept file (each Markdown file but an index) reachable from llms.txt, as served, by path. */
async function concepts(request: APIRequestContext) {
  const files = new Map<string, string>();
  const queue = ['/llms.txt'];
  while (queue.length) {
    const path = queue.shift()!;
    const file = await read(request, path);
    if (path.endsWith('.md')) files.set(path, file);
    for (const { pathname } of siteLinks(file)) {
      if (!pathname.endsWith('.md') || isIndex(pathname) || files.has(pathname) || queue.includes(pathname)) continue;
      queue.push(pathname);
    }
  }
  return files;
}
const headingsOf = (body: string) => [...withoutCode(body).matchAll(/^ {0,3}#{1,6} (.*)$/gm)].map((m) => slug(m[1]));

test('every concept reachable from llms.txt has OKF front matter, then its one h1, and its fragments match a heading', async ({ request }) => {
  const bodies = new Map<string, string>();
  for (const [path, file] of await concepts(request)) {
    const { meta, body } = split(file, path);
    expect(typeof meta.type === 'string' && meta.type.length > 0, `${path}: type`).toBe(true);
    expect(meta.lede_version, path).toBe(version);
    expect(body.split('\n')[0], path).toMatch(/^# \S/);
    expect(withoutCode(body).match(/^ {0,3}# /gm), path).toHaveLength(1);
    bodies.set(path, body);
  }
  for (const path of PAGES) expect(bodies.has(path), path).toBe(true);
  for (const item of registry.items) expect(bodies.has(`/reference/${item.name}.md`), item.name).toBe(true);
  for (const [path, body] of bodies) {
    // A fragment on this site, or one in the same file, such as Limits in the home page's install section.
    const links = [
      ...siteLinks(body).filter((url) => url.hash && url.pathname.endsWith('.md')).map((url) => ({ target: url.pathname, hash: url.hash.slice(1) })),
      ...[...body.matchAll(/\]\(#([^)\s]+)\)/g)].map((m) => ({ target: path, hash: m[1] })),
    ];
    for (const { target, hash } of links) expect(headingsOf(bodies.get(target)!), `${path} → ${target}#${hash}`).toContain(hash);
  }
});

// Its three rules (§11): each concept has front matter with a type; each index follows §8, front matter only at the root
// and only okf_version (§12); and here, each index entry resolves and every concept is listed.
test('the Markdown files are an Open Knowledge Format v0.2 bundle', async ({ request }) => {
  const files = await concepts(request);
  for (const [path, file] of files) {
    const { type } = split(file, path).meta;
    expect(typeof type === 'string' && type.length > 0, `${path}: type`).toBe(true);
  }
  const listed = new Set<string>();
  for (const path of INDEXES) {
    const file = await read(request, path);
    let body = file;
    if (path === '/index.md') {
      const parts = split(file, path);
      expect(parts.meta, path).toEqual({ okf_version: '0.2' });
      body = parts.body;
    } else {
      expect(file, `${path} has no front matter`).not.toMatch(/^---\n/);
    }
    const folder = `https://lede.test${path.replace(/index\.md$/, '')}`;
    for (const line of body.split('\n')) {
      if (line === '' || /^#{1,6} \S/.test(line)) continue;
      const entry = line.match(/^\* \[([^\]]+)\]\(([^)\s]+)\) - (\S.*)$/);
      expect(entry, `${path}: a line that is neither a heading nor an entry: ${line}`).not.toBeNull();
      const [, , href, description] = entry!;
      expect(href, `${path}: ${href} is relative`).not.toMatch(/^(\/|[a-z]+:)/);
      const target = new URL(href, folder).pathname;
      expect((await request.get(target)).status(), `${path} → ${target}`).toBe(200);
      listed.add(target);
      // Each description is the linked concept's own (§8).
      if (files.has(target)) expect(description, target).toBe(split(files.get(target)!, target).meta.description);
    }
  }
  for (const path of files.keys()) expect(listed.has(path), `${path} is in an index`).toBe(true);
  expect(listed.has('/reference/index.md')).toBe(true);
});

test('front matter names each page: a Guide for a docs page, the item’s kind for a reference page', async ({ request }) => {
  const { meta } = split(await read(request, '/blocks/data-table.md'), '/blocks/data-table.md');
  expect(meta).toEqual({
    type: 'Guide', title: 'Data table', description: expect.stringMatching(/^DataTable and `useServerRows`: .*\.$/),
    resource: `${SITE}/blocks/data-table`, lede_version: version,
  });
  const list = split(await read(request, '/reference/list.md'), '/reference/list.md').meta;
  expect(list).toEqual({
    type: 'Component', title: 'ListGroup, ListRow', description: expect.stringMatching(/^ListGroup is a `<section>`.*\.$/),
    resource: `${SITE}/r/v${version}/list.json`, tags: ['component', 'list'], lede_version: version,
  });
  expect(split(await read(request, '/reference/inbox.md'), '/reference/inbox.md').meta).toMatchObject({ type: 'Hero flow', tags: ['hero flow', 'inbox'] });
  // llms-full.txt separates its sections with ---, so it leaves the blocks out.
  expect(await read(request, '/llms-full.txt')).not.toMatch(/^---\ntype: /m);
});

test('llms.txt links every registry item’s reference page with its import line', async ({ request }) => {
  const llms = await read(request, '/llms.txt');
  for (const item of registry.items) {
    expect(llms, item.name).toContain(`](${SITE}/reference/${item.name}.md): \`@lede/${item.name}\``);
  }
  expect(llms).toContain("`import { ListGroup, ListRow } from '@/components/lede/list';`");
});

test('each sample’s code reads character for character on its reference page, and on a docs page that links it', async ({ request }) => {
  const pages = await Promise.all(PAGES.map((path) => read(request, path)));
  for (const item of registry.items) {
    const sample = `src/pages/docs/samples/${item.name}.tsx`;
    let code: string;
    try { code = readFileSync(sample, 'utf8'); } catch { continue; }
    const fenced = `\`\`\`tsx\n${code.trim()}\n\`\`\``;
    expect(await read(request, `/reference/${item.name}.md`), item.name).toContain(fenced);
    // A sample no docs page links yet, such as a hero flow's, reads on its reference page alone. Layouts links an item
    // without its sample, so one linking page is enough.
    const linking = pages.filter((page) => page.includes(`](${SITE}/reference/${item.name}.md)`));
    if (linking.length) expect(linking.some((page) => page.includes(fenced)), item.name).toBe(true);
  }
});

test('a reference page lists its types, and llms-full.txt leaves them out and links them', async ({ request }) => {
  const page = await read(request, '/reference/data-table.md');
  expect(page).toMatch(/^## Types$/m);
  expect(page).toContain('export declare function DataTable<Row>');
  const full = await read(request, '/llms-full.txt');
  expect(full).not.toMatch(/^## Types$/m);
  expect(full).toContain(`Its types: ${SITE}/reference/data-table.md#types`);
});

test('a fence indented in a list item hides its # lines from the heading check', () => {
  const markdown = '# Install\n\n1. Add it.\n\n   ```bash\n   # a comment, not a heading\n   npx shadcn@latest add @lede/button\n   ```\n';
  expect(withoutCode(markdown).match(/^ {0,3}# /gm)).toHaveLength(1);
  expect(() => checkHeadings(markdown, '/case.md')).not.toThrow();
});
