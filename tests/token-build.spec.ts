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
