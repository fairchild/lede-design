// A registry item's reference page, /reference/<item>.md: what it is, how to install and import it, what each of its
// files exports, its props, its sample and its declarations.
import { propsTable, titledComponents } from '../item-docs.mjs';
import { SITE, fence } from './markdown.mjs';

/** Where a file installs, as a project imports it: `components/lede/list.tsx` is `@/components/lede/list`. */
export const importPath = (target) => `@/${target.replace(/\.tsx?$/, '')}`;
const isCode = (file) => /\.tsx?$/.test(file.path);

/** The item's import line for each file that exports a name in its title, or null for an item with no code to import. */
export function importLines(item, exports) {
  const byFile = new Map();
  for (const name of item.title.split(',').map((title) => title.trim())) {
    const file = item.files.find((f) => exports.get(f.path)?.some((e) => e.name === name && !e.from));
    if (file) byFile.set(file.target, [...(byFile.get(file.target) ?? []), name]);
  }
  return byFile.size ? [...byFile].map(([target, names]) => `import { ${names.join(', ')} } from '${importPath(target)}';`).join('\n') : null;
}

const KIND = { 'registry:component': 'Component', 'registry:lib': 'Library', 'registry:style': 'Stylesheet' };
/** What the item is, as its page's front matter names it: Component, Block, Hero flow, Library or Stylesheet. */
const kindOf = (item) => KIND[item.type] ?? (item.categories?.includes('flows') ? 'Hero flow' : 'Block');
/** A registry description's first sentence. */
export const firstSentence = (text) => text.replace(/\s+/g, ' ').trim().split(/(?<=\.)\s/)[0];
/** "a, b and c": Lede's lists have no serial comma. */
const listed = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join(''));
const fileName = (path) => path.replace(/^.*\//, '');

/**
 * @returns {{ meta: object, body: string, types: string }} the page's front matter, the page without its Types section,
 *   which `llms-full.txt` holds, and that section. The page is the three joined.
 */
export function referencePage(item, { version, api, exports, declarations, install, sample, pages }) {
  const items = (item.registryDependencies ?? []).map((dep) => dep.replace(/^@lede\//, ''));
  const brings = [
    ...(items.length ? [`the items ${listed(items.map((name) => `[\`${name}\`](${SITE}/reference/${name}.md)`))}`] : []),
    ...(item.dependencies?.length ? [`the npm packages ${listed(item.dependencies.map((dep) => `\`${dep}\``))}`] : []),
  ];
  const imports = importLines(item, exports);
  const files = item.files.map((file) => {
    const names = (exports.get(file.path) ?? []).map((e) => `\`${e.name}\` (${e.kind}${e.from ? `, from \`${fileName(e.from)}\`` : ''})`);
    return `| \`${file.target}\` | ${isCode(file) ? `\`${importPath(file.target)}\`` : ''} | ${isCode(file) ? names.join(', ') : 'Stylesheet'} |`;
  });
  const components = titledComponents(item, api);
  const props = components.map((name) => {
    const { description } = api.get(name);
    return `## ${components.length > 1 ? `${name} props` : 'Props'}\n\n${description ? `${description}\n\n` : ''}${propsTable(api.get(name))}`;
  });
  const body = [
    `# ${item.title}`,
    `> Every docs page and registry item: ${SITE}/llms.txt`,
    item.description.replace(/\s+/g, ' ').trim(),
    '## Install',
    fence(install, 'bash'),
    `The command needs Lede's registry in \`components.json\`, as [Overview → Install](${SITE}/overview.md) shows.${brings.length ? ` It also installs ${brings.join(', and ')}.` : ''} The item's JSON, with each file's source, is ${SITE}/r/v${version}/${item.name}.json.`,
    ...(imports ? ['## Import', fence(imports, 'tsx')] : []),
    '## Files and exports',
    `| Installs to | Import from | Exports |\n| --- | --- | --- |\n${files.join('\n')}`,
    ...props,
    ...(sample ? ['## Example', 'The smallest working use, from the docs site:', fence(sample.trim(), 'tsx')] : []),
    ...(pages.length ? [`Docs: ${listed(pages.map((page) => `[${page.title}](${SITE}${page.path})`))}.`] : []),
  ].join('\n\n');
  const declared = item.files.filter(isCode).map((file) => {
    const text = declarations.get(file.path.replace(/^registry\/lede\//, '').replace(/\.tsx?$/, ''));
    return text ? `// ${file.target}\n${text.trim()}` : null;
  }).filter(Boolean);
  const types = declared.length ? `## Types\n\nThe declarations of each file, with their doc comments:\n\n${fence(declared.join('\n\n'), 'ts')}` : '';
  const kind = kindOf(item);
  const meta = {
    type: kind,
    title: item.title,
    description: firstSentence(item.description),
    resource: `${SITE}/r/v${version}/${item.name}.json`,
    tags: [kind.toLowerCase(), item.name],
    lede_version: version,
  };
  return { meta, body: `${body}\n`, types: types && `${types}\n` };
}
