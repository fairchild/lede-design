import { expect, test } from '@playwright/test';

// PageHeader's `leadingLink`: the picture beside the title becomes a link, named by its label.
test('a leading picture with leadingLink is a named link that a press follows', async ({ page }) => {
  await page.goto('/fixtures/page-header');
  const header = page.locator('header', { has: page.getByRole('heading', { name: 'A header in a stack' }) });
  const home = header.getByRole('link', { name: 'Daybook home', exact: true });
  await expect(home).toHaveAttribute('href', '/app');
  // The picture inside stays hidden, so the label alone names the link.
  await expect(home.locator('[aria-hidden="true"]')).toHaveCount(1);
  const box = await home.boundingBox();
  const hit = await home.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--size-hit-min')));
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(hit - 0.5);
  await home.click();
  await expect(page).toHaveURL(/\/app$/);
});

test('a leading picture without leadingLink stays hidden and no link', async ({ page }) => {
  await page.goto('/blocks');
  const header = page.locator('header', { has: page.getByRole('heading', { name: 'Hana Sato' }) });
  await expect(header.getByRole('link')).toHaveCount(0);
});
