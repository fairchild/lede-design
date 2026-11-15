// What an agent reads without JavaScript, as the build serves it: llms.txt, each docs page's Markdown, each registry
// item's reference page and the Open Knowledge Format indexes, from scripts/llms/. The build itself fails a page that
// keeps a live control or skips a heading level; these read what it wrote.
import { readFileSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';
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

test('the site serves Markdown and text files as UTF-8 plain text through public/_headers, which the preview server doesn’t read', () => {
  const headers = readFileSync('public/_headers', 'utf8');
  expect(headers).toMatch(/^\/\*\.md\n {2}Content-Type: text\/plain; charset=utf-8$/m);
  // llms.txt and llms-full.txt hold curly quotes.
  expect(headers).toMatch(/^\/\*\.txt\n {2}Content-Type: text\/plain; charset=utf-8$/m);
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

/** Every Markdown file in the build the tests' server serves (playwright.config.ts), by path, read from disk. */
const built = () => readdirSync('dist-fixtures', { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.md'))
  .map((file) => `/${file.split(sep).join('/')}`);

// Its three rules (§11): each concept has front matter with a type; each index follows §8, front matter only at the root
// and only okf_version (§12); and here, each index entry resolves and every concept is listed.
test('the Markdown files are an Open Knowledge Format v0.2 bundle', async ({ request }) => {
  const files = await concepts(request);
  // Every Markdown file in the build, not only those llms.txt reaches: a stray one fails here.
  const onDisk = built();
  expect(onDisk.filter(isIndex).sort(), 'the index files in the build').toEqual([...INDEXES].sort());
  for (const path of onDisk) {
    const file = readFileSync(`dist-fixtures${path}`, 'utf8');
    // A line of only spaces is a list item's blank line indented.
    expect(file, `${path} has a line of only spaces`).not.toMatch(/^ +$/m);
    if (isIndex(path)) continue;
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
  for (const path of onDisk.filter((file) => !isIndex(file))) expect(listed.has(path), `${path} is in an index`).toBe(true);
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

/** Each registry item's reference page, as served, by item name. */
async function referencePages(request: APIRequestContext) {
  return new Map(await Promise.all(registry.items.map(async (item) => [item.name, await read(request, `/reference/${item.name}.md`)] as const)));
}
/** A page's sections, each from its `## ` heading to the next. */
const sectionsOf = (page: string) => page.split(/^(?=## )/m).slice(1);
/** The names a reference page's Types section declares. */
const declaredIn = (page: string) =>
  new Set([...(page.split(/^## Types$/m)[1] ?? '').matchAll(/^(?:export )?(?:declare )?(?:type|interface|enum|class) ([A-Z]\w*)/gm)].map((m) => m[1]));
/** A section's list of types from other items: each name, by the item its link names. */
const listedTypes = (section: string) => new Map([...section.matchAll(
  /^- `([A-Z]\w*)[^`]*` is (?:`[^`]*`, )?declared in \[`([\w-]+)`\]\(https:\/\/lede\.cloudcompute\.com\/reference\/([\w-]+)\.md#types\)\.$/gm,
)].map((m) => { expect(m[2]).toBe(m[3]); return [m[1], m[2]] as const; }));

test('a reference page shows each type it names from another item, by the props table that uses it', async ({ request }) => {
  const pages = await referencePages(request);
  const declared = new Map([...pages].map(([name, page]) => [name, declaredIn(page)]));
  /** The item, other than `self`, whose reference page declares the type `name`. */
  const owner = (self: string, name: string) => (declared.get(self)!.has(name) ? null : [...declared].find(([, names]) => names.has(name))?.[0] ?? null);
  let checked = 0;
  for (const [item, page] of pages) {
    for (const section of sectionsOf(page)) {
      const listed = listedTypes(section);
      for (const [name, from] of listed) {
        expect(declared.get(from)!.has(name), `${item}: ${name} is declared in ${from}`).toBe(true);
        expect(declared.get(item)!.has(name), `${item}: ${name} is declared on the page itself`).toBe(false);
      }
      // The names in the props table's Type column, and those the declarations import from another file.
      const named = /^## (\w+ )?[Pp]rops$/m.test(section)
        ? [...section.matchAll(/^\| `[^`]+`(?: \(required\))? \| `((?:[^`\\]|\\.)*)` \|/gm)].flatMap((m) => [...m[1].matchAll(/(?<![.\w])[A-Z]\w*/g)].map((n) => n[0]))
        : /^## Types$/m.test(section)
          ? [...section.matchAll(/^import (?:type )?\{([^}]*)\} from '\.{1,2}\/[^']*';$/gm)].flatMap((m) => m[1].split(',').map((name) => name.trim().replace(/^type /, '').split(' as ')[0]))
          : [];
      for (const name of named) {
        const from = owner(item, name);
        if (!from) continue;
        expect(listed.get(name), `${item}: ${section.split('\n')[0]} names ${name}, from ${from}`).toBe(from);
        checked += 1;
      }
    }
  }
  expect(checked, 'types from other items').toBeGreaterThan(10);

  // A short type is written out, and a long one is only linked.
  const props = sectionsOf(pages.get('data-table')!).find((section) => section.startsWith('## Props'))!;
  const noun = "- `Noun` is `{ one: string; other: string }`, declared in [`selection-bar`](https://lede.cloudcompute.com/reference/selection-bar.md#types).";
  expect(props).toContain(noun);
  expect(props).toContain('- `RowAction` is declared in [`list`](https://lede.cloudcompute.com/reference/list.md#types).');
  expect(pages.get('data-table')!.split(/^## Types$/m)[1]).toContain("- `SortDirection` is `'ascending' | 'descending'`, declared in [`table`]");
  // llms-full.txt leaves the Types sections out and keeps the props tables, so it has the type too.
  expect(await read(request, '/llms-full.txt')).toContain(noun);
});

test('a props table says which attributes it leaves out, beside the table', async ({ request }) => {
  const pages = await referencePages(request);
  expect(pages.get('theme-provider')).toContain('ThemeProvider also takes the attributes of `<div>`, such as `className`.');
  expect(pages.get('card')).toContain('Card also takes the attributes of `<div>`, such as `className`.');
  expect(pages.get('button')).toContain('Button also takes the attributes of `<button>` or `<a>`, whichever it renders, such as `className`.');
  // Switch lists `className` itself, since it goes on the wrapper.
  expect(pages.get('switch')).toContain('Switch also takes the attributes of `<span>`, such as `aria-describedby`.');
  expect(pages.get('data-table')).not.toContain(' also takes ');
  for (const [item, page] of pages) {
    for (const section of sectionsOf(page).filter((s) => / also takes /.test(s))) {
      const [, name, example] = section.match(/^(\w+) also takes .*?(?:, such as `([^`]+)`)?(?:, and .*)?\.$/m) ?? [];
      expect(name, `${item}: the sentence is under a props table`).toBeTruthy();
      expect(section, item).toMatch(new RegExp(`^## (${name} props|Props)$`, 'm'));
      if (example) expect(section, `${item}: ${example} is a row of the table`).not.toContain(`| \`${example}\``);
    }
  }
});

test('an install command that adds an item for the example says which', async ({ request }) => {
  const pages = await referencePages(request);
  expect(pages.get('page-header')).toContain('npx shadcn@latest add @lede/page-header @lede/button');
  expect(pages.get('page-header')).toContain('It adds [`button`](https://lede.cloudcompute.com/reference/button.md) only because the example below imports it.');
  for (const [item, page] of pages) {
    const [, ...extra] = page.match(/^npx shadcn@latest add (.*)$/m)![1].split(' ').map((name) => name.replace(/^@lede\//, ''));
    const adds = page.match(/ It adds (.*) only because the example below imports (?:it|them)\./)?.[1] ?? '';
    expect([...adds.matchAll(/\[`([\w-]+)`\]/g)].map((m) => m[1]), item).toEqual(extra);
  }
});

test('a fence indented in a list item hides its # lines from the heading check', () => {
  const markdown = '# Install\n\n1. Add it.\n\n   ```bash\n   # a comment, not a heading\n   npx shadcn@latest add @lede/button\n   ```\n';
  expect(withoutCode(markdown).match(/^ {0,3}# /gm)).toHaveLength(1);
  expect(() => checkHeadings(markdown, '/case.md')).not.toThrow();
});
