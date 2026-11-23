import { test, expect, type Page } from '@playwright/test';
import { withAppearance } from './appearance';
import AxeBuilder from '@axe-core/playwright';

// The site's looks (src/styles/looks.css), turned on with `?look=`. The rest of the suite runs with no look, so these are
// the only tests that see one. Each look passes axe in every theme on the pages that show most of the components, high
// contrast keeps Lede's own -hc palette under a look, and a phone at 200% text is no wider than at 100%.
const LOOKS = ['skeuo', 'brutal', 'broadsheet'] as const;
const ROUTES = ['/looks', '/components', '/app/inbox/m1', '/app/settings/appearance', '/layouts/workbench'];
const MODES = [
  { name: 'light', scheme: 'light' as const, hc: false },
  { name: 'dark', scheme: 'dark' as const, hc: false },
  { name: 'light-hc', scheme: 'light' as const, hc: true },
  { name: 'dark-hc', scheme: 'dark' as const, hc: true },
];
/** The colors high contrast is for: a look's palette steps aside for these in -hc. */
const HC_COLORS = ['--background', '--background-grouped', '--card', '--foreground', '--muted-foreground', '--primary', '--input', '--border', '--ring'];

async function open(page: Page, route: string, look: string, mode: (typeof MODES)[number]) {
  await page.emulateMedia({ colorScheme: mode.scheme });
  await withAppearance(page, { highContrast: mode.hc });
  await page.goto(`${route}?look=${look}&chrome=0`);
  await expect(page.locator('main')).toBeVisible();
  if (look === 'lede') await expect(page.locator('html')).not.toHaveAttribute('data-look');
  else await expect(page.locator('html')).toHaveAttribute('data-look', look);
}

for (const look of LOOKS) {
  for (const mode of MODES) {
    for (const route of ROUTES) {
      test(`${look} · ${route} · ${mode.name} passes axe`, async ({ page, isMobile }) => {
        test.skip(isMobile && mode.name !== 'light' && mode.name !== 'dark-hc', 'A phone runs light and dark-hc, as a11y.spec does.');
        await open(page, route, look, mode);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any.map((c) => c.message).join('; ')})`).join(', ')}`)).toEqual([]);
      });
    }
  }
}

for (const look of LOOKS) {
  for (const mode of MODES.filter((m) => m.hc)) {
    test(`${look} · ${mode.name} keeps Lede's high-contrast colors`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'The palette is the same at every viewport.');
      const colors = async (l: string) => {
        await open(page, '/app/inbox', l, mode);
        await expect(page.locator('.app-root')).toHaveAttribute('data-theme', `${mode.scheme}-hc`);
        return page.locator('.app-root').evaluate((el, names) => {
          const style = getComputedStyle(el);
          return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()]));
        }, HC_COLORS);
      };
      expect(await colors(look)).toEqual(await colors('lede'));
    });
  }
}

for (const look of LOOKS) {
  for (const route of ['/looks', '/app/inbox/m1', '/app/settings/appearance']) {
    test(`${look} · ${route} · 200% text is no wider than 100%`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'A phone is the narrow case.');
      const cdp = await page.context().newCDPSession(page);
      const width = async (scale: number) => {
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 * scale, fixed: 13 * scale } });
        await open(page, route, look, MODES[0]);
        await page.evaluate(() => document.fonts.ready);
        return page.evaluate(() => document.documentElement.scrollWidth);
      };
      const normal = await width(1);
      expect(await width(2)).toBeLessThanOrEqual(normal);
    });
  }
}

// A look's sheen lies over a Button's fill, so hover and a critical Button keep it.
test('skeuo · a filled Button keeps its sheen on hover, and a critical one has it too', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone has no hover.');
  await open(page, '/components', 'skeuo', MODES[0]);
  const sheen = (button: ReturnType<Page['locator']>) => button.evaluate((el) => getComputedStyle(el).backgroundImage);
  const filled = page.locator('main .ld-btn-filled:not(.ld-btn-critical):not(:disabled)').first();
  expect(await sheen(filled)).toContain('linear-gradient');
  await filled.hover();
  expect(await sheen(filled)).toContain('linear-gradient');
  expect(await sheen(page.locator('main .ld-btn-critical.ld-btn-filled').first())).toContain('linear-gradient');
});

// Broadsheet draws no shadows, and says so with a shadow that draws nothing: `none` inside a shadow list voids the list.
test('broadsheet · a selected segment keeps its edge', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The rule is the same at every viewport.');
  await open(page, '/components', 'broadsheet', MODES[0]);
  const selected = page.locator('main .ld-seg-thumb').first();
  expect(await selected.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
});

// Brutal's separators are 2px. High contrast draws separators at least 1px, so it keeps them at 2px, not thinner.
test('brutal · high contrast keeps its 2px separators', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The rule is the same at every viewport.');
  await open(page, '/app/inbox/m1', 'brutal', MODES[2]);
  const width = (selector: string, side: string) => page.locator(selector).first().evaluate((el, s) => getComputedStyle(el, s === 'top' ? '::before' : null).getPropertyValue(`border-${s}-width`), side);
  expect(await width('.ld-row-wrap + .ld-row-wrap', 'top')).toBe('2px');
  expect(await width('.ld-message-header', 'bottom')).toBe('2px');
});
