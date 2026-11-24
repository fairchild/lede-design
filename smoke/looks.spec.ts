// Production should look like the preview the release was approved on. The preview's smoke run records full-page
// screenshots of these pages (SMOKE_SCREENSHOTS=record) and keeps them as an artifact; the production smoke run
// downloads the ones for the released commit and compares (SMOKE_SCREENSHOTS=compare). Both run on the same runner
// image and Chromium, with the clock and motion fixed, so the same build renders the same pixels.
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/components', '/blocks/data-table', '/looks', '/app/inbox', '/app/settings/appearance'];
/** Pages that keep growing as their demos load more rows, so only the first screen is compared. */
const FIRST_SCREEN = new Set(['/blocks/data-table']);

test.skip(!process.env.SMOKE_SCREENSHOTS, 'SMOKE_SCREENSHOTS is unset, so no screenshots are recorded or compared.');

for (const path of PAGES) {
  test(`${path} looks as it did on the preview`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'));
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const name = path === '/' ? 'overview' : path.slice(1).replaceAll('/', '_');
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: !FIRST_SCREEN.has(path), animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
