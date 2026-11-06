// Where focus lands when each screen appears: on a cold load, after a link in, on Back to the page the link was on and
// on Forward again, with the Tab stops around the landing, and Enter and Escape doing nothing where the spec says so.
// The rows are ARRIVALS in `tests/focus-table.ts`.
import { test, expect, type Page } from '@playwright/test';
import { ARRIVALS, UNTABLED, describe, driver, each, expectTitleRing, expectLanding, locate, ringShows, rowTests, type Arrival, type Case, type Device, type Target } from './focus-table';
import { expectNoBody, focusSettled, focusTrail, trackFocus, type Frame } from './focus-trail';
import { ROUTES } from './routes';

test.beforeEach(({ page }) => trackFocus(page));

/** The URL as a route spells it: path, search and hash. */
const here = (page: Page) => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; };

/** A key that does nothing leaves the URL and the focused element as they were. */
async function expectNothing(page: Page, key: string) {
  const url = here(page);
  await page.evaluate(() => { (window as unknown as { before: Element | null }).before = document.activeElement; });
  await page.keyboard.press(key);
  await focusTrail(page);
  expect(here(page), `${key} leaves the URL alone`).toBe(url);
  expect(await page.evaluate(() => document.activeElement === (window as unknown as { before: Element | null }).before), `${key} leaves focus alone`).toBe(true);
}

type Check = Case | 'keys';

async function arrive(page: Page, row: Arrival, device: Device, check: Set<Check>) {
  const arrival = each(row.arrival, device);
  if (check.has('cold') || check.has('tabs') || check.has('keys')) {
    await row.setup?.(page);
    await page.goto(row.route);
    if (check.has('cold')) {
      await expectLanding(page, arrival, 'Cold load');
      await expectTitleRing(page, arrival, false, 'Cold load');
    }
    else await focusTrail(page);
    if (check.has('keys')) {
      if (!row.enter || (row.enter.only && row.enter.only !== device)) await expectNothing(page, 'Enter');
      if (!row.escape) await expectNothing(page, 'Escape');
    }
    if (check.has('tabs')) {
      const from = locate(page, arrival);
      for (const [stops, key] of [[each(row.tabs ?? [], device), 'Tab'], [row.shiftTab ? [each(row.shiftTab, device)] : [], 'Shift+Tab']] as const) {
        if (!stops.length) continue;
        await from.focus();
        for (const stop of stops) {
          await page.keyboard.press(key);
          await expect(locate(page, stop), `${key} from ${describe(arrival)} reaches ${describe(stop)}`).toBeFocused();
        }
      }
    }
  }
  const { via } = row;
  if (!via || !(['link', 'back', 'forward', 'body'] as const).some((c) => check.has(c))) return;
  /** The landing for `c` when it's checked; otherwise only the trail, once focus has settled, when `body` is. */
  const land = async (c: 'link' | 'back' | 'forward', where: Target, how: string) => {
    if (check.has(c)) {
      await expectLanding(page, where, how, { body: check.has('body') });
      return expectTitleRing(page, where, device === 'desktop', how);
    }
    await focusSettled(page, 300);
    if (check.has('body')) expectNoBody(await focusTrail(page));
  };
  await page.goto(via.from);
  await locate(page, via.link).first().waitFor();
  await focusTrail(page);
  await driver(page, device).press(via.link);
  await expect.poll(() => here(page), 'the link leaves its page').not.toBe(via.from);
  await land('link', arrival, `Link in from ${via.from}`);
  await focusTrail(page);
  await page.goBack();
  await expect.poll(() => here(page)).toBe(via.from);
  await land('back', each(via.back, device), `Back to ${via.from}`);
  if (!check.has('forward') && !check.has('body')) return;
  await focusTrail(page);
  await page.goForward();
  await land('forward', arrival, 'Forward');
}

for (const row of ARRIVALS) {
  const cases: Check[] = ['keys', 'cold'];
  if (row.tabs || row.shiftTab) cases.push('tabs');
  if (row.via) cases.push('link', 'back', 'forward', 'body');
  rowTests<Check>(`${row.route} · arrival`, cases, row.pending, undefined, (page, device, check) => arrive(page, row, device, check));
}

test('a title shows no focus ring after a click, and shows it after a keyboard move', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone project moves by touch, which every arrival row checks.');
  const docs = { role: 'navigation', name: 'Documentation' } as const;
  await page.goto('/components');
  await locate(page, { role: 'link', name: 'Overview', in: docs }).click();
  await expectLanding(page, { role: 'heading', level: 1, name: 'Lede' }, 'A click');
  expect(await ringShows(page, { role: 'heading', level: 1, name: 'Lede' }), 'after a click, the h1 shows no ring').toBe(false);
  await page.goBack();
  await expectLanding(page, { role: 'heading', level: 1, name: 'Components' }, 'Back after a click');
  expect(await ringShows(page, { role: 'heading', level: 1, name: 'Components' }), 'Back after a click, the h1 shows no ring').toBe(false);
  await page.goto('/app/inbox');
  await page.getByRole('link', { name: /Launch date: Tuesday or Thursday/ }).click();
  const title = { role: 'heading', level: 2, name: 'Launch date: Tuesday or Thursday?' } as const;
  await expectLanding(page, title, 'A click on a message');
  expect(await ringShows(page, title), 'after a click, the message title shows no ring').toBe(false);
  await page.goto('/app/settings/appearance');
  await page.getByRole('radio').first().click();
  await page.keyboard.press('Escape');
  await expectLanding(page, { role: 'heading', level: 1, name: 'Settings' }, 'Escape');
  expect(await ringShows(page, { role: 'heading', level: 1, name: 'Settings' }), 'after Escape, the h1 shows the ring').toBe(true);
});

test('a click on a link that keys had focused lands on a title with no ring', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keys and a mouse together are a desktop case.');
  await page.goto('/app/settings');
  const appearance = page.getByRole('link', { name: /^Appearance/ });
  await appearance.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(appearance).toBeFocused();
  await appearance.click();
  const h1 = { role: 'heading', level: 1, name: 'Appearance' } as const;
  await expectLanding(page, h1, 'A click after keys');
  expect(await ringShows(page, h1), 'after a click, the h1 shows no ring, though keys focused the link').toBe(false);
});

test('the ring shows as soon as the key goes down', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keys are a desktop case.');
  await page.goto('/components');
  await locate(page, { role: 'link', name: 'Overview', in: { role: 'navigation', name: 'Documentation' } }).focus();
  await page.keyboard.down('Enter');
  const h1 = { role: 'heading', level: 1, name: 'Lede' } as const;
  await expectLanding(page, h1, 'Enter, still held');
  expect(await ringShows(page, h1), 'with Enter still down, the h1 shows the ring').toBe(true);
  await page.keyboard.up('Enter');
});

test('a modified click on the open message’s row leaves focus on the row', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side is a desktop layout.');
  // ControlOrMeta is the new-tab click on each platform: Meta on macOS, Control on Linux, where a Meta-click is a plain one.
  for (const modifier of ['Alt', 'ControlOrMeta', 'Shift'] as const) {
    await page.goto('/app/inbox/m2');
    const row = page.getByRole('link', { name: /Launch date: Tuesday or Thursday/ });
    await row.click({ modifiers: [modifier] });
    for (const other of page.context().pages()) if (other !== page) await other.close();
    expect(await page.getByRole('heading', { level: 2, name: 'Launch date: Tuesday or Thursday?' }).evaluate((e) => e === document.activeElement), `${modifier}-click leaves the title alone`).toBe(false);
  }
});

test('every route in tests/routes.ts has an arrival row, or is a fixture page the spec leaves out', ({ isMobile }) => {
  test.skip(isMobile, 'Reads data: one project is enough.');
  const tabled = new Set(ARRIVALS.map((r) => r.route));
  expect(ROUTES.filter((r) => !tabled.has(r) && !UNTABLED.has(r))).toEqual([]);
});

test('expectNoBody allows <body> before the first arrival and fails on it after', ({ isMobile }) => {
  test.skip(isMobile, 'Reads data: one project is enough.');
  const frame = (focus: string, arrived: boolean): Frame => ({ t: 0, focus, arrived });
  expectNoBody([frame('body', false), frame('h1 “Inbox”', false)]);
  expect(() => expectNoBody([frame('div[role=menuitem] “Archive”', true), frame('body', true), frame('h1 “Inbox”', true)])).toThrow(/menuitem.*→ body → h1/);
});
