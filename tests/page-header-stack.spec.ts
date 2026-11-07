import { expect, test } from '@playwright/test';

test('in a flow’s stack, a PageHeader and the inline-level control after it sit one stack step apart', async ({ page }) => {
  await page.goto('/fixtures/page-header');
  const stack = page.getByRole('region', { name: 'A header in a stack' });
  const [header, control, step] = await Promise.all([
    stack.locator('header').boundingBox(),
    stack.locator('.ld-switch').boundingBox(),
    stack.evaluate((el) => parseFloat(getComputedStyle(el.lastElementChild!).marginTop)),
  ]);
  expect(Math.round(control!.y - (header!.y + header!.height))).toBe(Math.round(step));
});
