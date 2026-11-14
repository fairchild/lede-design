// What an agent reads without JavaScript, as the build serves it: llms.txt, each docs page's Markdown and each registry
// item's reference page, from scripts/llms/. The build itself fails a page that keeps a live control or skips a heading
// level; these read what it wrote.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { checkHeadings, withoutCode } from '../scripts/llms/markdown.mjs';

test.skip(({ isMobile }) => isMobile, 'Files read the same at every width: one project is enough.');

const SITE = 'https://lede.cloudcompute.com';
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const registry = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: { name: string; title: string }[] };
const PAGES = ['/index.md', '/foundations.md', '/components.md', '/blocks.md', '/blocks/data-table.md', '/layouts.md', '/decisions.md', '/integrations.md'];
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

test('every Markdown file reachable from llms.txt has OKF front matter, then its one h1, and its fragments match a heading', async ({ request }) => {
  const bodies = new Map<string, string>();
  const fragments: URL[] = [];
  const queue = ['/llms.txt'];
  while (queue.length) {
    const path = queue.shift()!;
    const file = await read(request, path);
    let body = file;
    if (path.endsWith('.md')) {
      const parts = split(file, path);
      const { meta } = parts;
      body = parts.body;
      expect(typeof meta.type === 'string' && meta.type.length > 0, `${path}: type`).toBe(true);
      expect(meta.lede_version, path).toBe(version);
      expect(body.split('\n')[0], path).toMatch(/^# \S/);
      expect(withoutCode(body).match(/^ {0,3}# /gm), path).toHaveLength(1);
      bodies.set(path, body);
    }
    for (const url of siteLinks(body)) {
      if (!url.pathname.endsWith('.md')) continue;
      if (url.hash) fragments.push(url);
      if (bodies.has(url.pathname) || queue.includes(url.pathname)) continue;
      queue.push(url.pathname);
    }
  }
  for (const path of PAGES) expect(bodies.has(path), path).toBe(true);
  for (const item of registry.items) expect(bodies.has(`/reference/${item.name}.md`), item.name).toBe(true);
  for (const url of fragments) {
    const headings = [...withoutCode(bodies.get(url.pathname)!).matchAll(/^ {0,3}#{1,6} (.*)$/gm)].map((m) => slug(m[1]));
    expect(headings, `${url.pathname}${url.hash}`).toContain(url.hash.slice(1));
  }
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
