// What each look looks like, in light and dark, on the pages that show most of the components. On a push to develop
// the visual workflow records these (VISUAL=record) as the baseline; on a pull request into develop it takes the same
// screenshots of the pull request's build, keeps every one as an artifact for the pull request's *Screenshots*, and
// compares each with develop's (VISUAL=compare). Both run on the same runner image and Chromium, with the clock and
// motion fixed, so the same build renders the same pixels and a difference is the pull request's.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const LOOKS = ['lede', 'skeuo', 'brutal', 'broadsheet'] as const;
const SCHEMES = ['light', 'dark'] as const;
const ROUTES = ['/looks', '/components', '/app/inbox/m1', '/app/settings/appearance', '/layouts/workbench'];
const OUT = process.env.VISUAL_OUT_DIR || 'visual-screenshots';

test.skip(!process.env.VISUAL, 'VISUAL is unset, so no screenshots are recorded or compared.');

for (const route of ROUTES) {
  for (const look of LOOKS) {
    for (const scheme of SCHEMES) {
      const name = `${route.slice(1).replaceAll('/', '-')}--${look}--${scheme}.png`;
      test(`${route} · ${look} · ${scheme}`, async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'));
        await page.emulateMedia({ colorScheme: scheme });
        const params = new URLSearchParams({ scheme, chrome: '0' });
        if (look !== 'lede') params.set('look', look);
        await page.goto(`${route}?${params}`);
        await expect(page.locator('main')).toBeVisible();
        if (look === 'lede') await expect(page.locator('.app-root')).not.toHaveAttribute('data-look');
        else await expect(page.locator('.app-root')).toHaveAttribute('data-look', look);
        await page.evaluate(() => document.fonts.ready);
        const options = { fullPage: true, animations: 'disabled', caret: 'hide' } as const;
        // Every screenshot is kept, matching or not, so a pull request can show them.
        mkdirSync(OUT, { recursive: true });
        writeFileSync(`${OUT}/${name}`, await page.screenshot(options));
        await expect(page).toHaveScreenshot(name, { ...options, maxDiffPixelRatio: 0.001 });
      });
    }
  }
}
