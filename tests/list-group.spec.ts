import { expect, test } from '@playwright/test';

// ListRow's `subtitleLines` and ListGroup's `empty`, on /fixtures/list-row.
test.beforeEach(async ({ page }) => { await page.goto('/fixtures/list-row'); });

test('a subtitle shows one line by default, two with subtitleLines={2}, and every line with "all"', async ({ page }) => {
  const box = page.getByRole('region', { name: 'Subtitles that wrap, 288px' });
  const lines = (n: string) => box.locator(`[data-row-id="lines-${n}"] .ld-row-subtitle`).evaluate((el) => {
    const s = getComputedStyle(el);
    return Math.round(el.getBoundingClientRect().height / parseFloat(s.lineHeight));
  });
  expect(await lines('1')).toBe(1);
  expect(await lines('2')).toBe(2);
  expect(await lines('all')).toBeGreaterThan(2);
});

test('a group with no rows shows its empty text in place of an empty list', async ({ page }) => {
  const group = page.getByRole('region', { name: 'An emptied group' });
  await expect(group.getByRole('heading', { name: 'Hosts' })).toBeVisible();
  await expect(group.getByText('No hosts match “zz”.')).toBeVisible();
  await expect(group.getByRole('list')).toHaveCount(0);
});
