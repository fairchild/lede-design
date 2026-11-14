// Builds the files of Lede's design system on claude.ai into dist-design-system/project/, from this repo:
// tokens/tokens.json, the generated and hand-written CSS, registry.json and the docs site's samples, each rendered to
// static markup by React's server renderer. CONTRIBUTING.md says how to publish the folder.
// Run with `npm run design-system`, which builds the tokens first. To keep the keys the live page added to its index
// (asset groups, its own sections, a renamed title), save the live project/design-system.json and pass its path:
// `npm run design-system -- --index path/to/design-system.json`.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readApi } from './design-system-api.mjs';

const OUT = 'dist-design-system/project';
const SRC = 'scripts/design-system';
const read = (path) => readFileSync(path, 'utf8');
const write = (path, text) => {
  mkdirSync(dirname(join(OUT, path)), { recursive: true });
  writeFileSync(join(OUT, path), text);
};

const pkg = JSON.parse(read('package.json'));
const registry = JSON.parse(read('registry.json'));
const source = JSON.parse(read('tokens/tokens.json'));
const git = (args, fallback) => {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
};
const sha = git('rev-parse --short HEAD', 'unknown');
const branch = git('rev-parse --abbrev-ref HEAD', 'unknown');
const now = new Date().toISOString();
const VERSION = pkg.version;
const REGISTRY_URL = `https://lede.cloudcompute.com/r/v${VERSION}/{name}.json`;
// The design system's own artifact and the canvas of Lede's foundations, named once for the README.
const DESIGN_SYSTEM_URL = 'https://claude.ai/artifact/Cw9GgaD1zxRk9ewxGMHv4x';
const CANVAS_URL = 'https://claude.ai/artifact/7eECQYRQWxSkaJhwRtT4rJ';

// The live index passed with --index, else an earlier build's, keeps its keys, so a re-publish doesn't drop them.
const indexArg = process.argv.indexOf('--index');
const indexPath = indexArg > -1 ? process.argv[indexArg + 1] : join(OUT, 'design-system.json');
if (indexArg > -1 && !(indexPath && existsSync(indexPath))) throw new Error(`--index: no file at ${indexPath}`);
const previousIndex = existsSync(indexPath) ? JSON.parse(read(indexPath)) : null;
rmSync(OUT, { recursive: true, force: true });

// ---- tokens.json, in the shape the design system page reads ------------------------------------------------------
// Every family but type is a list of {name, value, usage}. A value keyed by shape or density takes its first option,
// the default, and its usage names the others. Motion has no family on the page, so it moves to the README.
const keyedNote = (value) =>
  Object.entries(value)
    .map(([option, v]) => `${option} ${v}`)
    .join(' · ');
const entry = ({ name, value, usage }, attribute) => {
  if (typeof value === 'string' || typeof value === 'number') return { name, value: String(value), usage };
  const first = Object.values(value)[0];
  return { name, value: String(first), usage: `${usage ?? ''} By \`${attribute}\`: ${keyedNote(value)}.`.trim() };
};
const tokens = {
  name: 'Lede',
  version: 1,
  color: {
    note: source.color.note,
    themes: source.color.themes,
    tokens: source.color.tokens.map(({ name, value, usage }) => ({ name, value, usage })),
  },
  type: {
    note: source.type.note,
    fonts: source.type.fonts ?? [],
    families: source.type.families,
    groups: source.type.groups,
  },
};
const SKIPPED = ['color', 'type', 'motion'];
for (const [family, fam] of Object.entries(source)) {
  if (!fam?.tokens || SKIPPED.includes(family)) continue;
  // Shadows are themed like colors, so they keep their per-theme values.
  const list = fam.tokens.map((tk) => (family === 'shadow' ? { name: tk.name, value: tk.value, usage: tk.usage } : entry(tk, fam.attribute)));
  if (family === 'radius') {
    // The concentric chain derives in CSS; the page shows its default values beside the seed.
    const seedValue = fam.tokens.find((t) => t.name === 'radius').value;
    const seed = parseFloat(typeof seedValue === 'string' ? seedValue : Object.values(seedValue)[0]);
    const step = parseFloat(fam.tokens.find((t) => t.name === 'radius-step').value);
    const floor = step / 4;
    list.push(
      { name: 'radius-xl', value: `${seed + step}px`, usage: '`--radius` + `--radius-step`. A sheet or a card that holds cards.' },
      { name: 'radius-lg', value: `${seed}px`, usage: '`--radius` itself. ListGroup, Disclosure and Card.' },
      { name: 'radius-md', value: `${Math.max(floor, seed - step)}px`, usage: '`--radius` − one step. A list or card nested one inset deep; menus.' },
      { name: 'radius-sm', value: `${Math.max(floor, seed - step * 1.5)}px`, usage: '`--radius` − one and a half steps. Text fields and rounded buttons.' },
      { name: 'radius-xs', value: `${Math.max(floor, seed - step * 2)}px`, usage: '`--radius` − two steps. Menu items and small rounded buttons.' },
    );
  }
  tokens[family] = { ...(fam.note ? { note: fam.note } : {}), tokens: list };
}
tokens.meta = {
  source: 'github',
  repo: 'fairchild/lede-design',
  ref: `${branch}@${sha}`,
  version: VERSION,
  paths: { tokens: ['tokens/tokens.json'], css: ['registry/lede/lede.components.css', 'registry/lede/lede.blocks.css'], docs: ['README.md', 'src/pages/docs/samples/'] },
  synced: now.slice(0, 10),
};
write('tokens.json', `${JSON.stringify(tokens, null, 1)}\n`);

// ---- components/bundle.css: the whole of Lede's CSS, usable without Tailwind ------------------------------------
// The @theme blocks map tokens to Tailwind utilities and mean nothing to a browser, so they go. The radius chain is
// declared again in lede.components.css, so nothing a component reads is lost.
const tokensCss = read('registry/lede/lede.tokens.css')
  .replace(/@theme[^{]*\{[^}]*\}\n?/g, '')
  .replace(/@custom-variant[^;]*;\n?/g, '');
const bundleCss = [
  `/* Lede ${VERSION} (fairchild/lede-design@${sha}) — every token, component and block style. GENERATED by scripts/build-design-system.mjs. */`,
  tokensCss,
  read('registry/lede/lede.components.css'),
  read('registry/lede/lede.blocks.css'),
].join('\n');
if (/<\/style/i.test(bundleCss)) throw new Error('bundle.css holds "</style", which would end an inline <style>');
write('components/bundle.css', bundleCss);

// ---- components: one card per registry item with a docs sample ---------------------------------------------------
// Props for the samples that take some, so each renders with content.
const ARGS = {
  avatar: { name: 'Sam Rivera' },
  'page-header': { unread: 3, total: 12 },
  'glass-bar': { current: 'home', onShare: () => {} },
  'theme-provider': { children: createElement('p', null, 'The page’s own theme, from the reader’s settings.') },
  card: { available: 42 },
  'step-indicator': { step: 2 },
  'summary-card': { due: 3 },
  table: {
    rows: [
      { quarter: 'Q1', amount: '$12,400' },
      { quarter: 'Q2', amount: '$15,050' },
      { quarter: 'Q3', amount: '$13,920' },
    ],
  },
  'master-detail': {
    messages: [
      { id: 'm1', subject: 'Venue contract', body: 'The venue sent the contract for the March offsite.' },
      { id: 'm2', subject: 'Q3 budget', body: 'Finance needs the revised numbers by Thursday.' },
    ],
    openId: 'm1',
    onArchive: () => {},
  },
  'data-table': {
    items: [
      { id: 'WI-104', title: 'Renew venue contract', amount: 4200 },
      { id: 'WI-105', title: 'Order badges', amount: 380 },
      { id: 'WI-106', title: 'Book caterer', amount: 2650 },
    ],
    onArchive: () => {},
  },
};
const HEIGHT = { 'data-table': 360, 'master-detail': 320, list: 260, table: 220, 'accent-picker': 260, 'form-section': 300, 'text-field': 220, checkbox: 180, 'glass-bar': 160, 'theme-provider': 160 };
// Block containers only: a line break between inline elements, such as two labels, would add a space to the page.
const BLOCK_TAGS = 'section|header|footer|nav|main|aside|article|ul|ol|li|div|fieldset|legend|h[1-6]|p|form|table|thead|tbody|tr|th|td|caption|figure|dl|dt|dd';
const SPLIT = new RegExp(`(?=<\\/?(?:${BLOCK_TAGS})\\b)`);
const OPENING = new RegExp(`^<(?:${BLOCK_TAGS})\\b`);
const CLOSING = new RegExp(`^<\\/(?:${BLOCK_TAGS})\\b`);
const pretty = (html) => {
  // One block element per line, indented by depth; inline content stays on its line.
  const parts = html.split(SPLIT);
  let depth = 0;
  let lastWasClosing = false;
  const lines = [];
  for (const part of parts) {
    if (!part) continue;
    const closing = CLOSING.test(part);
    if (closing) depth = Math.max(0, depth - 1);
    // A closing tag goes on its own line only after block children, so text keeps its element on one line.
    if (closing && lines.length && !lastWasClosing) lines[lines.length - 1] += part;
    else lines.push(`${'  '.repeat(depth)}${part}`);
    lastWasClosing = closing;
    const opening = OPENING.test(part) && !closing;
    if (opening) depth += 1;
  }
  return lines.join('\n');
};

// The samples import `@/components/lede/…`, as a project that installed Lede does; tsconfig.json maps that path to
// registry/lede/ for the typecheck, and the site only reads the samples as text, so the renderer maps it here.
const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  resolve: {
    alias: [
      { find: /^@\/components\/lede\//, replacement: `${process.cwd()}/registry/lede/` },
      { find: /^@lede\//, replacement: `${process.cwd()}/registry/lede/` },
      { find: /^@\//, replacement: `${process.cwd()}/src/` },
    ],
  },
});
const { itemsToInstall, installCommand } = await vite.ssrLoadModule('/src/pages/docs/Usage.tsx');
// Each component's props, doc comment and declarations, read from its source.
const registryFiles = [...new Set(registry.items.flatMap((item) => item.files.map((file) => file.path)).filter((path) => /\.tsx?$/.test(path)))];
const { api, declarations } = readApi(registryFiles);
// The props a component's gallery renders it with, and the states shown after its variants. Every value of each prop
// that takes a set of strings (Button's variant, size, shape and tone) is a variant.
const GALLERY = {
  Button: { base: { children: 'Save' }, states: [['disabled', { disabled: true }]] },
  SegmentedControl: { base: { label: 'Range', options: ['Day', 'Week', 'Month'], defaultValue: 'Week' } },
  Switch: { base: { label: 'Wi-Fi', defaultChecked: true }, states: [['off', { defaultChecked: false }], ['disabled', { disabled: true }]] },
  TextField: { base: { label: 'Email', hint: 'Receipts go here.' }, states: [['error', { error: 'Enter the whole address, like sam@example.com.' }]] },
  Checkbox: { base: { 'aria-label': 'Email me a summary' }, states: [['checked', { defaultChecked: true }], ['indeterminate', { indeterminate: true }], ['disabled', { disabled: true }]] },
  Avatar: { base: { name: 'Sam Rivera' } },
  Card: { base: { children: 'Storage: 42 GB available' } },
  Disclosure: { base: { title: 'This week', summary: '2 decisions need you', children: 'The budget review and the launch date.' }, states: [['open', { defaultOpen: true }]] },
};
const renderGallery = async (componentNames) => {
  const rows = [];
  for (const componentName of componentNames) {
    const spec = GALLERY[componentName];
    const component = api.get(componentName);
    if (!spec || !component) continue;
    const Component = (await vite.ssrLoadModule(`/${component.file}`))[componentName];
    const render = (props) => renderToStaticMarkup(createElement(Component, { ...spec.base, ...props }));
    for (const prop of component.props.filter((p) => p.values)) {
      rows.push({ title: prop.name, items: prop.values.map((value) => ({ label: `${prop.name}="${value}"`, caption: value, markup: render({ [prop.name]: value }) })) });
    }
    if (spec.states) rows.push({ title: 'states', items: spec.states.map(([label, props]) => ({ label, caption: label, markup: render(props) })) });
  }
  return rows;
};
const cards = [];
const quiet = console.error;
console.error = () => {}; // React's development warnings (keys, effects) aren't about the markup.
try {
  for (const item of registry.items) {
    const samplePath = `src/pages/docs/samples/${item.name}.tsx`;
    if (!existsSync(samplePath)) continue;
    const mod = await vite.ssrLoadModule(`/${samplePath}`);
    // A sample's component is its one PascalCase function export; a module namespace lists exports alphabetically, so
    // "the first function" could be a helper.
    const components = Object.entries(mod).filter(([key, v]) => typeof v === 'function' && /^[A-Z]/.test(key));
    if (components.length !== 1) throw new Error(`${samplePath}: expected one component export, found ${components.map(([key]) => key).join(', ') || 'none'}`);
    const [[exportName, Sample]] = components;
    const markup = renderToStaticMarkup(createElement(Sample, ARGS[item.name] ?? {}));
    const name = item.title.split(',')[0].trim();
    const group = item.type === 'registry:component' ? 'Components' : 'Blocks';
    const code = read(samplePath).trim();
    const componentNames = item.title.split(',').map((title) => title.trim()).filter((title) => api.has(title));
    const gallery = await renderGallery(componentNames);
    cards.push({ item, name, group, exportName, markup, code, componentNames, gallery, install: installCommand(itemsToInstall([item.name], code)) });
  }
} finally {
  console.error = quiet;
  await vite.close();
}

const summary = (text) => text.replace(/\s+/g, ' ').trim();
// A sample that renders ThemeProvider pins the server's default, light, on its outermost wrapper. The preview drops it
// there, so the card follows the page's theme switch; a nested ThemeProvider with its own scheme keeps it.
const followFrameTheme = (markup) => markup.replace(/^(<div class="ld-theme") data-theme="light"/, '$1');
const cell = (text) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const propsTable = ({ props }) =>
  props.length
    ? ['| Prop | Type | Default | Description |', '| --- | --- | --- | --- |',
      ...props.map((p) => `| \`${p.name}\`${p.optional ? '' : ' (required)'} | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ''} | ${cell(p.description)} |`)].join('\n')
    : 'Only the HTML attributes of the element it renders.';
// What a keyboard and a screen reader meet in the rendered markup. Each line names the native behavior of an element
// or role the component writes, so it holds for the HTML copy too.
const KEYBOARD = [
  [/<button\b/, '`<button>`: Tab reaches it; Enter and Space press it.'],
  [/<a\b[^>]*\shref=/, '`<a href>`: Tab reaches it; Enter follows it.'],
  [/role="switch"/, '`role="switch"`: Space toggles it, and its state is read as on or off.'],
  [/<input\b(?![^>]*aria-hidden)[^>]*type="checkbox"/, 'Checkbox: Space toggles it; `indeterminate` is read as mixed.'],
  [/type="radio"/, 'Radio group: Tab reaches the checked option; the arrow keys move and check, and the `<legend>` names the group.'],
  [/<(?:input|textarea)\b(?![^>]*type="(?:checkbox|radio)")(?![^>]*aria-hidden)/, 'Text field: its `<label>` names it, and the hint or error is its description.'],
  [/<table\b/, '`<table>`: header cells are `<th>`, so each cell is read with its column.'],
  [/<nav\b/, '`<nav>`: a landmark, named by its `aria-label`.'],
];
const accessibility = (markup, componentNames, gallery) => {
  // A sample may wrap the component, so the root comes from the component's own render when the gallery has one.
  const root = (gallery[0]?.items[0]?.markup ?? markup).match(/^<([a-z0-9-]+)/)?.[1];
  const headings = [...new Set([...markup.matchAll(/<(h[1-6])\b/g)].map((m) => m[1]))];
  const roles = [...new Set([...markup.matchAll(/\srole="([^"]+)"/g)].map((m) => m[1]))];
  const aria = [...new Set([...markup.matchAll(/\s(aria-[a-z]+)=/g)].map((m) => m[1]))].filter((a) => a !== 'aria-hidden');
  const lines = componentNames.map((n) => api.get(n).description).filter(Boolean).map((d) => `- ${d}`);
  if (root) lines.push(`- Renders a \`<${root}>\`${headings.length ? `, with ${headings.map((h) => `\`<${h}>\``).join(' and ')}` : ''}.`);
  if (roles.length) lines.push(`- Roles: ${roles.map((r) => `\`${r}\``).join(', ')}.`);
  if (aria.length) lines.push(`- ARIA it sets: ${aria.map((a) => `\`${a}\``).join(', ')}.`);
  for (const [pattern, line] of KEYBOARD) if (pattern.test(markup)) lines.push(`- ${line}`);
  return lines.join('\n');
};
const galleryHtml = (gallery) =>
  gallery.length
    ? `<section aria-label="Variants and states" style="margin-top:24px;display:grid;gap:16px">
${gallery.map((row) => `<div><p class="text-caption-1" style="margin:0 0 8px;color:var(--muted-foreground)">${row.title}</p><div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
${row.items.map((it) => `<figure style="margin:0;display:grid;gap:6px;justify-items:start">${it.markup}<figcaption class="text-caption-2" style="color:var(--muted-foreground)">${it.caption}</figcaption></figure>`).join('\n')}
</div></div>`).join('\n')}
</section>`
    : '';
const galleryMd = (gallery) =>
  gallery
    .map((row) => `### ${row.title === 'states' ? 'States' : `\`${row.title}\``}\n\n| | HTML |\n| --- | --- |\n${row.items.map((it) => `| \`${cell(it.label)}\` | \`${cell(it.markup)}\` |`).join('\n')}`)
    .join('\n\n');
for (const { item, name, group, markup, code, install, componentNames, gallery } of cards) {
  const height = (HEIGHT[item.name] ?? 140) + gallery.length * 110;
  write(
    `components/${name}/preview.html`,
    `<!-- @dsCard group="${group}" height=${height} subtitle="Static markup rendered from Lede's docs sample" -->
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${name}</title>
<style>body{margin:0}.ds-stage{padding:16px;min-height:100vh;box-sizing:border-box}</style>
</head>
<body>
<div class="ld-theme ds-stage" data-surface="grouped">
${followFrameTheme(markup)}
${galleryHtml(gallery)}
</div>
</body>
</html>
`,
  );
  write(
    `components/${name}/README.md`,
    `# ${name}

${summary(item.description)}

${componentNames.map((n) => `## ${componentNames.length > 1 ? `${n} props` : 'Props'}\n\n${propsTable(api.get(n))}`).join('\n\n')}
${gallery.length ? `\n## Variants and states\n\nEach rendered by the React component with one prop changed, as the preview shows.\n\n${galleryMd(gallery)}\n` : ''}
## Accessibility

${accessibility(markup, componentNames, gallery)}

## Use it in React

\`\`\`bash
${install}
\`\`\`

The smallest working use, from the docs site:

\`\`\`tsx
${code}
\`\`\`

## Use it in an HTML page or artifact

The markup Lede renders for that sample. Load \`components/bundle.css\` and copy it as it is: the class names, elements
and ARIA attributes are what the component writes. Interactive parts (a switch's toggle, a disclosure opening) need
the React component; in plain HTML they show their initial state.

\`\`\`html
${pretty(markup)}
\`\`\`
`,
  );
}

// ---- types: every module's declarations in one file, and each card's own --------------------------------------
// Documentation, not something to compile against: imports between modules are left out.
const moduleOf = (file) => file.replace(/^registry\/lede\//, '').replace(/\.tsx?$/, '');
const strip = (text) => text.replace(/^import .*\n/gm, '').trim();
write(
  'components/index.d.ts',
  `// Lede ${VERSION}: the declarations of every registry module, with their doc comments. GENERATED by scripts/build-design-system.mjs.\n\n${[...declarations]
    .filter(([rel]) => !/(^|\/)index$/.test(rel))
    .map(([rel, text]) => `// registry/lede/${rel}\n${strip(text)}`)
    .join('\n\n')}\n`,
);
for (const { name, componentNames } of cards) {
  const rel = componentNames[0] && moduleOf(api.get(componentNames[0]).file);
  if (rel && declarations.has(rel)) write(`components/${name}/${name}.d.ts`, `${strip(declarations.get(rel))}\n`);
}

// ---- README, cover and index ------------------------------------------------------------------------------------
const fill = (text) =>
  text
    .replaceAll('{{VERSION}}', VERSION)
    .replaceAll('{{SHA}}', sha)
    .replaceAll('{{REGISTRY_URL}}', REGISTRY_URL)
    .replaceAll('{{DESIGN_SYSTEM_URL}}', DESIGN_SYSTEM_URL)
    .replaceAll('{{CANVAS_URL}}', CANVAS_URL)
    .replaceAll('{{MOTION}}', source.motion.tokens.map((t) => `| \`--${t.name}\` | \`${t.value}\` | ${t.usage} |`).join('\n'))
    .replaceAll(
      '{{COMPONENTS}}',
      ['Components', 'Blocks']
        .map((group) => `**${group}:** ${cards.filter((c) => c.group === group).map((c) => c.name).join(' · ')}`)
        .join('\n\n'),
    );
write('README.md', fill(read(join(SRC, 'README.md'))));
write('components/Cover/preview.html', read(join(SRC, 'cover.html')));

const index = {
  ...(previousIndex ?? {}),
  v: 3,
  layout: 'files',
  ...(previousIndex?.createdOnFiles || previousIndex?.convertedFrom ? {} : { createdOnFiles: { v: 1, at: now } }),
  title: previousIndex?.title ?? 'Lede',
  namespace: 'Lede',
  libraries: [],
  sections: previousIndex?.sections ?? {},
  groups: previousIndex?.groups ?? [],
  assetGroups: previousIndex?.assetGroups ?? {},
  blobs: previousIndex?.blobs ?? {},
  docs: previousIndex?.docs ?? { readme: 'project/README.md', sections: [] },
  lastChange: { by: process.env.DS_BY || 'Claude', at: now, via: `Claude Code · fairchild/lede-design@${sha}`, note: `Built from Lede ${VERSION}` },
};
write('design-system.json', `${JSON.stringify(index, null, 1)}\n`);

console.log(`design-system: ${OUT} — ${tokens.color.tokens.length} colors × ${tokens.color.themes.length} themes, ${cards.length} components (${cards.map((c) => c.name).join(', ')})`);
