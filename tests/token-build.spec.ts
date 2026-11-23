// The token build's checks on keyed families, run on mutated copies of tokens/tokens.json: what fails the build, and what it
// lets through.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

const SCRIPT = resolve('scripts/build-tokens.mjs');

type Json = Record<string, any>;
function build(change: (tokens: Json) => void = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'token-build-'));
  cpSync('tokens', join(dir, 'tokens'), { recursive: true });
  for (const out of ['src/styles', 'registry/lede']) mkdirSync(join(dir, out), { recursive: true });
  const path = join(dir, 'tokens/tokens.json');
  const tokens = JSON.parse(readFileSync(path, 'utf8'));
  change(tokens);
  writeFileSync(path, JSON.stringify(tokens));
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
  const css = status === 0 ? readFileSync(join(dir, 'registry/lede/lede.tokens.css'), 'utf8') : '';
  rmSync(dir, { recursive: true });
  return { status, output: stdout + stderr, css };
}

const SOURCE: Json = JSON.parse(readFileSync('tokens/tokens.json', 'utf8'));

test('builds the repo as it stands, with each density block holding exactly the keyed values on data-density', () => {
  const { status, css } = build();
  expect(status).toBe(0);
  const families = Object.values(SOURCE).filter((f: Json) => f.attribute === 'data-density' && f.tokens) as Json[];
  const keyed = families.flatMap((f) => f.tokens).filter((t: Json) => typeof t.value !== 'string');
  expect(keyed.length).toBeGreaterThan(0);
  for (const option of families[0].options) {
    const block = css.match(new RegExp(`\\[data-theme\\]\\[data-density="${option}"\\] \\{([^}]*)\\}`))?.[1];
    expect(block, option).toBeDefined();
    for (const { name, value } of families.flatMap((f) => f.tokens)) {
      if (typeof value === 'string') expect(block).not.toContain(`--${name}:`);
      else expect(block).toContain(`--${name}: ${value[option]};`);
    }
  }
});

test('fails families on one attribute that list different options', () => {
  const { status, output } = build((tokens) => { tokens.spacing.options = ['regular', 'touch']; });
  expect(status).toBe(1);
  expect(output).toContain('spacing and size share data-density, so they need the same options, not [regular,touch] and [regular,compact,touch]');
});

test('fails an attribute whose families key nothing', () => {
  const { status, output } = build((tokens) => {
    for (const fam of ['type', 'spacing', 'size']) tokens[fam].attribute = 'data-width';
    for (const token of tokens.size.tokens) if (typeof token.value !== 'string') token.value = token.value.regular;
  });
  expect(status).toBe(1);
  expect(output).toContain('data-width has options but no keyed tokens in');
});

test('puts a keyed spacing value in the density blocks, beside size', () => {
  const { status, css } = build((tokens) => { tokens.spacing.tokens.find((t: Json) => t.name === 'space-4').value = { regular: '16px', compact: '12px', touch: '16px' }; });
  expect(status).toBe(0);
  expect(css).toMatch(/\[data-theme\]\[data-density="compact"\] \{[^}]*--space-4: 12px;[^}]*\}/);
  expect(css).toMatch(/\[data-theme\]\[data-density="regular"\] \{[^}]*--space-4: 16px;[^}]*\}/);
});

test('fails a keyed value whose keys are out of order, and says the order', () => {
  const { status, output } = build((tokens) => { tokens.spacing.tokens.find((t: Json) => t.name === 'space-4').value = { compact: '12px', regular: '16px', touch: '16px' }; });
  expect(status).toBe(1);
  expect(output).toContain('space-4 has value {"compact":"12px","regular":"16px","touch":"16px"}; it needs a string, or the keys [regular,compact,touch] in that order');
});

test('leaves a family marked emit: false out of the CSS', () => {
  const names = SOURCE.breakpoint.tokens.map((t: Json) => `--${t.name}:`);
  expect(SOURCE.breakpoint.emit).toBe(false);
  const hidden = build();
  for (const name of names) expect(hidden.css).not.toContain(name);
  const shown = build((tokens) => { delete tokens.breakpoint.emit; });
  for (const name of names) expect(shown.css).toContain(name);
});

test('fails a colour whose group color.groups does not list, so it cannot drop out of Foundations', () => {
  const { status, output } = build((tokens) => { tokens.color.tokens[0].group = 'unlisted'; });
  expect(status).toBe(1);
  expect(output).toContain(`${SOURCE.color.tokens[0].name} has group "unlisted", which color.groups doesn't list`);
});

// A token whose default names another token isn't declared, so its default resolves where it's read. Every read in the
// shipped CSS therefore carries that default as its fallback, written out the way the token build would.
test('leaves a token built from another undeclared, and every read of it carries its default', () => {
  const { status, css } = build();
  expect(status).toBe(0);
  const named = (v: string) => (/^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
  // Color and shadow are set per theme, where an alias is declared on each theme block, so only the other families.
  const derived = Object.entries(SOURCE).filter(([family]) => !['color', 'shadow'].includes(family)).flatMap(([, f]: [string, Json]) => f.tokens ?? [])
    .filter((t: Json) => typeof t.value === 'string' && (/^\{.+\}$/.test(t.value) || t.value.includes('var(--')));
  expect(derived.map((t: Json) => t.name)).toEqual(expect.arrayContaining(['font-ui', 'press-transform']));
  const shipped = ['registry/lede/lede.components.css', 'registry/lede/lede.blocks.css', 'src/styles/looks.css']
    .map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const { name, value } of derived) {
    expect(css, name).not.toMatch(new RegExp(`--${name}:`));
    const reads = [...shipped.matchAll(new RegExp(`var\\(--${name}\\b[^;]*`, 'g'))].map((m) => m[0]);
    expect(reads.length, name).toBeGreaterThan(0);
    for (const read of reads) expect(read, name).toContain(`var(--${name}, ${named(value)})`);
  }
});

test('writes each look as [data-theme][data-look] blocks, a color only in its standard theme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-build-'));
  cpSync('tokens', join(dir, 'tokens'), { recursive: true });
  for (const out of ['src/styles', 'registry/lede']) mkdirSync(join(dir, out), { recursive: true });
  const path = join(dir, 'tokens/tokens.json');
  const tokens = JSON.parse(readFileSync(path, 'utf8'));
  tokens.looks.options = { probe: { name: 'Probe', summary: '', fonts: [], values: {
    all: { radius: '0px' }, light: { primary: '#123456', 'edge-surface': '0 0 0 2px #000' }, dark: { primary: '#abcdef' }, 'dark-hc': { primary: '#ffffff' },
  } } };
  writeFileSync(path, JSON.stringify(tokens));
  const { status, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
  const css = status === 0 ? readFileSync(join(dir, 'src/styles/looks/probe.css'), 'utf8') : '';
  rmSync(dir, { recursive: true });
  expect(status, stderr).toBe(0);
  const block = (selector: string) => css.match(new RegExp(`${selector.replace(/[[\]^$*"]/g, '\\$&')} \\{([^}]*)\\}`))?.[1];
  expect(block('[data-theme][data-look="probe"]')).toContain('--radius: 0px;');
  expect(block('[data-theme^="light"][data-look="probe"]')).toContain('--edge-surface: 0 0 0 2px #000;');
  expect(block('[data-theme^="light"][data-look="probe"]')).not.toContain('--primary');
  expect(block('[data-theme="light"][data-look="probe"]')).toContain('--primary: #123456;');
  expect(block('[data-theme="dark"][data-look="probe"]')).toContain('--primary: #abcdef;');
  expect(block('[data-theme="dark-hc"][data-look="probe"]')).toContain('--primary: #ffffff;');
  expect(css).not.toContain('[data-theme="light-hc"]');
});

test('fails a look that sets a token no family names, or a theme that isn\'t one', () => {
  const typo = build((t) => { t.looks.options.brutal.values.all['radius-big'] = '0px'; });
  expect(typo.status).toBe(1);
  expect(typo.output).toContain('looks.brutal.values.all sets radius-big, which no token family names');
  const theme = build((t) => { t.looks.options.brutal.values.sepia = {}; });
  expect(theme.status).toBe(1);
  expect(theme.output).toContain("looks.brutal.values.sepia isn't one of all, light, dark, light-hc, dark-hc");
});
