// A ThemeProvider is its own theme root: what's inside it follows the nearest provider, never a further one. The fixture
// nests light inside dark, high contrast and solid glass, then dark inside that light again, beside a light provider on
// its own as the reference.
import { test, expect, type Page } from '@playwright/test';

const PROBES = ['reference', 'outer', 'nested', 'again'] as const;
type Probe = (typeof PROBES)[number];

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
