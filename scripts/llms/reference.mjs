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
const listed = (parts, and = 'and') => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${and} ${parts.at(-1)}` : parts.join(''));
const fileName = (path) => path.replace(/^.*\//, '');
const itemLink = (name, fragment = '') => `[\`${name}\`](${SITE}/reference/${name}.md${fragment})`;

/**
 * The sentence beside a props table that says which props it leaves out: the attributes or props a component takes
 * from outside Lede, as `readApi` reads them from its props type.
 */
export function inheritedSentence(name, { from, example, added }) {
  const whole = from.filter((source) => !source.names);
  const elements = [...new Set(whole.filter((source) => source.element).map((source) => `\`<${source.element}>\``))];
  const parts = [
    ...(elements.length ? [`the attributes of ${listed(elements, 'or')}${elements.length > 1 ? ', whichever it renders' : ''}`]
      : whole.some((source) => 'element' in source) ? ['HTML attributes'] : []),
    ...whole.filter((source) => source.component).map((source) => `the props of \`${source.component}\`${source.module ? ` from \`${source.module}\`` : ''}`),
  ];
  const picked = from.filter((source) => source.names?.length)
    .map((source) => `the ${listed(source.names.map((attribute) => `\`${attribute}\``))} attributes of ${source.element ? `\`<${source.element}>\`` : 'its element'}`);
  const via = whole.find((source) => source.via);
  const extra = via && added.length
    ? [`the ${listed(added.map((prop) => `\`${prop}\``))} prop${added.length > 1 ? 's' : ''} of \`${via.via}\` from \`${via.module}\``]
    : [];
  const takes = [...(parts.length ? [`${listed(parts)}${example ? `, such as \`${example}\`` : ''}`] : []), ...extra, ...picked];
  return `${name} also takes ${takes.join(', and ')}.`;
}

/**
 * The types another item declares that a page names, as a list: each written out when it's short, and linked to the
 * reference page that declares it.
 */
function otherItemsTypes(lead, keys, item, { types, owners }) {
  const shown = [...new Set(keys)].map((key) => types.get(key)).filter((type) => owners.has(type.file) && owners.get(type.file) !== item.name);
  if (!shown.length) return '';
  const lines = shown.map(({ name, shape, file }) => {
    const link = itemLink(owners.get(file), '#types');
    return shape ? `- \`${name}\` is \`${shape}\`, declared in ${link}.` : `- \`${name}\` is declared in ${link}.`;
  });
  return `\n\n${lead}\n\n${lines.join('\n')}`;
}

/**
 * @param {object} context `types` and `declarationTypes` come from `readApi`; `owners` maps each registry file to its
 *   item, and `forExample` lists the items the install command holds only because the sample imports them.
 * @returns {{ meta: object, body: string, types: string }} the page's front matter, the page without its Types section,
 *   which `llms-full.txt` holds, and that section. The page is the three joined.
 */
export function referencePage(item, context) {
  const { version, api, exports, declarations, declarationTypes, install, forExample, sample, pages } = context;
  const items = (item.registryDependencies ?? []).map((dep) => dep.replace(/^@lede\//, ''));
  const brings = [
    ...(items.length ? [`the items ${listed(items.map((name) => itemLink(name)))}`] : []),
    ...(item.dependencies?.length ? [`the npm packages ${listed(item.dependencies.map((dep) => `\`${dep}\``))}`] : []),
  ];
  const imports = importLines(item, exports);
  const files = item.files.map((file) => {
    const names = (exports.get(file.path) ?? []).map((e) => `\`${e.name}\` (${e.kind}${e.from ? `, from \`${fileName(e.from)}\`` : ''})`);
    return `| \`${file.target}\` | ${isCode(file) ? `\`${importPath(file.target)}\`` : ''} | ${isCode(file) ? names.join(', ') : 'Stylesheet'} |`;
  });
  const components = titledComponents(item, api);
  const props = components.map((name) => {
    const component = api.get(name);
    return `## ${components.length > 1 ? `${name} props` : 'Props'}\n\n${component.description ? `${component.description}\n\n` : ''}${propsTable(component)}${
      component.inherits ? `\n\n${inheritedSentence(name, component.inherits)}` : ''}${
      otherItemsTypes('These props use types from other items:', component.props.flatMap((prop) => prop.types), item, context)}`;
  });
  const body = [
    `# ${item.title}`,
    `> Every docs page and registry item: ${SITE}/llms.txt`,
    item.description.replace(/\s+/g, ' ').trim(),
    '## Install',
    fence(install, 'bash'),
    `The command needs Lede's registry in \`components.json\`, as [Overview → Install](${SITE}/overview.md) shows.${brings.length ? ` It also installs ${brings.join(', and ')}.` : ''}${
      forExample.length ? ` It adds ${listed(forExample.map((name) => itemLink(name)))} only because the example below imports ${forExample.length > 1 ? 'them' : 'it'}.` : ''
    } The item's JSON, with each file's source, is ${SITE}/r/v${version}/${item.name}.json.`,
    ...(imports ? ['## Import', fence(imports, 'tsx')] : []),
    '## Files and exports',
    `| Installs to | Import from | Exports |\n| --- | --- | --- |\n${files.join('\n')}`,
    ...props,
    ...(sample ? ['## Example', 'The smallest working use, from the docs site:', fence(sample.trim(), 'tsx')] : []),
    ...(pages.length ? [`Docs: ${listed(pages.map((page) => `[${page.title}](${SITE}${page.path})`))}.`] : []),
  ].join('\n\n');
  const modules = item.files.filter(isCode).map((file) => file.path.replace(/^registry\/lede\//, '').replace(/\.tsx?$/, ''));
  const declared = item.files.filter(isCode).map((file, i) => {
    const text = declarations.get(modules[i]);
    return text ? `// ${file.target}\n${text.trim()}` : null;
  }).filter(Boolean);
  const types = declared.length
    ? `## Types\n\nThe declarations of each file, with their doc comments:\n\n${fence(declared.join('\n\n'), 'ts')}${
      otherItemsTypes('These declarations use types from other items:', modules.flatMap((module) => declarationTypes.get(module) ?? []), item, context)}`
    : '';
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
