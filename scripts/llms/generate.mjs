// Every file the docs site serves for readers without JavaScript: each docs page's Markdown, each registry item's
// reference page, the two Open Knowledge Format indexes (index.md and reference/index.md), llms.txt from its template
// and llms-full.txt. Built from the same pages and registry the site renders, so neither can drift from the other.
// scripts/llms/vite-plugin.mjs runs it in every build and in the dev server.
import { existsSync, readFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { fileURLToPath } from 'node:url';
import { readApi } from '../design-system-api.mjs';
import { SITE, checkHeadings, createConverter, twinPath } from './markdown.mjs';
import { PAGES, renderPage } from './pages.mjs';
import { firstSentence, importLines, referencePage } from './reference.mjs';

const TEMPLATE = fileURLToPath(new URL('./llms.md', import.meta.url));
const read = (path) => readFileSync(path, 'utf8');
/**
 * A YAML front-matter block, so each Markdown file is an Open Knowledge Format concept: `type` is the one key OKF
 * requires. No timestamp, so a build of the same source writes the same bytes.
 */
const frontMatter = (meta) => `---\n${stringify(meta, { lineWidth: 0 })}---\n\n`;
const sentence = (text) => `${text[0].toUpperCase()}${text.slice(1)}.`;
/** A file's size as served, in whole kilobytes of UTF-8, and at least 1. */
const kilobytes = (text) => Math.max(1, Math.round(Buffer.byteLength(text, 'utf8') / 1024));

/** The item sections of llms.txt, in this order. */
export const GROUPS = [
  ['Components', (item) => item.type === 'registry:component'],
  ['Blocks', (item) => item.categories?.includes('blocks')],
  ['Hero flows', (item) => item.categories?.includes('flows')],
  ['Styles and libraries', () => true],
];

/**
 * @param {(id: string) => Promise<Record<string, any>>} load a Vite server's `ssrLoadModule`, with the site's aliases
 * @returns {Promise<Map<string, string>>} each file's content, by its path in the build
 */
export async function generate(load) {
  const { version } = JSON.parse(read('package.json'));
  const registry = JSON.parse(read('registry.json'));
  const { api, declarations, exports, types, declarationTypes } = readApi([...new Set(registry.items.flatMap((item) => item.files.map((f) => f.path)).filter((p) => /\.tsx?$/.test(p)))]);
  const owners = new Map(registry.items.flatMap((item) => item.files.map((file) => [file.path, item.name])));
  const imports = Object.fromEntries(registry.items.map((item) => [item.name, importLines(item, exports)]).filter(([, line]) => line));
  const files = new Map();

  const convert = createConverter(new Set(PAGES.map((page) => page.route)));
  const twins = [];
  for (const page of PAGES) {
    const markdown = convert(await renderPage(load, page, { imports }), page.route);
    checkHeadings(markdown, page.route);
    const [h1, ...rest] = markdown.split('\n');
    const path = twinPath(page.route);
    const text = `${h1}\n\n> Every docs page and registry item: ${SITE}/llms.txt\n${rest.join('\n')}\n`;
    const meta = { type: 'Guide', title: page.title, description: sentence(page.about), resource: `${SITE}${page.route}`, lede_version: version };
    twins.push({ ...page, path, text, meta });
    files.set(path.slice(1), frontMatter(meta) + text);
  }

  const { itemsToInstall, installCommand } = await load('/src/pages/docs/Usage.tsx');
  const references = registry.items.map((item) => {
    const samplePath = `src/pages/docs/samples/${item.name}.tsx`;
    const sample = existsSync(samplePath) ? read(samplePath) : null;
    const pages = twins.filter((twin) => twin.text.includes(`${SITE}/reference/${item.name}.md`));
    // The sample's imports can add items to the command; `itemsToInstall` puts them after the item itself.
    const [, ...forExample] = itemsToInstall([item.name], sample ?? '');
    const install = installCommand([item.name, ...forExample]);
    const page = referencePage(item, { version, api, exports, declarations, declarationTypes, types, owners, install, forExample, sample, pages });
    checkHeadings(page.body + page.types, `/reference/${item.name}.md`);
    files.set(`reference/${item.name}.md`, frontMatter(page.meta) + (page.types ? `${page.body}\n${page.types}` : page.body));
    return { item, ...page };
  });

  const placed = new Set();
  const groups = GROUPS.map(([title, test]) => {
    const items = references.filter(({ item }) => !placed.has(item.name) && test(item));
    items.forEach(({ item }) => placed.add(item.name));
    return { title, items };
  });
  const sections = groups.map(({ title, items }) => {
    const lines = items.map(({ item }) => `- [${item.title}](${SITE}/reference/${item.name}.md): \`@lede/${item.name}\`${imports[item.name] ? `, \`${imports[item.name].replace(/\n/g, ' ')}\`` : ''}. ${firstSentence(item.description)}`);
    return `## ${title}\n\n${lines.join('\n')}`;
  });
  const template = read(TEMPLATE)
    .replaceAll('{{VERSION}}', version)
    // Functions, so a `$` in a description stays a `$`: a replacement string would read `$&` and `$$` as patterns.
    .replace('{{DOCS}}', () => twins.map((twin) => `- [${twin.title}](${SITE}${twin.path}): ${twin.about}`).join('\n'))
    .replace('{{ITEMS}}', () => sections.join('\n\n'));

  // OKF's index files (§8): no front matter but the root's okf_version, then only headed lists of
  // `* [title](relative path) - description`, each description the linked file's own.
  const entry = (title, href, description) => `* [${title}](${href}) - ${description}`;
  const section = (title, lines) => `# ${title}\n\n${lines.join('\n')}`;
  const itemSections = (prefix) => groups.map(({ title, items }) => section(title, items.map(({ item, meta }) => entry(meta.title, `${prefix}${item.name}.md`, meta.description))));
  files.set('index.md', `${frontMatter({ okf_version: '0.2' })}${[
    section('Docs', twins.map((twin) => entry(twin.meta.title, twin.path.slice(1), twin.meta.description))),
    ...itemSections('reference/'),
    section('Other indexes', [
      entry('Reference pages', 'reference/index.md', 'Every registry item\'s reference page, by group.'),
      entry('llms.txt', 'llms.txt', `Every docs page and reference page, with Lede ${version}, the registry indexes and the repo's Markdown files.`),
    ]),
  ].join('\n\n')}\n`);
  files.set('reference/index.md', `${itemSections('').join('\n\n')}\n`);

  // Without the indexes, and without front matter, whose `---` would read as the separators here. Types stay on each
  // reference page: they would double the file.
  const fullOf = (llms) => [
    llms,
    ...twins.map((twin) => twin.text),
    ...references.map(({ item, body, types }) => (types ? `${body}\nIts types: ${SITE}/reference/${item.name}.md#types\n` : body)),
  ].map((text) => text.trim()).join('\n\n---\n\n') + '\n';

  // llms.txt prints the size of each file its Start here section links, so a reader can tell what fits before it
  // fetches. llms-full.txt holds llms.txt, so its size is settled by writing both until the printed size stands.
  const referenceSizes = references.map(({ item }) => kilobytes(files.get(`reference/${item.name}.md`)));
  const sizes = (fullSize) => template.replace(/\{\{SIZE ([^}]+)\}\}/g, (_, name) => {
    if (name === 'reference') return `${Math.min(...referenceSizes)} to ${Math.max(...referenceSizes)} KB`;
    if (name === '/llms-full.txt') return `${fullSize} KB`;
    if (!files.has(name.slice(1))) throw new Error(`scripts/llms/llms.md asks the size of ${name}, which the build doesn't write.`);
    return `${kilobytes(files.get(name.slice(1)))} KB`;
  });
  let llms = sizes(0);
  for (let pass = 0; pass < 4 && llms !== (llms = sizes(kilobytes(fullOf(llms)))); pass += 1);
  if (llms !== sizes(kilobytes(fullOf(llms)))) throw new Error('llms.txt: the size of llms-full.txt did not settle.');
  files.set('llms.txt', llms);
  files.set('llms-full.txt', fullOf(llms));
  return files;
}
