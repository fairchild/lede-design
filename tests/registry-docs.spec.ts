import { cpSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
// @ts-expect-error: a build script in plain JavaScript, with no declarations
import { addDocs } from '../scripts/llms/registry-docs.mjs';

// Each registry item carries its docs, so they install with the code: its reference page lands at
// components/lede/docs/<item>.md, and lede-theme brings the guide, components/lede/docs/README.md. Read from public/r,
// the files `npm run build` writes and the release publishes.
type File = { path: string; type: string; target: string; content: string };
type Item = { name: string; title: string; registryDependencies?: string[] };
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const registry = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: Item[] };
const byName = new Map(registry.items.map((item) => [item.name, item]));
const built = (name: string) => JSON.parse(readFileSync(`public/r/${name}.json`, 'utf8')) as { files: File[]; docs?: string };
const docsOf = (name: string) => built(name).files.filter((file) => file.target.startsWith('components/lede/docs/'));
/** The relative `.md` links of a Markdown file, outside its fenced code. */
const mdLinks = (text: string) => [...text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/\]\(([a-z0-9-]+|README)\.md(#[^)]*)?\)/gi)].map((m) => m[1]);
function closure(name: string, seen = new Set<string>()) {
  if (seen.has(name)) return seen;
  seen.add(name);
  for (const dep of byName.get(name)?.registryDependencies ?? []) closure(dep.replace(/^@lede\//, ''), seen);
  return seen;
}

test('every item installs its reference page, whose links to other pages resolve where the CLI puts them', () => {
  for (const item of registry.items) {
    const docs = docsOf(item.name);
    const page = docs.find((file) => file.target === `components/lede/docs/${item.name}.md`);
    expect(page, `${item.name} installs its page`).toBeTruthy();
    expect(page!.type).toBe('registry:file');
    expect(page!.content).toContain(`lede_version: ${version}`);
    expect(page!.content).toContain(`\n# ${item.title}\n`);
    expect(built(item.name).docs).toContain(`components/lede/docs/${item.name}.md`);
    // A relative link names a page installed with this item: its own, an item it brings, or the guide.
    const installed = closure(item.name);
    for (const name of mdLinks(page!.content)) {
      expect(name === 'README' ? installed.has('lede-theme') : installed.has(name), `${item.name}.md links ${name}.md`).toBe(true);
    }
  }
  expect(docsOf('list').find((file) => file.target.endsWith('/list.md'))!.content).toContain('[`lede-theme`](lede-theme.md)');
});

test('lede-theme installs the guide: every item, then the README’s setup sections', () => {
  const guide = docsOf('lede-theme').find((file) => file.target === 'components/lede/docs/README.md')!;
  expect(guide, 'lede-theme installs README.md').toBeTruthy();
  expect(new Set(mdLinks(guide.content))).toEqual(new Set(registry.items.map((item) => item.name)));
  const readme = readFileSync('README.md', 'utf8');
  for (const heading of ['Use it in a shadcn project', 'components.json', "Tailwind and Lede's classes", 'Limits']) {
    expect(guide.content, heading).toContain(`\n## ${heading}\n`);
  }
  // The README's code, such as the components.json example, character for character.
  for (const [code] of readme.split(/^## Use it in a shadcn project$/m)[1].split(/^## Limits$/m)[0].matchAll(/^```[\s\S]*?^```/gm)) {
    expect(guide.content).toContain(code);
  }
  expect(guide.content).not.toMatch(/\]\((?!https?:|#)(?![a-z0-9-]+\.md)[^)]+\)/);
});

test('adding the docs twice leaves one copy of each file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lede-r-'));
  for (const name of readdirSync('public/r')) cpSync(join('public/r', name), join(dir, name));
  const files = new Map(registry.items.map((item) => [`reference/${item.name}.md`, `---\n---\n\n# ${item.title}\n`]));
  const context = { version, registry, readme: readFileSync('README.md', 'utf8') };
  addDocs(dir, files, context);
  addDocs(dir, files, context);
  const once = JSON.parse(readFileSync(join(dir, 'list.json'), 'utf8')) as { files: File[] };
  expect(once.files.map((file) => file.target)).toEqual(['components/lede/list.tsx', 'components/lede/docs/list.md']);
});
