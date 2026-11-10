// The literal gate, run on mutated copies of registry/ and tokens/. Each case writes the CSS or exception it tests, so a
// later change to the registry's CSS can't break it, and each failure has to name its file, line, selector, property
// and literal.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test, expect } from '@playwright/test';

type Json = Record<string, any>;

test.skip(({ isMobile }) => isMobile, 'No browser: one project is enough.');

const SCRIPT = resolve('scripts/check-literals.mjs');
const BLOCKS = 'registry/lede/lede.blocks.css';
const LIST = 'tokens/literal-exceptions.json';
const ENTRIES: number = JSON.parse(readFileSync(LIST, 'utf8')).length;

const edit = (dir: string, file: string, change: (json: Json) => void) => {
  const path = join(dir, file);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  change(json);
  writeFileSync(path, JSON.stringify(json));
};
const write = (dir: string, file: string, css: string) => {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), css);
};

/** Adds CSS to the end of lede.blocks.css and returns the line its first line lands on. */
const append = (dir: string, css: string) => {
  const path = join(dir, BLOCKS);
  const line = readFileSync(path, 'utf8').split('\n').length;
  appendFileSync(path, css);
  return line;
};

function gate(mutate: (dir: string) => number | void = () => {}, ...args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'literal-gate-'));
  cpSync('tokens', join(dir, 'tokens'), { recursive: true });
  cpSync('registry', join(dir, 'registry'), { recursive: true });
  const line = mutate(dir) ?? 0;
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  rmSync(dir, { recursive: true });
  return { status, output: stdout + stderr, line };
}

test('passes on the repo as it stands, in one line with its counts', () => {
  const { status, output } = gate();
  expect(status).toBe(0);
  expect(output.trim()).toMatch(/^check-literals: \d+ literals in \d+ files: \d+ under \d+ exceptions, \d+ at breakpoints$/);
});

test('fails a px in a new rule, naming its file, line, selector, property and literal, and the family to try', () => {
  const { status, output, line } = gate((dir) => append(dir, '.ld-x {\n  gap: var(--space-2);\n  padding: 0 5px;\n  font: 600 var(--text-body-size) var(--font-sans);\n}\n'));
  expect(status).toBe(1);
  expect(output).toContain(`${BLOCKS}:${line + 2}  .ld-x  padding  5px: try spacing (space-*)`);
  expect(output).toContain(`${BLOCKS}:${line + 3}  .ld-x  font  600: try type (--text-<style>-size, -line-height, -letter-spacing) or weight (weight-*)`);
  expect(output).toContain('2 problem(s)');
});

test('fails a literal in an --ld-* declaration and in a var() fallback', () => {
  const { status, output, line } = gate((dir) => append(dir, '.ld-x {\n  --ld-x-gap: calc(var(--space-2) + 3px);\n  margin: var(--ld-x-gap, 7px);\n}\n'));
  expect(status).toBe(1);
  expect(output).toContain(`${BLOCKS}:${line + 1}  .ld-x  --ld-x-gap  3px: make it a calc() of tokens, or add a token`);
  expect(output).toContain(`${BLOCKS}:${line + 2}  .ld-x  margin  7px`);
});

test('fails a raw color, as hex or a color function, and inside color-mix() too', () => {
  const { status, output, line } = gate((dir) => append(dir, [
    '.ld-x {',
    '  color: #FF0000;',
    '  background: rgb(0 0 0 / 50%);',
    '  border-color: color-mix(in srgb, #00f 20%, transparent);',
    '}',
  ].join('\n')));
  expect(status).toBe(1);
  expect(output).toContain(`${BLOCKS}:${line + 1}  .ld-x  color  #FF0000: try a color token`);
  expect(output).toContain(`${BLOCKS}:${line + 2}  .ld-x  background  rgb(0 0 0 / 50%)`);
  expect(output).toContain(`${BLOCKS}:${line + 3}  .ld-x  border-color  #00f`);
  expect(output).toContain('3 problem(s)');
});

test('fails a named color, inside a function too, and lets through transparent, currentColor, inherit and system colors', () => {
  const { status, output, line } = gate((dir) => append(dir, [
    '.ld-x {',
    '  color: white;',
    '  background: RebeccaPurple;',
    '  border-color: light-dark(white, black);',
    '  outline: 1px solid color-mix(in oklab, var(--primary), tomato);',
    '  fill: transparent; stroke: currentColor; caret-color: inherit; accent-color: Canvas;',
    '  --ld-x-edge: var(--border, navy);',
    '}',
  ].join('\n')));
  expect(status).toBe(1);
  expect(output).toContain(`${BLOCKS}:${line + 1}  .ld-x  color  white: try a color token`);
  expect(output).toContain(`${BLOCKS}:${line + 2}  .ld-x  background  RebeccaPurple`);
  expect(output).toContain(`${BLOCKS}:${line + 3}  .ld-x  border-color  white`);
  expect(output).toContain(`${BLOCKS}:${line + 3}  .ld-x  border-color  black`);
  expect(output).toContain(`${BLOCKS}:${line + 4}  .ld-x  outline  tomato`);
  expect(output).toContain(`${BLOCKS}:${line + 6}  .ld-x  --ld-x-edge  navy`);
  expect(output).not.toContain(`${BLOCKS}:${line + 5}`);
  expect(output).toContain('6 problem(s)');
});

test('fails a Tailwind palette utility in @apply, behind variants too, and lets through token utilities', () => {
  const { status, output, line } = gate((dir) => append(dir, [
    '.ld-x { @apply bg-red-500 hover:text-white; }',
    '.ld-x { @apply border-x-slate-200/50 ring-offset-black; }',
    '.ld-x { @apply bg-primary text-muted-foreground border-border text-body; }',
  ].join('\n')));
  expect(status).toBe(1);
  expect(output).toContain(`${BLOCKS}:${line}  @apply bg-red-500 hover:text-white  @apply  bg-red-500: try a color token`);
  expect(output).toContain(`${BLOCKS}:${line}  @apply bg-red-500 hover:text-white  @apply  text-white`);
  expect(output).toContain(`${BLOCKS}:${line + 1}  @apply border-x-slate-200/50 ring-offset-black  @apply  border-x-slate-200`);
  expect(output).toContain(`${BLOCKS}:${line + 1}  @apply border-x-slate-200/50 ring-offset-black  @apply  ring-offset-black`);
  expect(output).not.toContain(`${BLOCKS}:${line + 2}`);
  expect(output).toContain('5 problem(s)');
});

test('walks every CSS file under registry/, in new folders too', () => {
  const { status, output } = gate((dir) => {
    write(dir, 'registry/lede/blocks/x.css', '.ld-x { width: 13px; }\n');
    write(dir, 'registry/lede/extra/deep/y.css', '\n.ld-y { height: 14px; }\n');
  });
  expect(status).toBe(1);
  expect(output).toContain('registry/lede/blocks/x.css:1  .ld-x  width  13px');
  expect(output).toContain('registry/lede/extra/deep/y.css:2  .ld-y  height  14px');
});

test('holds media and container queries to breakpoint tokens, 0.02px less only in a px max- query', () => {
  const queries = [
    '@media (min-width: 901px) { .ld-x { display: none; } }',
    '@container ld-dt-cards (max-width: 439.98px) { .ld-x { display: none; } }',
    '@container ld-dt-cards (min-width: 439.98px) { .ld-x { display: none; } }',
    '@container ld-dt-cards (max-width: 30em) { .ld-x { display: none; } }',
    '@media (min-width: 900em) { .ld-x { display: none; } }',
    '@media (min-width: 900px) { .ld-x { display: none; } }',
  ].join('\n');
  const undeclared = gate((dir) => append(dir, queries));
  const { line } = undeclared;
  expect(undeclared.status).toBe(1);
  expect(undeclared.output).toContain(`${BLOCKS}:${line}  @media (min-width: 901px)  @media  901px: not a breakpoint value`);
  expect(undeclared.output).not.toContain(`${BLOCKS}:${line + 1}`);
  expect(undeclared.output).toContain(`${BLOCKS}:${line + 2}  @container ld-dt-cards (min-width: 439.98px)  @container  439.98px: not a breakpoint value`);
  expect(undeclared.output).toContain(`${BLOCKS}:${line + 3}  @container ld-dt-cards (max-width: 30em)  @container  30em: not a breakpoint value`);
  expect(undeclared.output).toContain(`${BLOCKS}:${line + 4}  @media (min-width: 900em)  @media  900em: not a breakpoint value`);
  expect(undeclared.output, 'a window breakpoint left in px').toContain(`${BLOCKS}:${line + 5}  @media (min-width: 900px)  @media  900px: not a breakpoint value`);
  const declared = gate((dir) => {
    edit(dir, 'tokens/tokens.json', (json) => { json.breakpoint.tokens.push({ name: 'breakpoint-x', value: '901px' }); });
    return append(dir, queries);
  });
  expect(declared.output).not.toContain('901px');
  expect(declared.output).toContain('4 problem(s)');
});

test('holds an em number to an em breakpoint token in a media query and a px number to a px one, with no 0.02 less in em', () => {
  const queries = [
    '@media (width < 20em) { .ld-x { display: none; } }',
    '@media (width < 19em) { .ld-x { display: none; } }',
    '@media (width < 320px) { .ld-x { display: none; } }',
    '@media (width < 20px) { .ld-x { display: none; } }',
    '@container ld-dt-cards (width < 20em) { .ld-x { display: none; } }',
    '@media (max-width: 19.98em) { .ld-x { display: none; } }',
    '@custom-media --ld-reflow (width < 20em);',
  ].join('\n');
  const { status, output, line } = gate((dir) => append(dir, queries));
  expect(status).toBe(1);
  expect(output).not.toContain(`${BLOCKS}:${line}  `);
  expect(output).toContain(`${BLOCKS}:${line + 1}  @media (width < 19em)  @media  19em: not a breakpoint value`);
  expect(output).toContain(`${BLOCKS}:${line + 2}  @media (width < 320px)  @media  320px: not a breakpoint value`);
  expect(output).toContain(`${BLOCKS}:${line + 3}  @media (width < 20px)  @media  20px: not a breakpoint value`);
  expect(output).toContain(`${BLOCKS}:${line + 4}  @container ld-dt-cards (width < 20em)  @container  20em: an em breakpoint is for @media and @custom-media, where em is the browser's text size. In @container, em is the container's font size.`);
  expect(output).toContain(`${BLOCKS}:${line + 5}  @media (max-width: 19.98em)  @media  19.98em: not a breakpoint value`);
  expect(output).not.toContain(`${BLOCKS}:${line + 6}  `);
  expect(output).toContain('5 problem(s)');
  const rem = gate((dir) => edit(dir, 'tokens/tokens.json', (json) => { json.breakpoint.tokens.push({ name: 'breakpoint-x', value: '30rem' }); }));
  expect(rem.status).toBe(1);
  expect(rem.output).toContain('tokens/tokens.json: breakpoint-x is 30rem; a breakpoint is in px, or in em for a text size');
});

test('fails an exception without a reason, with a field it doesn\'t know, or with nothing to match', () => {
  const { status, output } = gate((dir) => edit(dir, LIST, (json) => {
    json[1].reason = ' ';
    json.push({ reason: 'A test.', selector: ['.ld-x'] }, { reason: 'Everything.' });
  }));
  expect(status).toBe(1);
  expect(output).toMatch(/literal-exceptions\.json: entry 2 \(.+\) has no reason/);
  expect(output).toContain(`${LIST}: entry ${ENTRIES + 1} (A test.) has a field the gate doesn't know: selector`);
  expect(output).toContain(`${LIST}: entry ${ENTRIES + 2} (Everything.) lists no values, properties, selectors, functions or operand`);
});

test('fails a stale exception, and one that an earlier entry already covers', () => {
  const { status, output } = gate((dir) => edit(dir, LIST, (json) => {
    json.push({ reason: 'Nothing uses it.', values: ['3px'] }, { reason: 'Hairlines again.', values: ['1px'] });
  }));
  expect(status).toBe(1);
  expect(output).toContain(`${LIST}: entry ${ENTRIES + 1} (Nothing uses it.) matches nothing in registry/`);
  expect(output).toContain(`${LIST}: entry ${ENTRIES + 2} (Hairlines again.) matches nothing in registry/`);
});

test('lets through the file build-tokens writes, comments, strings, url() and selectors', () => {
  const header = '/* Lede tokens — GENERATED from tokens/tokens.json by scripts/build-tokens.mjs. Do not edit. */';
  const { status, output } = gate((dir) => {
    write(dir, 'registry/lede/x.tokens.css', `${header}\n:root { --x: 13px; color: #123456; }\n`);
    append(dir, '/* 13px */\n.ld-x:nth-child(3n + 1)::before { content: "13px"; background: url(icons/13px.svg); }\n');
  });
  expect(output).not.toContain('13px');
  expect(status).toBe(0);
  const others = gate((dir) => {
    write(dir, 'registry/lede/y.css', '/* GENERATED */\n.ld-y { width: 13px; }\n');
    write(dir, 'registry/lede/z.css', `.ld-z { width: 14px; }\n${header}\n`);
  });
  expect(others.output).toContain('registry/lede/y.css:2  .ld-y  width  13px');
  expect(others.output).toContain('registry/lede/z.css:1  .ld-z  width  14px');
});

test('holds each exception to the values, properties, selectors and operands its entry lists', () => {
  const failing = [
    ['margin', 'calc(4 * var(--space-1))', '4'],
    ['padding', '1lh', '1lh'],
    ['width', '999px', '999px'],
    ['z-index', '5', '5'],
    ['transform', 'translateY(-200%)', '-200%'],
    ['height', '11px', '11px'],
    ['opacity', '2', '2'],
    ['opacity', '50%', '50%'],
    ['font-size', '50%', '50%'],
    ['line-height', '100%', '100%'],
    ['padding', '1px', '1px'],
    ['letter-spacing', '0.5px', '0.5px'],
    ['border-spacing', '3px', '3px'],
  ];
  const { status, output, line } = gate((dir) => append(dir, [
    '.ld-x {',
    ...failing.map(([property, value]) => `  ${property}: ${value};`),
    '  border-radius: calc(var(--radius-step) / 4);',
    '  border-left: 1px solid var(--border); translate: -50% -50%; grid-template-rows: 1fr; line-clamp: 2;',
    '}',
    '@supports (height: 1lh) { .ld-x { height: 1lh; } }',
    '@supports (width: 2lh) { .ld-x { width: 1lh; } }',
    '.ld-checkbox-input:checked + .ld-checkbox-box::after { width: 6px; font-size: 11px; }',
    '.ld-skip { margin: -200%; }',
  ].join('\n')));
  expect(status).toBe(1);
  failing.forEach(([property, , literal], index) => expect(output).toContain(`${BLOCKS}:${line + 1 + index}  .ld-x  ${property}  ${literal}`));
  expect(output).toContain(`${BLOCKS}:${line + 1}  .ld-x  margin  4: this factor makes a new value, which is a choice: try spacing (space-*)`);
  expect(output).toContain('.ld-x  padding  1px: try spacing (space-*)');
  expect(output).toContain('.ld-x  border-spacing  3px: try spacing (space-*)');
  const after = line + failing.length + 4;
  expect(output).toContain(`${BLOCKS}:${after + 1}  @supports (width: 2lh)  @supports  2lh`);
  expect(output).toContain(`${BLOCKS}:${after + 2}  .ld-checkbox-input:checked + .ld-checkbox-box::after  font-size  11px`);
  expect(output).toContain(`${BLOCKS}:${after + 3}  .ld-skip  margin  -200%`);
  expect(output).toContain(`${failing.length + 3} problem(s)`);
});

test('scopes a selector entry to every selector in the rule\'s list, outside functional pseudo-classes', () => {
  const failing = ['.ld-skeleton', '.ld-card:not(.ld-skel)', '.ld-x:has(.ld-skel)', '.ld-card, .ld-skel', '.ld-x:where(.ld-skel, .ld-card)', '.ld-x:nth-child(2 of .ld-skel)'];
  const { status, output, line } = gate((dir) => append(dir, [
    ...failing.map((selector) => `${selector} { width: 72%; }`),
    '.ld-table-skeleton > :nth-child(2) .ld-skel:not(.ld-x), .ld-skel-short { width: 72%; }',
  ].join('\n')));
  expect(status).toBe(1);
  failing.forEach((selector, offset) => expect(output).toContain(`${BLOCKS}:${line + offset}  ${selector}  width  72%`));
  expect(output).not.toContain(`${BLOCKS}:${line + failing.length}`);
  expect(output).toContain(`${failing.length} problem(s)`);
});

test('scopes a selector entry through nesting, where an outer rule names it', () => {
  const { status, output, line } = gate((dir) => append(dir, '.ld-skel { .ld-inner { width: 72%; } }\n.ld-card { .ld-inner { width: 72%; } }\n'));
  expect(status).toBe(1);
  expect(output).not.toContain(`${BLOCKS}:${line}  `);
  expect(output).toContain(`${BLOCKS}:${line + 1}  .ld-inner  width  72%`);
  expect(output).toContain('1 problem(s)');
});

test('takes a factor only when it scales a token, and not a bare number', () => {
  const { status, output, line } = gate((dir) => append(dir, [
    '.ld-x {',
    '  width: calc(2 * 2 * 2 * 1px);',
    '  opacity: calc(1 / 2);',
    '  margin: calc(2 * 2 * var(--space-1));',
    '  padding: calc(2 * var(--space-1)) calc(var(--space-1) / 2) calc((var(--space-4) - var(--space-1)) / 2);',
    '}',
  ].join('\n')));
  expect(status).toBe(1);
  for (const [offset, property] of [[1, 'width'], [2, 'opacity'], [3, 'margin']] as const) {
    expect(output).toContain(`${BLOCKS}:${line + offset}  .ld-x  ${property}  2: a product of numbers makes a new value: scale a token once, or add a token`);
  }
  expect(output).not.toContain(`${BLOCKS}:${line + 4}`);
  expect(output).toContain('6 problem(s)');
});

test('reads statement at-rules such as @apply and @custom-media, and skips @import and @layer names', () => {
  const { status, output, line } = gate((dir) => append(dir, [
    '.ld-x { @apply w-[313px] bg-[#ff0000]; }',
    '@custom-media --ld-narrow (max-width: 313px);',
    '@custom-media --ld-wide (width >= 56.25em);',
    '@import url(x.css) supports(width: 2px);',
    '@layer ld-base, ld-top;',
  ].join('\n')));
  expect(status).toBe(1);
  expect(output).toContain(`${BLOCKS}:${line}  @apply w-[313px] bg-[#ff0000]  @apply  313px`);
  expect(output).toContain(`${BLOCKS}:${line}  @apply w-[313px] bg-[#ff0000]  @apply  #ff0000: try a color token`);
  expect(output).toContain(`${BLOCKS}:${line + 1}  @custom-media --ld-narrow (max-width: 313px)  @custom-media  313px: not a breakpoint value`);
  expect(output).toContain('3 problem(s)');
});

test('prints what each entry and breakpoint takes with --report', () => {
  const { status, output } = gate((dir) => {
    write(dir, 'registry/lede/lede.components.css', '');
    write(dir, BLOCKS, '.ld-x { margin: 0; gap: 1px; border-top: 1px solid; }\n@media (width >= 56.25em) { .ld-x { gap: 0; } }\n');
    writeFileSync(join(dir, LIST), JSON.stringify([{ reason: 'Zero.', values: ['0'] }, { reason: 'Hairlines.', values: ['1px'] }]));
  }, '--report');
  expect(status).toBe(0);
  expect(output).toContain('    2  entry 1: Zero.\n       0 margin×1, 0 gap×1\n');
  expect(output).toContain('    2  entry 2: Hairlines.\n       1px gap×1, 1px border-top×1\n');
  expect(output).toContain('    1  breakpoint-sidebar: 56.25em @media×1\n');
  expect(output).toContain('    0  breakpoint-narrow: \n');
  expect(output).toContain('check-literals: 5 literals in 3 files: 4 under 2 exceptions, 1 at breakpoints');
});
