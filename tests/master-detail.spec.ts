import { expect, test } from '@playwright/test';

// `stickyList`: on a wide screen a long list stays in view in its own scrolling pane while the page scrolls a long
// detail. Narrow screens show one pane at a time, so it changes nothing there.
test('with stickyList, the list pane stays in view and scrolls on its own beside a long detail', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The panes sit side by side on a wide screen only.');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fixtures/master-detail?long');
  const list = page.getByRole('region', { name: 'Items', exact: true });
  const detail = page.getByRole('region', { name: 'Item', exact: true });
  await expect(detail.getByRole('heading', { name: 'Item 1' })).toBeVisible();
  const before = (await list.boundingBox())!;
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  const after = (await list.boundingBox())!;
  expect(after.y).toBeGreaterThanOrEqual(0);
  expect(after.y + after.height).toBeLessThanOrEqual(720 + 1);
  expect(before.height).toBeLessThanOrEqual(720);
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.getByRole('button', { name: 'Item 40' }).focus();
  await expect(list.getByRole('button', { name: 'Item 40' })).toBeInViewport();
});
