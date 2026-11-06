// tokens/tokens.json is the single source. This writes src/styles/lede.tokens.css (used by the site)
// and registry/lede/lede.tokens.css (shipped by the lede-theme registry item). Never edit either by hand.
import { readFileSync, writeFileSync } from 'node:fs';

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
for (const { options = [], tokens, emit } of families) {
  for (const { name, value, reducedMotion } of tokens) {
    if (typeof value !== 'string' && (!options.length || String(Object.keys(value)) !== String(options))) {
      throw new Error(`tokens.json: ${name} has value ${JSON.stringify(value)}; it needs a string, or the keys [${options}] in that order`);
    }
    if (reducedMotion && typeof value !== 'string') throw new Error(`tokens.json: ${name} is keyed, so it can't take a reducedMotion value`);
    if (emit === false) continue;
    root.push(`  --${name}: ${typeof value === 'string' ? value : value[options[0]]};`);
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
out.push('@custom-variant dark (&:is(.dark *, [data-theme^="dark"] *));', '');

const text = out.join('\n');
writeFileSync('src/styles/lede.tokens.css', text);
writeFileSync('registry/lede/lede.tokens.css', text);
console.log(`tokens: ${t.color.tokens.length} colors × ${themes.length} themes`);
