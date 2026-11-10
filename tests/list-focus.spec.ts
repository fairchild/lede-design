// What a ListRow, a MasterDetail and a WorkbenchShell do with props the focus table doesn't reach: a row with both
// `href` and `onClick`, a detail of `false` and a shell too narrow for its main pane with both panels collapsed.
import { test, expect } from '@playwright/test';

test('a row with href and onClick runs onClick when its link is clicked', async ({ page }) => {
  await page.goto('/fixtures/list-focus');
  const row = page.getByRole('link', { name: /^Counted link/ });
  await expect(row).toContainText('Clicks: 0');
  await row.click();
  await expect(row).toContainText('Clicks: 1');
  await expect(page).toHaveURL(/#counted$/);
});

test('a MasterDetail whose detail is false shows its empty state and opens no pane', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/fixtures/master-detail');
  await expect(page.getByText('Pick an item to read it.')).toBeVisible();
  await expect(page.locator('.ld-md')).not.toHaveAttribute('data-detail-open');
  await page.setViewportSize({ width: 800, height: 800 });
  await expect(page.getByRole('region', { name: 'Items', exact: true })).toBeVisible();
});

test('a WorkbenchShell narrower than its main pane, with both panels collapsed, draws whole widths', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'One viewport walk covers it.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/layouts/workbench');
  for (const panel of ['Files', 'Assistant']) await page.getByRole('button', { name: `${panel} panel` }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(() => page.locator('.ld-wb').evaluate((el) => el.clientWidth)).toBeLessThan(400);
  const widths = await page.locator('.ld-wb-panel').evaluateAll((els) => els.map((el) => (el as HTMLElement).style.getPropertyValue('--ld-wb-width')));
  expect(widths).toEqual(['0px', '0px']);
});

test('a row action that takes its whole group away leaves focus to the parent', async ({ page }) => {
  await page.goto('/fixtures/list-focus');
  await page.getByRole('button', { name: 'More actions for Old notes' }).click();
  await page.getByRole('menuitem', { name: 'Clear the archive' }).click();
  await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toHaveCount(0);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  // The fixture's parent moves no focus, so focus stays where the browser left it, and the next list's row doesn't take it.
  await expect(page.getByRole('link', { name: /^Weekly summary/ })).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});
