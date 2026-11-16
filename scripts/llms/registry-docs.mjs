// Puts Lede's docs inside the registry, so they install with the code and match its release. After `shadcn build`,
// each item's JSON in public/r gains its reference page as a file that lands at components/lede/docs/<item>.md, and
// `lede-theme`, which nearly every item brings, gains components/lede/docs/README.md: the README's setup sections and a
// list of every item. An agent whose sandbox can't reach the docs site reads them where the CLI put them.
//
//   node scripts/llms/registry-docs.mjs [registry dir]   (default public/r)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, loadConfigFromFile } from 'vite';
import { GROUPS, generate } from './generate.mjs';
import { SITE } from './markdown.mjs';
import { firstSentence } from './reference.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPO = 'https://github.com/fairchild/lede-design';
/** Where the docs land in a project, beside the components: under `src/` when the project has one. */
export const DOCS_DIR = 'components/lede/docs';
/** The item that carries the guide: every item but `lede-utils` installs it. */
const GUIDE_ITEM = 'lede-theme';
/** The README's sections the guide holds, in order. */
const README_SECTIONS = ['Use it in a shadcn project', 'components.json', "Tailwind and Lede's classes", 'Limits'];

/** Every item a CLI install of `name` brings in, itself included. */
function closure(name, byName, seen = new Set()) {
  if (seen.has(name) || !byName.has(name)) return seen;
  seen.add(name);
  for (const dep of byName.get(name).registryDependencies ?? []) closure(dep.replace(/^@lede\//, ''), byName, seen);
  return seen;
}

/**
 * A reference page as it reads inside a project: its links to the reference pages of items installed with it point at
 * their files beside it, and its opening line names the guide.
 */
export function vendoredPage(page, item, installed, version) {
  const site = SITE.replace(/\./g, '\\.');
  return page
    .replace(new RegExp(`${site}/reference/([a-z0-9-]+)\\.md`, 'g'), (url, name) => (installed.has(name) ? `${name}.md` : url))
    .replace(`[Overview → Install](${SITE}/overview.md)`, (link) => (installed.has(GUIDE_ITEM) ? '[README.md](README.md#use-it-in-a-shadcn-project)' : link))
    .replace(`> Every docs page and registry item: ${SITE}/llms.txt`, `> Lede ${version}'s docs for ${item.title}, installed with it. ${installed.has(GUIDE_ITEM)
      ? 'Setup, and every item in the release: [README.md](README.md).' : `Every docs page and registry item: ${SITE}/llms.txt.`} Online: ${SITE}/reference/${item.name}.md`);
}

/** A `## ` section of the README with its heading, its relative links pointing at the repo. */
function readmeSection(readme, heading) {
  const body = readme.split(new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))[1]?.split(/^## /m)[0];
  if (body === undefined) throw new Error(`registry-docs: the README has no "## ${heading}" section`);
  // Fenced code keeps its text; only prose links change.
  const linked = body.split(/(^```[\s\S]*?^```)/m).map((part, i) => (i % 2 ? part
    : part.replace(/\]\((?!https?:|#|mailto:)([^)]+)\)/g, (_, path) => (path.startsWith('README.md#')
      // A link to another of these sections stays in the guide.
      ? `](${path.slice('README.md'.length)})` : `](${REPO}/blob/main/${path.replace(/^\.\//, '')})`)))).join('');
  return `## ${heading}\n${linked.trimEnd()}`;
}

/** The guide: what these files are, every item of the release by group, then the README's setup sections. */
export function guide({ version, registry, readme }) {
  const placed = new Set();
  const groups = GROUPS.map(([title, test]) => {
    const items = registry.items.filter((item) => !placed.has(item.name) && test(item));
    items.forEach((item) => placed.add(item.name));
    return `### ${title}\n\n${items.map((item) => `- [${item.title}](${item.name}.md), \`@lede/${item.name}\`: ${firstSentence(item.description)}`).join('\n')}`;
  });
  return [
    '---',
    'type: Guide',
    `title: Lede ${version} in this project`,
    `lede_version: ${version}`,
    '---',
    '',
    `# Lede ${version} in this project`,
    '',
    `The shadcn CLI put these files here with Lede's registry items. Each item installs its reference page as \`<item>.md\`: what it is, its import line, its props, a working example and its types, for the release in \`components.json\`. They are the docs at ${SITE}, for a project that can't reach that site.`,
    '',
    `Read an item's page before you use it. A page for an item you haven't installed arrives with \`npx shadcn@latest add @lede/<item>\`, and is online at ${SITE}/reference/<item>.md. Tailwind scans these files for class names like any other, so \`@source not "./components/lede/docs";\` in your global CSS file keeps them out of your stylesheet; its path is relative to that file.`,
    '',
    `## Every item in Lede ${version}`,
    '',
    groups.join('\n\n'),
    '',
    ...README_SECTIONS.map((heading) => `${readmeSection(readme, heading)}\n`),
  ].join('\n');
}

/** Adds the docs files to each item's JSON in `dir`, from the reference pages `generate` writes. */
export function addDocs(dir, files, { version, registry, readme }) {
  const byName = new Map(registry.items.map((item) => [item.name, item]));
  for (const item of registry.items) {
    const path = join(dir, `${item.name}.json`);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    const page = files.get(`reference/${item.name}.md`);
    if (!page) throw new Error(`registry-docs: no reference page for ${item.name}`);
    const docs = [{ name: item.name, content: vendoredPage(page, item, closure(item.name, byName), version) }];
    if (item.name === GUIDE_ITEM) docs.push({ name: 'README', content: guide({ version, registry, readme }) });
    // Rebuilt from shadcn's own output each time, so a second run doesn't add the files twice.
    json.files = [
      ...json.files.filter((file) => !file.target?.startsWith(`${DOCS_DIR}/`)),
      ...docs.map(({ name, content }) => ({ path: `registry/lede/docs/${name}.md`, content, type: 'registry:file', target: `${DOCS_DIR}/${name}.md` })),
    ];
    // The CLI prints this after it installs the item, one line per item.
    json.docs = `Docs for ${item.title}: ${DOCS_DIR}/${item.name}.md${item.name === GUIDE_ITEM ? `. Setup and every item: ${DOCS_DIR}/README.md` : ''}`;
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'public/r';
  const read = (path) => readFileSync(join(ROOT, path), 'utf8');
  const { version } = JSON.parse(read('package.json'));
  // The pages render as in the site's build: Vite's own transform compiles their TSX, with the site's aliases and none
  // of its plugins.
  const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' }, join(ROOT, 'vite.config.ts'));
  const server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: config.resolve.alias },
  });
  try {
    const files = await generate((id) => server.ssrLoadModule(id));
    addDocs(dir, files, { version, registry: JSON.parse(read('registry.json')), readme: read('README.md') });
  } finally {
    await server.close();
  }
}
