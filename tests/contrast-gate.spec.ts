// The contrast gate, run on mutated copies of its inputs. Each test sets the colours and listings it reads, so a later
// change to a token can't break it. The cases here have to fail the gate; the data it trusts isn't tested.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

const SCRIPT = resolve('scripts/check-contrast.mjs');

type Json = Record<string, any>;
const edit = (dir: string, file: string, change: (json: Json) => void) => {
  const path = join(dir, file);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  change(json);
  writeFileSync(path, JSON.stringify(json));
};

function gate(mutate: (dir: string) => void = () => {}, ...args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'contrast-gate-'));
  cpSync('tokens', join(dir, 'tokens'), { recursive: true });
  cpSync('registry', join(dir, 'registry'), { recursive: true });
  mutate(dir);
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  rmSync(dir, { recursive: true });
  return { status, output: stdout + stderr };
}

const color = (json: Json, name: string): Json => json.color.tokens.find((token: Json) => token.name === name);

test('passes on the repo as it stands', () => {
  expect(gate().status).toBe(0);
});

test('composites a translucent colour over its surface, and a stack of them in order', () => {
  const colours = {
    'x-white': '#ffffff', 'x-fill': 'rgba(120, 120, 132, 0.14)', 'x-strong': 'rgba(120, 120, 132, 0.30)', 'x-line': 'rgba(60, 60, 67, 0.20)',
    'x-text': '#f4f4f6', 'x-glass': 'rgba(38, 38, 44, 0.62)', 'x-wash': 'rgba(120, 120, 132, 0.28)',
  };
  const { output } = gate((dir) => {
    edit(dir, 'tokens/tokens.json', (json) => { json.color.tokens.push(...Object.entries(colours).map(([name, value]) => ({ name, value }))); });
    edit(dir, 'tokens/contrast.json', (json) => {
      json.pairs.push({ role: 'exempt', colors: ['x-fill', 'x-strong', 'x-line'], on: ['x-white'] });
      json.pairs.push({ role: 'exempt', colors: ['x-text'], on: ['x-glass over any', 'x-wash over x-glass over any'] });
    });
  }, '--report');
  expect(output).toContain('1.18 / 0   light exempt: x-fill on x-white');
  expect(output).toContain('1.45 / 0   light exempt: x-strong on x-white');
  expect(output).toContain('1.42 / 0   light exempt: x-line on x-white');
  expect(output).toContain('3.95 / 0   light exempt: x-text on x-glass over any');
  expect(output).toContain('3.94 / 0   light exempt: x-text on x-wash over x-glass over any');
});

test('fails a token that drops below its floor', () => {
  const { status, output } = gate((dir) => edit(dir, 'tokens/tokens.json', (json) => {
    color(json, 'card').value.light = '#ffffff';
    color(json, 'muted-foreground').value.light = '#8e8e96';
  }));
  expect(status).toBe(1);
  expect(output).toMatch(/light text: muted-foreground on card: 3\.\d+:1, under 4\.5:1/);
});

test('holds -hc text to 7:1 and every accent preset to the same floors as primary', () => {
  const { output } = gate((dir) => edit(dir, 'tokens/tokens.json', (json) => {
    color(json, 'background').value['dark-hc'] = '#000000';
    color(json, 'foreground').value['dark-hc'] = '#909090';
    color(json, 'primary-foreground').value.light = '#ffffff';
    color(json, 'preset-teal').value.light = '#40a8ac';
  }));
  expect(output).toMatch(/dark-hc text: foreground on background: 6\.\d+:1, under 7:1/);
  expect(output).toMatch(/light\/teal text: primary-foreground on primary: 2\.\d+:1, under 4\.5:1/);
});

test('fails a colour in no pair, from either source', () => {
  const token = gate((dir) => edit(dir, 'tokens/tokens.json', (json) => { json.color.tokens.push({ name: 'fill-new', value: '#123456', usage: '' }); }));
  expect(token.output).toContain('fill-new: in no pair');
  const mix = gate((dir) => appendFileSync(join(dir, 'registry/lede/lede.blocks.css'), '.x { background: Color-Mix(in srgb, var(--primary) 33%, transparent); }'));
  expect(mix.output).toContain('primary 33%: in no pair');
  const unread = gate((dir) => appendFileSync(join(dir, 'registry/lede/lede.blocks.css'), '.x { background: color-mix(in oklch, var(--primary) 33%, transparent); }'));
  expect(unread.output).toContain('can\'t read');
});

test('fails a colour name declared twice, and a ratio that comes to NaN', () => {
  const twice = gate((dir) => appendFileSync(join(dir, 'registry/lede/lede.blocks.css'), '[data-theme="dark"] { --ld-primary-on-tint: #333333; }'));
  expect(twice.output).toContain('--ld-primary-on-tint: declared more than once');
  const nan = gate((dir) => {
    edit(dir, 'tokens/tokens.json', (json) => { json.color.tokens.push({ name: 'x-clear', value: '#ffffff00' }); });
    edit(dir, 'tokens/contrast.json', (json) => { json.pairs.push({ role: 'text', colors: ['x-clear 50%'], on: ['card'] }); });
  });
  expect(nan.status).toBe(1);
  expect(nan.output).toContain('light text: x-clear 50% on card: NaN:1');
});

test('fails a pair that leaves out -hc, unless an exempt -hc pair says so', () => {
  const pair = (extra: Json) => gate((dir) => edit(dir, 'tokens/contrast.json', (json) => {
    json.pairs.push({ role: 'control', in: 'standard', colors: ['input'], on: ['card'], ...extra });
  }));
  expect(pair({}).output).toContain('needs an exempt -hc pair');
  const open = gate((dir) => edit(dir, 'tokens/contrast.json', (json) => {
    json.pairs.push({ role: 'control', in: 'standard', colors: ['input'], on: ['card'] }, { role: 'exempt', in: 'hc', colors: ['input'], on: ['card'] });
  }));
  expect(open.status).toBe(0);
  expect(pair({ in: 'all' }).output).toContain('`in` is standard or hc');
});

// The -hc fill walk: every rule that paints a control fill draws an --input edge in -hc, or is listed as no control.
test('fails a control fill with no -hc edge, a field edged only in -hc, and a listing that paints no fill', () => {
  const css = (change: (text: string) => string) => gate((dir) => {
    const path = join(dir, 'registry/lede/lede.components.css');
    writeFileSync(path, change(readFileSync(path, 'utf8')));
  });
  const edge = '[data-theme$="-hc"] .ld-seg { box-shadow: inset 0 0 0 1px var(--input); }';
  const removed = css((text) => text.replace(edge, ''));
  expect(removed.status).toBe(1);
  expect(removed.output).toContain('.ld-seg: paints fill-control with no --input edge in -hc');
  expect(css((text) => text.replace(edge, `/* ${edge} */`)).output).toContain('.ld-seg: paints fill-control');
  expect(css((text) => text.replace(edge, `@media (forced-colors: active) { ${edge} }`)).output).toContain('.ld-seg: paints fill-control');

  const chip = '.x-chip { background: var(--secondary); } .x-chip:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); }';
  const bare = css((text) => text + chip);
  expect(bare.output).toContain('.x-chip: paints secondary with no --input edge');
  expect(bare.output).toContain('.x-chip:hover: paints primary 14% with no --input edge');
  expect(css((text) => `${text}${chip} [data-theme$="-hc"] .x-chip { box-shadow: inset 0 0 0 1px var(--input); }`).status).toBe(0);
  expect(css((text) => `${text}${chip} [data-theme$="-hc"] .x-chip:hover { border: 1px solid var(--input); }`).output).toContain('.x-chip: paints secondary');

  const field = 'background: var(--fill-control);\n  box-shadow: inset 0 0 0 1px var(--input); outline: none;';
  const hcOnly = css((text) => `${text.replace(field, 'background: var(--fill-control);\n  outline: none;')} [data-theme$="-hc"] .ld-field-input { box-shadow: inset 0 0 0 1px var(--input); }`);
  expect(hcOnly.status).toBe(1);
  expect(hcOnly.output).toContain('.ld-field-input: draws no --input edge in light and dark');

  const listed = (selector: string, reason = 'A test.') => gate((dir) => edit(dir, 'tokens/contrast.json', (json) => { json.fills.notControls[selector] = reason; }));
  expect(listed('.no-such-rule').output).toContain('fills.notControls lists .no-such-rule, which paints none of fills.colors');
  expect(listed('.ld-skel', '').output).toContain('fills.notControls gives no reason for .ld-skel');
});

// The knob edge read: a knob shows against its track by its fill or the 1px edge that starts shadow-knob.
test('reads a knob\'s edge from shadow-knob, and fails a knob with neither fill nor edge at 3:1', () => {
  const knob = (light: string) => gate((dir) => edit(dir, 'tokens/tokens.json', (json) => {
    json.shadow.tokens.find((token: Json) => token.name === 'shadow-knob').value.light = light;
  }));
  const plain = knob('0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16)');
  expect(plain.status).toBe(1);
  expect(plain.output).toMatch(/light control: fill-knob on fill-control-strong over background: 1\.\d+:1, under 3:1/);
  expect(knob('0 0 0 1px #e0e0e4, 0 3px 8px rgba(0, 0, 0, 0.15)').output).toMatch(/light control: fill-knob on fill-control-strong over card: \d\.\d+:1, under 3:1/);
  expect(knob('0 3px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px #5f5f66').status).toBe(1);
  expect(knob('0 0 0 1px #5f5f66').status).toBe(0);
});

test('names a role or group it doesn\'t know', () => {
  const pair = (extra: Json) => gate((dir) => edit(dir, 'tokens/contrast.json', (json) => { json.pairs.push({ role: 'text', colors: ['input'], on: ['card'], ...extra }); }));
  expect(pair({ role: 'nope' }).output).toContain('no floor for the role nope');
  expect(pair({ on: ['@nope'] }).output).toContain('no group named @nope');
});
