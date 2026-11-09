import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { NOT_FOUND, ROUTES } from './routes';
import { openPanels } from './open-panels';

// Every route, in light, dark and both high-contrast themes: no axe violations, exactly one exposed h1, and still no
// violations with every Disclosure and collapsible table open. A phone renders other DOM, such as the data table's cards
// and the tab bar, but no other colors, so it runs in one light theme and one dark high-contrast one. Desktop runs all
// four, and the build's contrast gate measures every token pair in every theme.
const PHONE_MODES = new Set(['light', 'dark-hc']);
const MODES = [
  { name: 'light', scheme: 'light' as const, hc: false },
  { name: 'dark', scheme: 'dark' as const, hc: false },
  { name: 'light-hc', scheme: 'light' as const, hc: true },
  { name: 'dark-hc', scheme: 'dark' as const, hc: true },
];

async function visibleH1s(page: Page) {
  return page.locator('h1').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed').length);
}

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const mode of MODES) {
  for (const route of ROUTES) {
    test(`${route} · ${mode.name}`, async ({ page, isMobile }) => {
      test.skip(isMobile && !PHONE_MODES.has(mode.name), 'A phone runs light and dark-hc; desktop runs every theme.');
      await page.emulateMedia({ colorScheme: mode.scheme });
      await page.addInitScript((hc) => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: hc })), mode.hc);
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      // The not-found pages pass axe too, so a route that has gone missing must fail here.
      if (!NOT_FOUND.has(route)) await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toHaveCount(0);
      expect(await violations(page)).toEqual([]);
      expect(await visibleH1s(page)).toBe(1);
      // A closed panel's body is hidden from axe, so the route is checked again with every one open.
      if (!(await openPanels(page))) return;
      expect(await violations(page), 'with every panel open').toEqual([]);
    });
  }
}

// Doubling the browser's text size makes no phone page wider than it is at the default size, at 360px and 412px: long
// labels wrap, and grids drop a column. On these routes a server-mode table says "Loading", then "50 of 100+", then its
// exact count, up to about 2.2s in; the width is read after the exact count.
const ESTIMATED = new Set(['/app/work', '/blocks/data-table']);
for (const route of ROUTES) {
  test(`${route} · 200% text is no wider than 100%`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'A phone is the narrow case.');
    const cdp = await page.context().newCDPSession(page);
    const width = async (scale: number) => {
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 * scale, fixed: 13 * scale } });
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${16 * scale}px`);
      if (ESTIMATED.has(route)) {
        await expect.poll(() => page.locator('.ld-dt-summary').evaluateAll((all) =>
          all.length > 0 && all.every((s) => !/Loading|\d\+/.test(s.textContent ?? ''))), { timeout: 10_000 }).toBe(true);
      }
      // Rows that load after the page (the work list's arrive after 350ms) can widen it, so the width is read once it
      // has held for three reads 400ms apart.
      const reads: number[] = [];
      await expect.poll(async () => {
        reads.push(await page.evaluate(() => document.documentElement.scrollWidth));
        return reads.length >= 3 && reads.slice(-3).every((w) => w === reads.at(-1));
      }, { intervals: [400] }).toBe(true);
      return reads.at(-1)!;
    };
    for (const screen of [360, 412]) {
      await page.setViewportSize({ width: screen, height: 800 });
      const before = Math.max(await width(1), screen);
      expect(await width(2), `${screen}px`).toBeLessThanOrEqual(before);
    }
  });
}

// A mouse reveals the ••• by hovering its row. A touch screen always shows it, so a phone taps it.
async function openRowMenu(row: Locator, name: string | RegExp, isMobile: boolean) {
  const more = row.getByRole('button', { name });
  if (isMobile) return more.tap();
  await row.hover();
  await more.click();
}

test('Disclosure opens from its heading button and find-in-page can reach closed panels', async ({ page }) => {
  await page.goto('/app');
  const trigger = page.getByRole('button', { name: /Meetings/ });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[hidden="until-found"]').first()).toBeAttached();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

test('Row actions are reachable without swiping (••• menu)', async ({ page, isMobile }) => {
  await page.goto('/app/inbox');
  await openRowMenu(page.getByRole('listitem').filter({ hasText: 'Launch date' }), /More actions/, isMobile);
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
});

test('Row actions name their message, stay hidden until swiped, and hand focus to the next row when the row leaves', async ({ page, isMobile }) => {
  await page.goto('/app/inbox');
  const row = page.getByRole('listitem').filter({ hasText: 'Launch date' });
  await expect(row.locator('.ld-row-action').first()).toBeHidden();
  await openRowMenu(row, 'More actions for Launch date: Tuesday or Thursday?', isMobile);
  const archive = page.getByRole('menuitem', { name: 'Archive' });
  await (isMobile ? archive.tap() : archive.click());
  await expect(page.getByRole('link', { name: /Design review agenda/ })).toBeFocused();
});

test('Bulk actions hand focus to the first row left after the first one removed', async ({ page }) => {
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('link', { name: /Records migration review/ })).toBeFocused();
});

test('Every page has its own document title', async ({ page }) => {
  await page.goto('/components');
  await expect(page).toHaveTitle('Components · Lede');
  await page.goto('/app/settings');
  await expect(page).toHaveTitle('Settings · Lede');
});

test('Each page names its own address as canonical, and keeps it in step after a link', async ({ page, request }) => {
  // The shell every route serves names no address, so a crawler that runs no script finds no canonical at all.
  const shell = await (await request.get('/components')).text();
  expect(shell).not.toMatch(/rel="canonical"|property="og:url"/);
  const canonical = page.locator('link[rel="canonical"]');
  const ogUrl = page.locator('meta[property="og:url"]');
  await page.goto('/');
  await expect(canonical).toHaveAttribute('href', 'https://lede.cloudcompute.com/');
  await page.goto('/components');
  await expect(canonical).toHaveAttribute('href', 'https://lede.cloudcompute.com/components');
  await expect(ogUrl).toHaveAttribute('content', 'https://lede.cloudcompute.com/components');
  await page.getByRole('link', { name: 'Blocks' }).first().click();
  await expect(page).toHaveURL(/\/blocks$/);
  await expect(canonical).toHaveAttribute('href', 'https://lede.cloudcompute.com/blocks');
  await expect(ogUrl).toHaveAttribute('content', 'https://lede.cloudcompute.com/blocks');
  await expect(canonical).toHaveCount(1);
});

test('A work item’s tab is named for the item, and a missing one for its h1', async ({ page }) => {
  await page.goto('/app/work/WI-1001');
  const title = await page.getByRole('heading', { level: 1 }).textContent();
  expect(title).not.toBe('Not found');
  await expect(page).toHaveTitle(`${title} · Lede`);
  // Moving to another item inside the app renames the tab too.
  await page.getByRole('main').getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveTitle('Work · Lede');
  await page.getByRole('link', { name: /\bWI-\d+/ }).filter({ hasNotText: 'WI-1001' }).first().click();
  // Read together, so the list's h1 on its way out can't stand in for the new item's.
  await expect.poll(async () => {
    const h1 = await page.getByRole('heading', { level: 1 }).textContent();
    return h1 !== 'Work' && h1 !== title && (await page.title()) === `${h1} · Lede`;
  }).toBe(true);
  await page.goto('/app/work/WI-9999');
  await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
  await expect(page).toHaveTitle('Not found · Lede');
});

test('A missing page inside the app keeps the app’s navigation, says so in its one h1, and leads back to Today', async ({ page, isMobile }) => {
  for (const path of ['/app/nope', '/app/settings/nope']) {
    await page.goto(path);
    const h1 = page.getByRole('heading', { level: 1, name: 'Page not found' });
    await expect(h1).toBeFocused();
    expect(await page.getByRole('heading').allTextContents(), path).toEqual(['Page not found']);
    await expect(page).toHaveTitle('Page not found · Lede');
    const nav = page.getByRole('navigation', { name: 'App' }).filter({ visible: true });
    await expect(nav.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible();
    // A page that isn't there belongs to no place, so no place is marked as the current one.
    await expect(nav.locator('[aria-current]')).toHaveCount(0);
  }
  const back = page.getByRole('main').getByRole('link', { name: 'Today' });
  await (isMobile ? back.tap() : back.click());
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('A missing page outside the app says so in its one h1, the heading the reader sees, and leads to the overview', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeFocused();
  expect(await page.getByRole('heading').allTextContents()).toEqual(['Page not found']);
  await page.getByRole('link', { name: 'Go to the overview' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('A full page load starts at the top, whatever was scrolled before', async ({ page }) => {
  await page.goto('/foundations');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.goto('/blocks');
  await expect(page.getByRole('heading', { level: 1, name: 'Blocks' })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('Settings rows lead where they say', async ({ page }) => {
  await page.goto('/app/settings');
  // The delivery time is the Daily brief row's subtitle, so every row that looks like it opens something does.
  await expect(page.getByRole('link', { name: /morning/i })).toHaveCount(0);
  await expect(page.getByText('Each morning at 8:00')).toBeVisible();
  await page.getByRole('switch', { name: 'Daily brief' }).click();
  await expect(page.getByText('Each morning at 8:00')).toHaveCount(0);
});

test('Five navigation places and the selection bar fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  for (const name of ['Overview', 'Layouts']) {
    const box = await page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox').first().check();
  const bar = await page.getByRole('toolbar').boundingBox();
  expect(bar!.x).toBeGreaterThanOrEqual(0);
  expect(bar!.x + bar!.width).toBeLessThanOrEqual(320);
});

test('Five navigation places fit a 412px screen at double the text size, each label inside its place', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 839 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
  const places = await page.getByRole('navigation', { name: 'Documentation' }).getByRole('link').all();
  expect(places).toHaveLength(5);
  for (const place of places) {
    const { left, right, clipped } = await place.evaluate((el) => ({ ...el.getBoundingClientRect().toJSON(), clipped: el.scrollWidth > el.clientWidth + 1 }));
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(412);
    expect(clipped).toBe(false);
  }
});

test('Onboarding steps cannot be skipped by URL', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:profile', JSON.stringify({ name: '' })));
  await page.goto('/app/welcome/review');
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/welcome$/);
});

// Continue checks the account, so an account changed since waits for Continue again, whatever the URL.
test('A later onboarding step waits for a valid account, whatever the URL', async ({ page }) => {
  await page.goto('/app/welcome');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Name').fill('');
  await page.goto('/app/welcome/preferences');
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('');
});

test('Onboarding validates with messages that say how to fix it, then moves focus to the next step', async ({ page }) => {
  await page.goto('/app/welcome');
  await expect(page.getByRole('form', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Name').fill('');
  await page.getByLabel('Email').fill('');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter the name you want people to see.')).toBeVisible();
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  // Each step lands where the person acts next, and its form is named by the step's h1.
  await expect(page.getByRole('radio', { name: 'Blue' })).toBeFocused();
  await expect(page.getByRole('form', { name: 'Make it yours' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('form', { name: 'Review' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  const done = page.getByRole('link', { name: 'Get started' });
  await expect(done).toBeFocused();
  await expect(done).toHaveAccessibleDescription('You’re all set, Ada Your first brief arrives tomorrow morning.');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
