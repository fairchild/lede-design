// The demo inbox's long message and thread: the summary leads, the latest message is open, and a long message keeps
// its subject and actions within reach.
import { test, expect, type Page } from '@playwright/test';
import { listen, spoken } from './spoken';

const THREAD = '/app/inbox/m6';
const LONG = '/app/inbox/m5';
const FIXTURE = '/fixtures/inbox/m6'; // the thread, with Reply and a long address as its sender
const thread = (page: Page) => page.getByRole('region', { name: 'Messages, newest first' });

test('a thread leads with its summary, the latest message is open and an earlier one expands', async ({ page }) => {
  await page.goto(THREAD);
  await expect(page.getByText('8 messages · 4 people · last from Priya Raman · 10:26 AM')).toBeVisible();
  const messages = thread(page).getByRole('button');
  await expect(messages).toHaveCount(8);
  await expect(messages.first()).toHaveAttribute('aria-expanded', 'true');
  for (const earlier of (await messages.all()).slice(1)) await expect(earlier).toHaveAttribute('aria-expanded', 'false');
  await expect(thread(page).getByText('We are not booking the Riverside center.')).toBeVisible();
  await expect(thread(page).getByRole('blockquote').first()).toContainText('Room is booked for both mornings');

  const turn = thread(page).getByRole('button', { name: /Tomás Herrera.*Tue 8:30/ });
  await expect(thread(page).getByText('There are two ways forward.')).toBeHidden();
  await turn.click();
  await expect(turn).toHaveAttribute('aria-expanded', 'true');
  await expect(thread(page).getByText('There are two ways forward.')).toBeVisible();
});

test('older history arriving leaves each thread message as it was', async ({ page }) => {
  await page.goto(FIXTURE);
  const latest = thread(page).getByRole('button', { name: /notifications@/ });
  const before = thread(page).getByRole('button', { name: /Tomás Herrera.*Thu 4:20 PM/ });
  const earlier = thread(page).getByRole('button', { name: /Ari Chen.*Tue 9:20/ });
  await latest.click();
  await before.click();
  await page.getByRole('button', { name: 'Load older messages' }).click();
  await expect(thread(page).getByRole('button')).toHaveCount(10);
  await expect(latest).toHaveAttribute('aria-expanded', 'false');
  await expect(before).toHaveAttribute('aria-expanded', 'true');
  await expect(earlier).toHaveAttribute('aria-expanded', 'false');
});

test('two replies from one sender in one minute keep their own state', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.getByRole('button', { name: 'Load older messages' }).click();
  const replies = thread(page).getByRole('button', { name: /Mei Lindqvist/ });
  await expect(replies).toHaveCount(2);
  await replies.first().click();
  await expect(replies.first()).toHaveAttribute('aria-expanded', 'true');
  await expect(replies.last()).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Add a new reply' }).click();
  await expect(thread(page).getByRole('button', { name: /Ari Chen.*11:02/ })).toBeVisible();
  await expect(replies).toHaveCount(2);
  await expect(replies.first()).toHaveAttribute('aria-expanded', 'true');
  await expect(replies.last()).toHaveAttribute('aria-expanded', 'false');
});

test('a new reply opens, and the rest of the thread stays as it was', async ({ page }) => {
  await page.goto(FIXTURE);
  const latest = thread(page).getByRole('button', { name: /notifications@/ });
  const before = thread(page).getByRole('button', { name: /Tomás Herrera.*Thu 4:20 PM/ });
  await before.click();
  await page.getByRole('button', { name: 'Add a new reply' }).click();
  await expect(thread(page).getByRole('button', { name: /Ari Chen.*11:02/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(latest).toHaveAttribute('aria-expanded', 'true');
  await expect(before).toHaveAttribute('aria-expanded', 'true');
});

test('the keyboard opens and closes a thread message, and focus stays on its heading button', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard: one project is enough.');
  await page.goto(THREAD);
  const earlier = thread(page).getByRole('button', { name: /Ari Chen.*Mon 10:47/ });
  await earlier.focus();
  await page.keyboard.press('Enter');
  await expect(earlier).toHaveAttribute('aria-expanded', 'true');
  await expect(earlier).toBeFocused();
  await page.keyboard.press('Space');
  await expect(earlier).toHaveAttribute('aria-expanded', 'false');
  await expect(earlier).toBeFocused();
});

test('a list row shows the size of its thread, and a single message shows none', async ({ page }) => {
  await page.goto('/app/inbox');
  const count = page.getByRole('link', { name: /Team offsite in March/ }).locator('.ld-inbox-count');
  await expect(count).toBeVisible();
  await expect(count).toHaveText('8 messages');
  await expect(page.getByRole('link', { name: /Q4 budget needs your approval/ })).not.toContainText('messages');
});

test('opening a message marks it read, and it can be archived from the message', async ({ page }) => {
  await page.goto('/app/inbox');
  await expect(page.getByText('5 unread of 6')).toBeVisible();
  const row = page.getByRole('link', { name: /Team offsite in March/ });
  await row.click();
  await expect(page.getByText('8 messages · 4 people')).toBeVisible(); // the URL changes before the message renders
  await page.goBack();
  await expect(page.getByText('4 unread of 6')).toBeVisible();
  await row.click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expect(page.getByText('4 unread of 5')).toBeVisible();
});

test('side by side, a long message scrolls in its pane and the subject and actions stay in view', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side needs a wide screen.');
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(LONG);
  const text = page.getByRole('region', { name: 'Message text' });
  await expect(text).toHaveAttribute('tabindex', '0');
  await text.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.getByText('Thanks for reading this far.')).toBeInViewport();
  await expect(page.getByRole('heading', { level: 2, name: /Records migration review/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // The next long message opens at its top, and a short one adds no tab stop.
  await page.getByRole('link', { name: /Team offsite in March/ }).click();
  await expect(page).toHaveURL(/\/app\/inbox\/m6$/);
  await expect(text).toHaveJSProperty('scrollTop', 0);
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  await expect(text).toHaveCount(0);
});

for (const [where, leave] of [
  ['another message', (page: Page) => page.getByRole('link', { name: /Q4 budget needs your approval/ })],
  ['another part of the app', (page: Page) => page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Today' })],
] as const) {
  test(`side by side, Back from ${where} returns to the place in a long message`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Side by side needs a wide screen.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(LONG);
    const text = page.getByRole('region', { name: 'Message text' });
    await text.evaluate((el) => el.scrollTo(0, 1200));
    await leave(page).click();
    await expect(page).not.toHaveURL(/m5$/);
    await page.goBack();
    await expect(text).toHaveJSProperty('scrollTop', 1200);
  });
}

// Scrolls the long message, leaves it for a short one, and reopens it from the list. Returns the place it reopens at.
async function reopen(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/inbox');
  const text = page.getByRole('region', { name: 'Message text' });
  const long = page.getByRole('link', { name: /Records migration review/ });
  await long.click();
  await text.evaluate((el) => el.scrollTo(0, 1200));
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  await expect(text).toHaveCount(0);
  await long.click();
  return text;
}

test('side by side, a fresh open starts at the top, and Back still returns to the place', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side needs a wide screen.');
  const text = await reopen(page);
  await expect(text).toHaveJSProperty('scrollTop', 0);
  await page.goBack();
  await expect(text).toHaveCount(0);
  await page.goBack();
  await expect(text).toHaveJSProperty('scrollTop', 1200);
});

test('without the Navigation API a place belongs to the URL, so reopening returns to it too', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side needs a wide screen.');
  await page.addInitScript(() => Object.defineProperty(window, 'navigation', { value: undefined }));
  const text = await reopen(page);
  await expect(text).toHaveJSProperty('scrollTop', 1200);
  await page.goBack();
  await expect(text).toHaveCount(0);
  await page.goBack();
  await expect(text).toHaveJSProperty('scrollTop', 1200);
});

// In-memory routing changes the message without changing the browser's history entry.
test('messages on one history entry keep separate places', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side needs a wide screen.');
  await page.addInitScript(() => Object.defineProperty(window, 'navigation', { value: { currentEntry: { id: 'shared' } } }));
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(LONG);
  const text = page.getByRole('region', { name: 'Message text' });
  await text.evaluate((el) => el.scrollTo(0, 1200));
  await page.getByRole('link', { name: /Team offsite in March/ }).click();
  await expect(page).toHaveURL(/m6$/);
  await expect(text).toHaveJSProperty('scrollTop', 0);
});

test('stacked, the way back and the actions stay on screen while the page scrolls', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The phone project.');
  await page.goto(LONG);
  await page.getByText('Thanks for reading this far.').scrollIntoViewIfNeeded();
  const back = page.locator('.ld-message-bar').getByRole('link', { name: 'Inbox' });
  await expect(back).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Archive' })).toBeInViewport();
  await back.click();
  // The way back returns to the message's row, near the top of the list, so the list opens at its top.
  await expect(page.getByRole('link', { name: /Records migration review/ })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('below 900px a message body keeps its own scroll margin, deeper than the tab bar’s', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Styles: one project is enough.');
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/app/inbox/m6');
  const margin = (selector: string) => page.locator(selector).first().evaluate((e) => parseFloat(getComputedStyle(e).scrollMarginBottom));
  await page.locator('.ld-message-body :is(a, button)').first().waitFor();
  expect(await margin('.ld-message-body :is(a, button)')).toBeGreaterThan(await margin('.ld-message-bar :is(a, button)'));
});

test('on a phone with a home indicator, a landed row clears the tab bar that sits above it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard: one project is enough.');
  await page.setViewportSize({ width: 390, height: 640 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: 34, bottomMax: 34 } });
  await page.goto('/app/inbox');
  await expect(page.locator('.ld-shell-tabbar')).toHaveCSS('bottom', '34px');
  await page.getByRole('button', { name: 'More actions for Design review agenda' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeFocused();
  await page.keyboard.press('Enter');
  const receipt = page.getByRole('link', { name: /Your receipt for October/ });
  await expect(receipt).toBeFocused();
  const row = (await receipt.boundingBox())!;
  const bar = (await page.locator('.ld-shell-tabbar > *').boundingBox())!;
  expect(row.y + row.height, 'the landed row’s foot is above the tab bar').toBeLessThanOrEqual(bar.y);
});

test('keyboard focus stays clear of the pinned bar, wrapped to two rows, and of the tab bar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard: one project is enough.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(FIXTURE);
  const bar = page.locator('.ld-message-bar');
  const messages = thread(page).getByRole('button');
  await expect(messages).toHaveCount(8);
  for (const earlier of (await messages.all()).slice(1)) {
    await earlier.click();
    await expect(earlier).toHaveAttribute('aria-expanded', 'true');
  }
  expect((await bar.boundingBox())!.height).toBeGreaterThan(90);
  const focusBox = () => page.evaluate(() => document.activeElement!.getBoundingClientRect().toJSON() as DOMRect);

  await messages.last().focus();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Shift+Tab');
    const barBox = (await bar.boundingBox())!;
    expect((await focusBox()).top).toBeGreaterThanOrEqual(barBox.y + barBox.height);
  }
  const tabBar = page.locator('.ld-shell-tabbar > *');
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    expect((await focusBox()).bottom).toBeLessThanOrEqual((await tabBar.boundingBox())!.y);
  }
});

for (const width of [320, 390, 412]) {
  test(`a long address as the sender wraps inside the message at ${width}px`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Widths are set here: one project is enough.');
    await page.setViewportSize({ width, height: 800 });
    await page.goto(FIXTURE);
    const meta = page.locator('.ld-message-meta');
    await expect(meta).toContainText('notifications@accounts.northwindpayroll.example');
    expect(await meta.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
    const [sender, time] = await Promise.all([
      thread(page).locator('.ld-disc-title').first().boundingBox(),
      thread(page).locator('.ld-disc-meta').first().boundingBox(),
    ]);
    expect(sender!.x + sender!.width).toBeLessThanOrEqual(time!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('in high contrast, a plain Disclosure has a separator and no outline', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: true })));
  await page.goto(THREAD);
  const second = thread(page).locator('.ld-disc').nth(1);
  await expect(second).toHaveCSS('box-shadow', 'none');
  await expect(second).toHaveCSS('border-top-width', '1px');
});

test('a row\'s link reaches past its date, so the focus ring clears it', async ({ page }) => {
  await page.goto('/app/inbox');
  const link = page.getByRole('link', { name: /Launch date/ });
  const [box, date] = await Promise.all([link.boundingBox(), link.locator('.ld-row-value').boundingBox()]);
  expect(box!.x + box!.width - (date!.x + date!.width)).toBeGreaterThanOrEqual(8);
});

test('archiving the open message while it is selected takes it out of the bar\'s count', async ({ page, isMobile }) => {
  if (isMobile) {
    // Stacked, the list and the open message don't show together: select on the list, then go Forward to the message.
    await page.goto('/app/inbox');
    await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
    await expect(page.getByRole('heading', { name: 'Q4 budget needs your approval' })).toBeVisible();
    await page.goBack();
  } else {
    await page.goto('/app/inbox/m1');
  }
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: /Q4 budget/ }).check();
  await page.getByRole('checkbox', { name: /Launch date/ }).check();
  await expect(page.getByRole('toolbar', { name: '2 messages selected' })).toBeVisible();
  if (isMobile) await page.goForward();
  await page.locator('.ld-message-actions').getByRole('button', { name: 'Archive' }).click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expect(page.getByRole('toolbar', { name: '1 message selected' })).toBeVisible();
  // The bar acts on what it counts: Delete takes the one message left in the selection.
  await page.getByRole('toolbar').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('3 unread of 4')).toBeVisible();
  await expect(page.locator('.ld-inbox-notice')).toHaveText('Deleted 1 message.Undo');
});

test('one message left, all read, reads “1 message”', async ({ page }) => {
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  for (const subject of [/Team offsite/, /Records migration/, /Q4 budget/, /Launch date/, /Design review/]) await page.getByRole('checkbox', { name: subject }).check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('All read · 1 message', { exact: true })).toBeVisible();
});

// A notice is spoken once per `id`: re-renders that bring no new notice say nothing, and a new notice is spoken even when
// its text repeats.
test('the notice is spoken once and stays put while the reader opens a message and selects, a new notice with the same text is spoken again, and Undo takes back only the last', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side keeps the line in view while a message is open: one project is enough.');
  await listen(page);
  await page.goto('/app/inbox');
  const archive = async (subject: string) => {
    await page.getByRole('button', { name: `More actions for ${subject}` }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
  };
  const times = async () => (await spoken(page)).filter((s) => s.text === 'Archived 1 message. Undo').length;
  const line = page.locator('.ld-inbox-notice');
  await archive('Design review agenda');
  await expect.poll(times).toBe(1);
  const first = await line.elementHandle();
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  await expect(page.getByRole('heading', { name: 'Q4 budget needs your approval' })).toBeVisible();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: /Launch date/ }).check();
  await page.locator('.ld-page-actions').getByRole('button', { name: 'Done' }).click();
  expect(await first!.evaluate((el) => el.isConnected)).toBe(true);
  expect(await times()).toBe(1);

  await archive('Your receipt for October');
  await expect.poll(times).toBe(2);
  await expect.poll(() => first!.evaluate((el) => el.isConnected)).toBe(false);
  await expect(line).toHaveText('Archived 1 message.Undo');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /receipt for October/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Design review agenda/ })).toHaveCount(0);
});

// At a 32px root the list runs past the screen. The demo's router scrolls a new history entry to the top on its own, so
// these tests stub `window.scrollTo`: whatever brings the landed row into view has to be the flow. The notice holds the
// top of the list pane while it's up, so it and its Undo stay in view wherever in the list focus lands.
test.describe('at a 32px root, with the router’s scrolling stubbed out', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.scrollTo = () => {}; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
  });
  const expectPlaceKept = async (page: Page, row: RegExp, undo = true) => {
    const landed = page.getByRole('link', { name: row });
    await expect(landed).toBeFocused();
    await expect(landed).toBeInViewport();
    await expect(page.locator('.ld-inbox-notice')).toBeInViewport({ ratio: 1 });
    if (undo) await expect(page.getByRole('button', { name: 'Undo' })).toBeInViewport({ ratio: 1 });
    // The notice covers no part of the row focus landed on.
    const [notice, box] = await Promise.all([page.locator('.ld-inbox-notice').boundingBox(), landed.boundingBox()]);
    expect(box!.y, 'the landed row starts below the notice').toBeGreaterThanOrEqual(notice!.y + notice!.height);
  };

  for (const action of ['Archive', 'Delete']) {
    test(`${action} on the open message, scrolled to its end, lands on the next row with the notice and Undo in view`, async ({ page }) => {
      await page.goto('/app/inbox/m5');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
      await expect(page.getByRole('heading', { name: /Records migration review/ })).toBeVisible();
      await page.evaluate(() => { document.scrollingElement!.scrollTop = document.scrollingElement!.scrollHeight; });
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.locator('.ld-message-actions').getByRole('button', { name: action }).click();
      await expect(page).toHaveURL(/\/app\/inbox$/);
      await expectPlaceKept(page, /Q4 budget needs your approval/);
    });
  }

  test('a row’s Archive, Undo and the bar’s Archive, low in the list, keep the place with the notice and Undo in view', async ({ page, isMobile }) => {
    await page.goto('/app/inbox');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
    await page.getByRole('button', { name: 'More actions for Your receipt for October' }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expectPlaceKept(page, /Design review agenda/);
    expect(await page.evaluate(() => window.scrollY), 'the list stays scrolled to where the reader was').toBeGreaterThan(0);
    if (!isMobile) {
      // Undo is before the list in reading order, so Shift+Tab from the row reaches it.
      const undo = page.getByRole('button', { name: 'Undo' });
      for (let i = 0; i < 20 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Shift+Tab');
      await expect(undo).toBeFocused();
      await expect(undo).toBeInViewport({ ratio: 1 });
      await page.getByRole('link', { name: /Design review agenda/ }).focus();
    }
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.ld-inbox-notice')).toHaveText('Restored 1 message.');
    await expectPlaceKept(page, /receipt for October/, false);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: /receipt for October/ }).check();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
    await expectPlaceKept(page, /Design review agenda/);
  });
});

test.describe('a reader whose locale is ar-EG', () => {
  test.use({ locale: 'ar-EG' });

  test('the flow\'s own counts read in its locale, and in the reader\'s without one', async ({ page }) => {
    const ar = (n: number) => n.toLocaleString('ar-EG');
    expect(ar(5)).not.toBe('5');
    // The fixture's thread has a fifth sender: its latest message comes from an address.
    for (const [url, n, people] of [['/app/inbox', String, 4], ['/fixtures/inbox', ar, 5]] as const) {
      await page.goto(url);
      await expect(page.locator('.ld-page-summary')).toHaveText(`${n(5)} unread of ${n(6)}`);
      await expect(page.locator('.ld-list-summary')).toHaveText(`${n(5)} unread`);
      await expect(page.getByRole('link', { name: /Team offsite in March/ }).locator('.ld-inbox-count')).toHaveText(`${n(8)} messages`);
      await page.getByRole('link', { name: /Team offsite in March/ }).click();
      await expect(page.locator('.ld-message-meta')).toContainText(`${n(8)} messages · ${n(people)} people`);
    }
  });

  test('the demo\'s locale reaches the selection count through InboxFlow; without one, the count reads in the reader\'s', async ({ page }) => {
    const readers = (1).toLocaleString('ar-EG');
    expect(readers).not.toBe('1');
    for (const [url, one] of [['/app/inbox', '1'], ['/fixtures/inbox', readers]]) {
      await page.goto(url);
      await page.getByRole('button', { name: 'Select', exact: true }).click();
      await page.getByRole('checkbox').first().check();
      await expect(page.getByRole('toolbar', { name: `${one} message selected` })).toBeVisible();
    }
  });
});
