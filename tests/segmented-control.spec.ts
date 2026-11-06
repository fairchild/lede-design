// A SegmentedControl's thumb covers the checked option, and its labels stay inside the control, when the labels differ
// in length and the box is narrow, at the default and at double the browser's text size. Doubling the text makes
// the segments unequal, and in the narrowest boxes the segments stack.
import { test, expect, type Locator, type Page } from '@playwright/test';

async function textSize(page: Page, scale: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 * scale, fixed: 13 * scale } });
}

// The largest difference, in px, between the thumb's box and the checked label's.
const gap = (set: Locator) => set.evaluate((el) => {
  const thumb = el.querySelector('.ld-seg-thumb')!.getBoundingClientRect();
  const label = el.querySelector('input:checked + .ld-seg-label')!.getBoundingClientRect();
  return Math.max(...(['left', 'top', 'width', 'height'] as const).map((k) => Math.abs(thumb[k] - label[k])));
});

// Whether the control, or any label in it, is wider than its box.
const overflows = (set: Locator) => set.evaluate((el) =>
  [el, ...el.querySelectorAll('.ld-seg-label')].some((e) => e.scrollWidth > e.clientWidth + 1));

const FIXTURES = ['Unequal labels, 288px, compact', 'Unequal labels, 288px, regular', 'A long label, 240px', 'Inline, 240px', 'Options replaced, 288px'];

for (const scale of [1, 2]) {
  for (const fixture of FIXTURES) {
    test(`at ${scale * 100}% text, ${fixture}: the thumb covers each checked option and every label fits`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await textSize(page, scale);
      await page.goto('/fixtures/segmented-control');
      const set = page.getByRole('region', { name: fixture }).locator('fieldset.ld-seg');
      await expect(set).toBeVisible(); // the fixture's code loads on demand, so it can render after goto returns
      for (const input of await set.locator('.ld-seg-input').all()) {
        await input.check();
        await expect.poll(() => gap(set)).toBeLessThanOrEqual(1);
        expect(await overflows(set)).toBe(false);
      }
    });
  }
}

test('at double text, segments are unequal in a 288px box and stack in a 240px one', async ({ page }) => {
  await textSize(page, 2);
  await page.goto('/fixtures/segmented-control');
  const items = page.getByRole('region', { name: 'Unequal labels, 288px, compact' }).locator('.ld-seg-item');
  await expect(items).toHaveCount(3);
  const widths = await items.evaluateAll((all) => all.map((i) => Math.round(i.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBeGreaterThan(1);
  const stacked = page.getByRole('region', { name: 'A long label, 240px' }).locator('fieldset.ld-seg');
  await expect(stacked).toHaveAttribute('data-fit', 'stacked');
  // Each option is on a row of its own: below the one before it, with nothing beside it.
  const rows = await stacked.locator('.ld-seg-item').evaluateAll((all) => all.map((i) => i.getBoundingClientRect().toJSON() as DOMRect));
  expect(rows).toHaveLength(3);
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i].top).toBeGreaterThanOrEqual(rows[i - 1].bottom - 0.5);
    expect(Math.abs(rows[i].left - rows[0].left)).toBeLessThanOrEqual(0.5);
  }
});

test('at double text, a stacked control goes back to a row when its box widens', async ({ page }) => {
  await textSize(page, 2);
  await page.goto('/fixtures/segmented-control');
  const set = page.getByRole('region', { name: 'Inline, 240px' }).locator('fieldset.ld-seg');
  await expect(set).toHaveAttribute('data-fit', 'stacked');
  await set.evaluate((el) => { el.parentElement!.style.width = '900px'; });
  await expect(set).not.toHaveAttribute('data-fit');
  await expect.poll(() => gap(set)).toBeLessThanOrEqual(1);
});

test('at double text, after options are replaced by new values, a longer label still moves the thumb and the fit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await textSize(page, 2);
  await page.goto('/fixtures/segmented-control');
  const region = page.getByRole('region', { name: 'Options replaced, 288px' });
  const set = region.locator('fieldset.ld-seg');
  await region.getByRole('button', { name: 'Replace options' }).click();
  await expect.poll(() => gap(set)).toBeLessThanOrEqual(1);
  await region.getByRole('button', { name: 'Lengthen the first label' }).click();
  await expect(set.getByRole('radio', { name: 'The first option' })).toBeAttached();
  await expect.poll(() => gap(set)).toBeLessThanOrEqual(1);
  expect(await overflows(set)).toBe(false);
});

test('arrow keys still move the checked option, and the thumb follows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await textSize(page, 2);
  await page.goto('/fixtures/segmented-control');
  const set = page.getByRole('region', { name: 'Unequal labels, 288px, compact' }).locator('fieldset.ld-seg');
  await set.getByRole('radio', { name: 'Unread' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(set.getByRole('radio', { name: 'Archived' })).toBeChecked();
  await expect.poll(() => gap(set)).toBeLessThanOrEqual(1);
});

test('without ResizeObserver it renders, keeps CSS\'s equal-share thumb and stays operable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'ResizeObserver', { value: undefined }));
  await page.goto('/fixtures/segmented-control');
  const set = page.getByRole('region', { name: 'Unequal labels, 288px, regular' }).locator('fieldset.ld-seg');
  await set.getByRole('radio', { name: 'Archived' }).check();
  await expect(set.getByRole('radio', { name: 'Archived' })).toBeChecked();
  const thumb = set.locator('.ld-seg-thumb');
  await expect(thumb).toHaveAttribute('style', /--ld-seg-i: ?2/);
  expect(await thumb.evaluate((el) => el.style.getPropertyValue('--ld-seg-x'))).toBe('');
  expect(await set.getAttribute('data-fit')).toBeNull();
  expect(errors).toEqual([]);
});
