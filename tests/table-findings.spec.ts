// Smaller Table findings (#64), on /fixtures/table: a SortButton that agrees with its header, row titles the hover
// code leaves alone, a scroll box that keeps focus, and a close from outside that keeps focus.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/fixtures/table');
  await expect(page.getByRole('heading', { level: 1, name: 'Table fixtures' })).toBeVisible();
});

test('a sort button reads its header’s sort, after the caller’s own description', async ({ page }) => {
  const table = page.getByRole('table', { name: 'Sorted table' });
  await expect(table.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  await expect(table.getByRole('button', { name: 'Name' })).toHaveAccessibleDescription('Sorting reloads the page. Sorted descending');
});

test('hover leaves a row’s own title, and a nested table’s rows, as they were', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover titles are for a pointer that hovers.');
  const outer = page.getByRole('table', { name: 'Titled rows' });
  const own = outer.getByRole('row').filter({ hasText: 'Own' });
  const cell = own.getByRole('cell');
  expect(await cell.locator('.ld-table-trunc').evaluate((el) => el.scrollWidth > el.clientWidth), 'the cell is clipped').toBe(true);
  await cell.hover();
  await page.getByRole('row').filter({ hasText: /^Nested/ }).getByRole('rowheader').hover();
  await page.mouse.move(0, 0);
  await expect(own).toHaveAttribute('title', 'The row’s own title');
  await expect(page.getByRole('table', { name: 'Inner table' }).getByRole('row')).toHaveAttribute('title', 'The inner row’s title');
});

test('a focused link shows the full text of every clipped cell in its row', async ({ page }) => {
  const row = page.getByRole('table', { name: 'Titled rows' }).getByRole('row').filter({ hasText: 'Linked' });
  const clipped = row.getByRole('cell').locator('.ld-table-trunc');
  expect(await clipped.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await row.getByRole('link', { name: 'Linked' }).focus();
  await expect.poll(() => clipped.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
});

test('a click on a row’s checkbox leaves its clipped cells clipped, so the row keeps its height', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A pointer click; a tap is the same.');
  const row = page.getByRole('table', { name: 'Titled rows' }).getByRole('row').filter({ hasText: 'Ticked' });
  const height = (await row.boundingBox())!.height;
  await row.getByRole('checkbox').click();
  await expect(row.getByRole('checkbox')).toBeFocused();
  expect(await row.getByRole('cell').locator('.ld-table-trunc').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect((await row.boundingBox())!.height).toBe(height);
});

test('a scroll box that stops overflowing while it has focus keeps it', async ({ page }) => {
  const box = page.getByRole('region', { name: 'Wide table' });
  await box.focus();
  await expect(box).toBeFocused();
  await box.evaluate((el) => { el.style.width = '800px'; });
  await page.waitForTimeout(100);
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.ld-table-scroll[style*="800px"]')).not.toHaveAttribute('tabindex');
});

test('a close from inside the rows moves focus to the caption’s button', async ({ page }) => {
  const close = page.getByRole('button', { name: 'Close the table' });
  await close.focus();
  await close.press('Enter');
  await expect(page.getByRole('button', { name: /^Closing totals/ })).toBeFocused();
  await expect(page.getByRole('button', { name: /^Closing totals/ })).toHaveAttribute('aria-expanded', 'false');
});
