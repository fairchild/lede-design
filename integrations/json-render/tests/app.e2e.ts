import { expect, test } from '@playwright/test';

// The page itself: its recorded Inbox opens a message in place, as SpecView draws it.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Inbox' }).check();
});

test('a row opens its message, Escape returns to the row and so does Back', async ({ page }) => {
  const preview = page.getByRole('region', { name: 'Preview' });
  const row = preview.locator('.ld-row-target', { hasText: 'Alan Turing' });
  await expect(preview.locator('[data-row-id="m2"]')).toHaveCount(1);
  await row.press('Enter');
  await expect(preview.getByRole('heading', { level: 2, name: 'Alan Turing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(row).toBeFocused();
  await row.press('Enter');
  await preview.getByRole('button', { name: 'Inbox' }).click();
  await expect(row).toBeFocused();
});

test('an action a spec runs shows in the log', async ({ page }) => {
  const preview = page.getByRole('region', { name: 'Preview' });
  await preview.getByRole('button', { name: 'More actions for Grace Hopper' }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByRole('list', { name: 'Actions, newest first' })).toHaveText('archive {"id":"m1"}');
});
