import { expect, test } from '@playwright/test';

// StatusList on the Blocks page: worst first, each row's status in words, and an empty list that says so.
test('StatusList lists the worst first and says so when nothing needs a look', async ({ page }) => {
  await page.goto('/blocks');
  const list = page.getByRole('region', { name: 'Needs attention', exact: true });
  await expect(list.getByRole('listitem')).toHaveText([/edge-sfo-2.*Failed/, /api-iad-1.*Would change/, /cache-lhr-1.*Not checked lately/]);
  await expect(list.locator('[data-row-id="edge-sfo-2"] .ld-status-critical')).toHaveText('Failed');
  const empty = page.getByRole('region', { name: 'Needs attention later' });
  await expect(empty.getByText('Nothing needs a look.')).toBeVisible();
  await expect(empty.getByRole('list')).toHaveCount(0);
});
