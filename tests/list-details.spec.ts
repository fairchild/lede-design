import { expect, test } from '@playwright/test';

// ListRow's `details`: the row is a button that opens content under it, in the same list item.
test.beforeEach(async ({ page }) => {
  await page.goto('/fixtures/list-row');
});

test('a row with details opens and closes them, and keeps focus and its list item', async ({ page }) => {
  const group = page.getByRole('region', { name: 'Runs' });
  await expect(group.getByRole('listitem')).toHaveCount(2);
  const row = group.getByRole('button', { name: /^Deploy edge-sfo-2/ });
  const details = group.getByText('Health check timed out after 30 seconds.');
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toBeHidden();
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(details).toBeVisible();
  await expect(row).toBeFocused();
  // The opened content is inside the row's own list item, and the button names it with `aria-controls`.
  const item = group.locator('[data-row-id="run-2"]');
  await expect(item.getByText('Health check timed out after 30 seconds.')).toBeVisible();
  const controls = await row.getAttribute('aria-controls');
  await expect(page.locator(`[id="${controls}"]`)).toContainText('Health check timed out');
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toBeHidden();
});

test('Enter and Space open a row from the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A keyboard path.');
  const row = page.getByRole('region', { name: 'Runs' }).getByRole('button', { name: /^Deploy edge-sfo-2/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(row).toHaveAttribute('aria-expanded', 'false');
});

test('defaultOpen starts open, and closed details wait as hidden="until-found" for find-in-page', async ({ page }) => {
  const group = page.getByRole('region', { name: 'Runs' });
  await expect(group.getByRole('button', { name: /^Deploy api-iad-1/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(group.getByText('Rolled out to 3 of 3 instances.')).toBeVisible();
  const closed = group.locator('[data-row-id="run-2"] .ld-row-details');
  await expect(closed).toHaveAttribute('hidden', 'until-found');
  // The browser fires `beforematch` when find-in-page lands inside; the row opens.
  await closed.evaluate((el) => el.dispatchEvent(new Event('beforematch')));
  await expect(group.getByRole('button', { name: /^Deploy edge-sfo-2/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(closed).not.toHaveAttribute('hidden');
});

test('revealed swipe actions stay the height of the row when its details are open', async ({ page }) => {
  const item = page.locator('[data-row-id="run-2"]');
  await item.getByRole('button', { name: /^Deploy edge-sfo-2/ }).click();
  const [row, actions] = await Promise.all([item.locator('.ld-row').boundingBox(), item.locator('.ld-row-actions').boundingBox()]);
  expect(actions!.height).toBeCloseTo(row!.height, 0);
});
