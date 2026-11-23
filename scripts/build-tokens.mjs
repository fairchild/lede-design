// tokens/tokens.json is the single source. This writes src/styles/lede.tokens.css (used by the site)
// and registry/lede/lede.tokens.css (shipped by the lede-theme registry item), and one file per look in
// registry/lede/looks/<id>.tokens.css (each imported by that look's registry file). Never edit any of them by hand.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const t = JSON.parse(readFileSync('tokens/tokens.json', 'utf8'));
const themes = t.color.themes.map((x) => x.id);
const first = themes[0];
const THEMED = ['color', 'shadow'];
const SELECTOR = {
  light: ':root, .light, [data-theme="light"]',
  dark: '.dark, [data-theme="dark"]',
  'light-hc': '[data-theme="light-hc"]',
  'dark-hc': '[data-theme="dark-hc"]',
};
const isAlias = (v) => typeof v === 'string' && /^\{.+\}$/.test(v);
// Foundations lists colours by group, so a colour in a group color.groups doesn't name would drop out of it.
const groups = new Set(t.color.groups.map((g) => g.id));
for (const { name, group } of t.color.tokens) {
  if (!groups.has(group)) throw new Error(`tokens.json: ${name} has group ${JSON.stringify(group)}, which color.groups doesn't list`);
}
const css = (v) => (isAlias(v) ? `var(--${v.slice(1, -1)})` : v);

const out = ['/* Lede tokens — GENERATED from tokens/tokens.json by scripts/build-tokens.mjs. Do not edit. */', ''];
for (const theme of themes) {
  const lines = [];
  for (const fam of THEMED) {
    for (const tk of t[fam].tokens) {
      const v = tk.value;
      let value;
      if (typeof v === 'string') value = theme === first || isAlias(v) ? v : null;
      else value = theme === first ? v[first] : v[theme] ?? null;
      if (value != null) lines.push(`  --${tk.name}: ${css(value)};`);
    }
  }
  out.push(`${SELECTOR[theme] ?? `[data-theme="${theme}"]`} {\n${lines.join('\n')}\n}`, '');
}
// Each type style is also three properties, and a fourth for letter spacing where it sets one, so components can read its
// metrics and a density can key them.
const styles = t.type.groups.flatMap((g) => g.styles.map((s) => ({ ...s, family: s.family ?? g.family })));
const metric = (v) => (typeof v === 'number' ? String(v) : v);
const type = {
  name: 'type',
  attribute: t.type.attribute,
  options: t.type.options,
  tokens: styles.flatMap((s) => [
    { name: `text-${s.name}-size`, value: s.fontSize },
    { name: `text-${s.name}-line-height`, value: s.lineHeight },
    { name: `text-${s.name}-weight`, value: metric(s.fontWeight) },
    ...(s.letterSpacing ? [{ name: `text-${s.name}-letter-spacing`, value: s.letterSpacing }] : []),
  ]),
};
const families = [
  ...Object.entries(t).filter(([name, fam]) => fam.tokens && !THEMED.includes(name)).map(([name, fam]) => ({ name, ...fam })),
  type,
];
for (const [name, fam] of Object.entries(t)) {
  if (name === 'looks') continue;
  if ((fam.attribute || fam.options) && !(fam.attribute && fam.options?.length && families.some((f) => f.name === name))) {
    throw new Error(`tokens.json: ${name} needs attribute, options and tokens together`);
  }
}

// Families on one attribute share its options, so each option's block holds every family's keyed values.
const axes = new Map();
for (const fam of families.filter((f) => f.attribute)) {
  if (!axes.has(fam.attribute)) axes.set(fam.attribute, { names: [], options: fam.options, keyed: [] });
  const axis = axes.get(fam.attribute);
  if (String(axis.options) !== String(fam.options)) {
    throw new Error(`tokens.json: ${axis.names[0]} and ${fam.name} share ${fam.attribute}, so they need the same options, not [${axis.options}] and [${fam.options}]`);
  }
  axis.names.push(fam.name);
  if (fam.emit !== false) axis.keyed.push(...fam.tokens.filter((tk) => typeof tk.value !== 'string'));
}

const root = [];
const reduced = [];
// A token whose default names another token isn't declared. Components read it as `var(--font-ui, var(--font-sans))`,
// so the default resolves where it's used and follows a nested ThemeProvider's `font-sans`, while a value someone sets
// for the token itself, on :root or on any provider, still inherits. A declaration would do one or the other: on
// `:root` alone it resolves once, at the top, and on every theme root it would undo a value set further up.
const namesToken = (v) => typeof v === 'string' && (isAlias(v) || v.includes('var(--'));
for (const { options = [], tokens, emit } of families) {
  for (const { name, value, reducedMotion } of tokens) {
    if (typeof value !== 'string' && (!options.length || String(Object.keys(value)) !== String(options))) {
      throw new Error(`tokens.json: ${name} has value ${JSON.stringify(value)}; it needs a string, or the keys [${options}] in that order`);
    }
    if (reducedMotion && typeof value !== 'string') throw new Error(`tokens.json: ${name} is keyed, so it can't take a reducedMotion value`);
    if (emit === false) continue;
    if (namesToken(value)) {
      if (reducedMotion) throw new Error(`tokens.json: ${name} names another token, so it isn't declared and can't take a reducedMotion value`);
      continue;
    }
    root.push(`  --${name}: ${typeof value === 'string' ? css(value) : value[options[0]]};`);
    if (reducedMotion) reduced.push(`    --${name}: ${reducedMotion} !important;`);
  }
}
for (const [k, v] of Object.entries(t.type.families)) root.push(`  --font-${k}: ${v};`);
out.push(`:root {\n${root.join('\n')}\n}`, '');
// !important on :root and on every theme root, so a value a project sets on either for a motion token, ThemeProvider's
// inline `tokens` included, doesn't switch reduced motion off.
if (reduced.length) out.push(`@media (prefers-reduced-motion: reduce) {\n  :root, [data-theme] {\n${reduced.join('\n')}\n  }\n}`, '');

// One block per option, so that an explicit option on a nested element replaces an inherited one. [data-theme] puts the
// block above a class and limits it to theme roots, which are where the derived variables recompute.
for (const [attribute, { names, options, keyed }] of axes) {
  if (!keyed.length) throw new Error(`tokens.json: ${attribute} has options but no keyed tokens in ${names.join(', ')}`);
  for (const option of options) {
    out.push(`[data-theme][${attribute}="${option}"] {\n${keyed.map((tk) => `  --${tk.name}: ${tk.value[option]};`).join('\n')}\n}`, '');
  }
}

// letter-spacing only where a style sets one, so the rest inherit it as they always have.
const typeRules = styles.map((s) => {
  const p = `--text-${s.name}`;
  const spacing = s.letterSpacing ? ` letter-spacing: var(${p}-letter-spacing);` : '';
  return `.text-${s.name} { font-family: var(--font-${s.family}); font-size: var(${p}-size); line-height: var(${p}-line-height); font-weight: var(${p}-weight);${spacing} }`;
});
out.push('/* Type styles: `.text-large-title` … `.text-caption-2` */', `@layer components {\n${typeRules.join('\n')}\n}`, '');

const theme = ['@theme inline {'];
for (const tk of t.color.tokens) theme.push(`  --color-${tk.name}: var(--${tk.name});`);
theme.push(
  '  --radius-xs: max(var(--radius-step) / 4, var(--radius) - 2 * var(--radius-step));',
  '  --radius-sm: max(var(--radius-step) / 4, var(--radius) - var(--radius-step) - var(--radius-step) / 2);',
  '  --radius-md: max(var(--radius-step) / 4, var(--radius) - var(--radius-step));',
  '  --radius-lg: var(--radius);',
  '  --radius-xl: calc(var(--radius) + var(--radius-step));',
  '}',
  // `reference` keeps this out of Tailwind's :root, :host, where a shadow root would read it as a cycle.
  '@theme inline reference {',
  '  --radius-capsule: var(--radius-capsule);',
  '}',
);
out.push('/* Tailwind v4: `bg-primary`, `text-muted-foreground`, `bg-background-grouped`, `rounded-lg` … */', theme.join('\n'), '');
// Each theme root names its scheme and contrast, and every element inherits them from its nearest root, so a style
// query on them answers for the nearest root. `dark:` keeps shadcn's ancestor selector, for its specificity, and adds
// the query, so a light root inside a dark one stops it.
out.push(
  '/* The nearest theme root\'s scheme and contrast, which every element inherits. `dark:` and the -hc rules query them,',
  '   so a light ThemeProvider inside a dark one stops `dark:` utilities, and a standard one stops -hc edges. */',
  '.light, [data-theme^="light"] { --ld-scheme: light; }',
  '.dark, [data-theme^="dark"] { --ld-scheme: dark; }',
  '[data-theme] { --ld-contrast: standard; }',
  '[data-theme$="-hc"] { --ld-contrast: high; }',
  '@custom-variant dark {',
  '  &:is(.dark *, [data-theme^="dark"] *) {',
  '    @container style(--ld-scheme: dark) { @slot; }',
  '  }',
  '}',
  '',
);

const text = out.join('\n');
writeFileSync('src/styles/lede.tokens.css', text);
writeFileSync('registry/lede/lede.tokens.css', text);

// Looks: a theme root's `data-look` (ThemeProvider's `look`) sets token values, one block per theme it reaches, each
// [data-theme][data-look] like the shape and density axes, so a look beats the theme blocks and, coming after them in
// the page, the axes. A color, shadow or ground texture applies in its scheme's standard theme only: high contrast keeps Lede's -hc
// palette unless the look gives `light-hc` or `dark-hc`. Every other value applies in both of its scheme's themes.
const { looks } = t;
const PALETTE = new Set(THEMED.flatMap((fam) => t[fam].tokens.map((tk) => tk.name)));
const KNOWN = new Set([
  ...PALETTE,
  ...families.flatMap((fam) => fam.tokens.map((tk) => tk.name)),
  ...Object.keys(t.type.families).map((k) => `font-${k}`),
]);
// Each token's own value, for the reset below: what `:root` declares, or `initial` for one that isn't declared, so a
// read falls back to its default.
const ROOT_VALUE = new Map([
  ...families.flatMap((fam) => fam.tokens.map((tk) => [tk.name, typeof tk.value !== 'string' ? tk.value[fam.options[0]] : namesToken(tk.value) ? 'initial' : css(tk.value)])),
  ...Object.entries(t.type.families).map(([k, v]) => [`font-${k}`, v]),
]);
// High contrast drops a look's colors, shadows and ground texture, the way Lede's -hc themes keep a plain ground.
const STANDARD_ONLY = new Set([...PALETTE, 'texture-ground']);
const LOOK_THEMES = { all: null, light: 'light', dark: 'dark', 'light-hc': 'light-hc', 'dark-hc': 'dark-hc' };
mkdirSync('registry/lede/looks', { recursive: true });
for (const [id, look] of Object.entries(looks?.options ?? {})) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || id === 'lede') throw new Error(`tokens.json: looks.${id} needs a lowercase name other than lede`);
  const blocks = [];
  const line = ([name, value]) => `  --${name}: ${value === 'initial' ? value : css(value)};`;
  for (const key of Object.keys(look.values)) {
    if (!(key in LOOK_THEMES)) throw new Error(`tokens.json: looks.${id}.values.${key} isn't one of ${Object.keys(LOOK_THEMES).join(', ')}`);
  }
  // Blocks go out in LOOK_THEMES order, whatever order tokens.json lists them in, so a later theme wins a tie.
  for (const key of Object.keys(LOOK_THEMES).filter((k) => k in look.values)) {
    const values = look.values[key];
    for (const name of Object.keys(values)) {
      if (!KNOWN.has(name)) throw new Error(`tokens.json: looks.${id}.values.${key} sets ${name}, which no token family names`);
    }
    const entries = Object.entries(values);
    const at = (theme) => `[data-theme${theme ? `="${theme}"` : ''}][data-look="${id}"]`;
    const scheme = LOOK_THEMES[key];
    if (!scheme) blocks.push([at(null), entries]);
    else if (scheme.endsWith('-hc')) blocks.push([at(scheme), entries]);
    else {
      blocks.push([`[data-theme^="${scheme}"][data-look="${id}"]`, entries.filter(([name]) => !STANDARD_ONLY.has(name))]);
      blocks.push([at(scheme), entries.filter(([name]) => STANDARD_ONLY.has(name))]);
    }
  }
  // High contrast drops a look's ground texture as it drops its colors, but no -hc block declares the texture again, so
  // an -hc root inside a standard one with this look puts back Lede's.
  const standardOnly = [...new Set(['light', 'dark'].flatMap((key) => Object.keys(look.values[key] ?? {})).filter((name) => STANDARD_ONLY.has(name) && !PALETTE.has(name)))];
  for (const scheme of ['light-hc', 'dark-hc']) {
    const own = look.values[scheme] ?? {};
    blocks.push([`[data-theme="${scheme}"][data-look="${id}"]`, standardOnly.filter((name) => !(name in own) && !(name in (look.values.all ?? {}))).map((name) => [name, ROOT_VALUE.get(name)])]);
  }
  // The theme root that turns this look off, with another look or `lede`, puts back Lede's value for each token this look
  // sets and the theme blocks don't reset (colors and shadows they do), so nothing of this look leaks into it. The
  // @scope stops below that root, so a provider further in inherits from it as usual. :where() weighs nothing, so the
  // root's own shape, density and `tokens` still win; it beats only the inherited value.
  const leaks = [...new Set(Object.values(look.values).flatMap((values) => Object.keys(values)).filter((name) => !PALETTE.has(name)))];
  const reset = leaks.length ? [
    `@scope ([data-look="${id}"]) to ([data-look]:not([data-look="${id}"]) [data-theme]) {\n  :where([data-theme][data-look]:not([data-look="${id}"])) {\n${leaks.map((name) => `  ${line([name, ROOT_VALUE.get(name)])}`).join('\n')}\n  }\n}`,
  ] : [];
  const body = [...reset, ...blocks.filter(([, entries]) => entries.length).map(([selector, entries]) => `${selector} {\n${entries.map(line).join('\n')}\n}`)];
  writeFileSync(`registry/lede/looks/${id}.tokens.css`, [
    `/* Lede look "${id}" (${look.name}) — GENERATED from tokens/tokens.json by scripts/build-tokens.mjs. Do not edit. */`,
    '',
    body.join('\n\n'),
    '',
  ].join('\n'));
}
console.log(`tokens: ${t.color.tokens.length} colors × ${themes.length} themes, ${Object.keys(looks?.options ?? {}).length} looks`);
