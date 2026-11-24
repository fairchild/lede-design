// A ThemeProvider is its own theme root: what's inside it follows the nearest provider, never a further one. The fixture
// nests light inside dark, high contrast and solid glass, then dark inside that light again, beside a light provider on
// its own as the reference.
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const PROBES = ['reference', 'outer', 'nested', 'again'] as const;
type Probe = (typeof PROBES)[number] | 'inherits';

async function read(page: Page, probe: Probe) {
  return page.locator(`[data-probe="${probe}"]`).evaluate((section) => {
    const style = (selector: string) => getComputedStyle(section.querySelector(selector)!);
    return {
      underline: style('.dark\\:underline').textDecorationLine,
      edge: style('[data-probe-card]').boxShadow,
      backdrop: style('[data-probe-glass]').backdropFilter,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/fixtures/theme-nesting');
  await expect(page.getByRole('heading', { level: 1, name: 'Theme nesting fixtures' })).toBeVisible();
});

test('a dark: utility follows the nearest provider', async ({ page }) => {
  const underline = Object.fromEntries(await Promise.all(PROBES.map(async (p) => [p, (await read(page, p)).underline])));
  expect(underline).toEqual({ reference: 'none', outer: 'underline', nested: 'none', again: 'underline' });
});

test('high contrast edges follow the nearest provider', async ({ page }) => {
  const [reference, outer, nested, again] = await Promise.all(PROBES.map((p) => read(page, p)));
  expect(outer.edge).toContain('0px 0px 0px 1px');
  expect(again.edge).toBe(outer.edge);
  expect(nested.edge).toBe(reference.edge);
});

test('solid glass follows the nearest provider', async ({ page }) => {
  const [reference, outer, nested, again] = await Promise.all(PROBES.map((p) => read(page, p)));
  expect(reference.backdrop).toContain('blur');
  expect(outer.backdrop).toBe('none');
  expect(nested.backdrop).toBe(reference.backdrop);
  expect(again.backdrop).toBe('none');
});

test('a provider that leaves glass and contrast unset takes the nearest provider\'s', async ({ page }) => {
  const [outer, inherits] = await Promise.all((['outer', 'inherits'] as const).map((p) => read(page, p)));
  expect(inherits.backdrop).toBe('none');
  expect(inherits.edge).toContain('0px 0px 0px 1px');
  expect(inherits.underline).toBe('none');
  expect(outer.underline).toBe('underline');
});

// A rule that reaches through a theme root's attribute to a descendant sits in the style query that names that root's
// value, so it follows the nearest root: `[data-theme$="-hc"] .ld-card` inside `@container style(--ld-contrast: high)`.
const GUARDS = [
  { root: /\[data-theme\$="-hc"\]\s/, query: '@container style(--ld-contrast: high)' },
  { root: /(\[data-theme\^="dark"\]|(?<![\w-])\.dark)\s/, query: '@container style(--ld-scheme: dark)' },
  { root: /\[data-glass="solid"\]\s/, query: '@container style(--ld-glass: solid)' },
];
const SHEETS = ['registry/lede/lede.components.css', 'registry/lede/lede.blocks.css', 'src/styles/globals.css', 'registry/lede/looks/skeuo.css', 'registry/lede/looks/brutal.css', 'registry/lede/looks/broadsheet.css'];

/** Each style rule's selector, with the at-rule preludes around it. */
function rules(text: string) {
  const found: Array<{ selector: string; within: string[] }> = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { stack.push(text.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, '').trim()); start = i + 1; }
    else if (text[i] === '}') {
      const prelude = stack.pop()!;
      if (!prelude.startsWith('@')) found.push({ selector: prelude.replace(/\s+/g, ' '), within: [...stack] });
      start = i + 1;
    }
  }
  return found;
}

test('every rule that reads a theme root from a descendant asks the nearest root', () => {
  const unguarded = SHEETS.flatMap((sheet) => rules(readFileSync(sheet, 'utf8'))
    .filter(({ selector, within }) => GUARDS.some(({ root, query }) => root.test(selector) && !within.includes(query)))
    .map(({ selector }) => `${sheet}: ${selector}`));
  expect(unguarded).toEqual([]);
});
