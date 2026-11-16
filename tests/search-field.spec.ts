import { expect, test } from '@playwright/test';

// SearchField keeps Escape while it holds text, and passes it on to PageHeader's `backOnEscape` once it's empty.
test.beforeEach(async ({ page }) => {
  await page.goto('/fixtures/page-header');
  await page.getByRole('button', { name: 'Open the detail' }).click();
});

test('Escape clears the field first, and backs out of the detail once it is empty', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Escape is a keyboard path.');
  const field = page.getByRole('searchbox', { name: 'Filter venues' });
  await field.fill('harbor');
  await expect(page.getByRole('button', { name: 'Clear Filter venues' })).toBeVisible();
  await field.press('Escape');
  await expect(field).toHaveValue('');
  await expect(field).toBeFocused();
  await expect(page.getByRole('button', { name: 'Clear Filter venues' })).toHaveCount(0);
  await field.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open the detail' })).toBeFocused();
});

test('the clear button empties the field and returns focus to it', async ({ page }) => {
  const field = page.getByRole('searchbox', { name: 'Filter venues' });
  await field.fill('harbor');
  await page.getByRole('button', { name: 'Clear Filter venues' }).click();
  await expect(field).toHaveValue('');
  await expect(field).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Venue for Thursday' })).toBeVisible();
});
