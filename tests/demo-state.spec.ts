// The demo keeps what a visitor does for the tab's session: the Inbox, Settings' toggles and onboarding's answers last
// across routes and reloads, and a new tab starts from the sample data. Each test is a repro of a lost change.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { listen, spoken } from './spoken';

const go = (page: Page, place: string) => page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: place, exact: true }).click();
const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });
const inboxCard = (page: Page) => page.getByRole('main').getByRole('article').filter({ has: page.getByRole('heading', { name: 'Inbox' }) });
const toggle = (page: Page, name: string) => page.getByRole('switch', { name });

/** Archives “Launch date” and the receipt, and reads “Q4 budget”: 4 messages left, 3 of them unread. */
async function archiveTwoReadOne(page: Page) {
  await page.goto('/app/inbox');
  await expect(page.getByText('5 unread of 6')).toBeVisible();
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: /Launch date/ }).check();
  await page.getByRole('checkbox', { name: /receipt for October/ }).check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  await expect(page.getByRole('heading', { name: 'Q4 budget needs your approval' })).toBeVisible();
}

async function expectInboxKept(page: Page) {
  await expect(heading(page, 'Inbox')).toBeVisible();
  await expect(page.getByText('3 unread of 4')).toBeVisible();
  await expect(page.getByRole('link', { name: /Launch date|receipt for October/ })).toHaveCount(0);
}

test('the Inbox keeps what was archived and read, and Today’s Inbox card counts the same messages', async ({ page }) => {
  await page.goto('/app');
  await expect(inboxCard(page).locator('.ld-summary-figure')).toHaveText('5');
  await archiveTwoReadOne(page);
  await go(page, 'Today');
  await expect(heading(page, 'Today')).toBeVisible();
  await expect(inboxCard(page).locator('.ld-summary-figure')).toHaveText('3');
  await expect(inboxCard(page)).toContainText('Unread, the newest from Priya.');
  await go(page, 'Inbox');
  await expectInboxKept(page);
});

test('Settings keeps its toggles after leaving', async ({ page }) => {
  await page.goto('/app/settings');
  await toggle(page, 'Daily brief').click();
  await toggle(page, 'Sync across devices').click();
  await go(page, 'Today');
  await expect(heading(page, 'Today')).toBeVisible();
  await go(page, 'Settings');
  await expect(toggle(page, 'Daily brief')).not.toBeChecked();
  await expect(toggle(page, 'Sync across devices')).not.toBeChecked();
  await expect(page.getByText('Daily brief off')).toBeVisible();
  await expect(page.getByText('Sync paused')).toBeVisible();
});

test('onboarding’s answers reach Settings and the profile, and Back from the app returns to the finished screen', async ({ page }) => {
  await page.goto('/app/welcome');
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Evening' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(heading(page, 'You’re all set, Ada')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get started' })).toBeFocused();
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(heading(page, 'Today')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/welcome\/done$/);
  await expect(heading(page, 'You’re all set, Ada')).toBeVisible();
  await expect(page.getByText('Your first brief arrives tomorrow evening.')).toBeVisible();

  await page.getByRole('link', { name: 'Get started' }).click();
  await go(page, 'Settings');
  await expect(page.getByText('Each evening at 6:00 PM')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /Ada Lovelace/ })).toBeVisible();
});

test('an offline Finish stays on Review with a message and saves nothing, and Finish works once back online', async ({ page, context }) => {
  await page.goto('/app/welcome');
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Evening' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('alert')).toHaveText('You’re offline. Your answers are still here, so finish again once you’re back online.');
  await expect(page).toHaveURL(/\/app\/welcome\/review$/);
  await expect(heading(page, 'Review')).toBeVisible();
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  // The answers are still a draft, so the check that nothing was saved reads storage.
  expect(await page.evaluate(() => {
    const demo = JSON.parse(sessionStorage.getItem('lede:demo') ?? '{}');
    return [demo.brief, demo.onboarding.finished, localStorage.getItem('lede:profile'), localStorage.getItem('lede:appearance')];
  })).toEqual([{ on: true, delivery: 'morning' }, false, null, null]);

  // A second refusal is a new alert, so it is announced again.
  const first = await page.getByRole('alert').elementHandle();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect.poll(() => first!.evaluate((el) => el.isConnected)).toBe(false);
  await expect(page.getByRole('alert')).toBeVisible();
  // The message belongs to Review, so it leaves with it.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(heading(page, 'Make it yours')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading(page, 'Review')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(heading(page, 'You’re all set, Ada')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get started' })).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: 'Get started' }).click();
  await go(page, 'Settings');
  await expect(page.getByText('Each evening at 6:00 PM')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /Ada Lovelace/ })).toBeVisible();
});

test('a replay of onboarding starts from the profile and Settings', async ({ page }) => {
  await page.goto('/app/settings');
  await toggle(page, 'Daily brief').click();
  await page.getByRole('link', { name: 'Replay onboarding' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Hana Sato');
  await expect(page.getByLabel('Email')).toHaveValue('hana@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(toggle(page, 'Send me a daily brief')).not.toBeChecked();
});

test('a reload keeps everything, and a new tab starts from the sample data', async ({ page, context }) => {
  await archiveTwoReadOne(page);
  await page.goto('/app/settings');
  await toggle(page, 'Sync across devices').click();
  await page.reload();
  await expect(toggle(page, 'Sync across devices')).not.toBeChecked();
  await page.goto('/app/inbox');
  await expectInboxKept(page);

  // A docs link opened in a new tab, such as one to /app/inbox/m2, still finds its message.
  const tab = await context.newPage();
  await tab.goto('/app/inbox/m2');
  await expect(tab.getByRole('heading', { name: 'Launch date: Tuesday or Thursday?' })).toBeVisible();
  await tab.goto('/app/settings');
  await expect(toggle(tab, 'Sync across devices')).toBeChecked();
});

test('the demo still works when storage refuses to read or write', async ({ page }) => {
  await page.addInitScript(() => {
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (key) { if (key === 'lede:demo') throw new Error('Denied'); return getItem.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === 'lede:demo') throw new Error('Quota'); setItem.call(this, key, value); };
  });
  await archiveTwoReadOne(page);
  await go(page, 'Today');
  await expect(inboxCard(page).locator('.ld-summary-figure')).toHaveText('3');
  await go(page, 'Inbox');
  await expectInboxKept(page);
});

test('stored junk reads as the sample data', async ({ page }) => {
  for (const junk of ['null', '5', '[1]', '{not json', '{"version":1,"inbox":{"read":5,"removed":[null]},"sync":"no"}']) {
    await page.goto('/');
    await page.evaluate((value) => sessionStorage.setItem('lede:demo', value), junk);
    await page.goto('/app/inbox');
    await expect(page.getByText('5 unread of 6'), junk).toBeVisible();
  }
});

// Inbox Undo and stale message URLs: the store keeps each removal as a batch, so Undo takes one back and the message
// returns to its place.
const inboxOrder = (page: Page) => page.getByRole('region', { name: 'Inbox' }).getByRole('list').getByRole('link').evaluateAll((links) => links.map((l) => l.getAttribute('href')));
const ALL = ['m6', 'm5', 'm1', 'm2', 'm3', 'm4'].map((id) => `/app/inbox/${id}`);
// The line as the eye reads it, and what the live announcer told screen readers.
const line = (page: Page) => page.locator('.ld-inbox-notice');
async function expectNotice(page: Page, text: string, action?: string) {
  await expect(line(page)).toHaveText(`${text}${action ?? ''}`);
  await expect.poll(async () => (await spoken(page)).map((s) => s.text)).toContain([text, action].filter(Boolean).join(' '));
}

test('archiving two and Undo put both back in place, unread, and they stay back after leaving the Inbox', async ({ page }) => {
  await listen(page);
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: /Launch date/ }).check();
  await page.getByRole('checkbox', { name: /receipt for October/ }).check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
  await expectNotice(page, 'Archived 2 messages.', 'Undo');
  await expect(page.getByText('4 unread of 4')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expectNotice(page, 'Restored 2 messages.');
  // Focus lands on the first message Undo brought back.
  await expect(page.getByRole('link', { name: /Launch date/ })).toBeFocused();
  await expect(page.getByText('5 unread of 6')).toBeVisible();
  expect(await inboxOrder(page)).toEqual(ALL);

  await go(page, 'Today');
  await expect(inboxCard(page).locator('.ld-summary-figure')).toHaveText('5');
  await go(page, 'Inbox');
  await expect(page.getByText('5 unread of 6')).toBeVisible();
  expect(await inboxOrder(page)).toEqual(ALL);
  // Leaving the Inbox ends the offer.
  await expect(line(page)).toHaveCount(0);
});

test('the announcement leaves the page once spoken, so browse mode meets the notice only on its line', async ({ page, isMobile }) => {
  await listen(page);
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: /Launch date/ }).check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
  await expectNotice(page, 'Archived 1 message.', 'Undo');
  await expect(page.getByText('Archived 1 message. Undo', { exact: true })).toHaveCount(0, { timeout: 3000 });
  // Stacked, an open message hides the line, and no text left on the page offers an Undo that isn't on screen.
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  await expect(page.getByRole('heading', { name: 'Q4 budget needs your approval' })).toBeVisible();
  await expect(page.getByText(/Archived 1 message/).filter({ visible: true })).toHaveCount(isMobile ? 0 : 1);
});

test('a message deleted from its own page comes back with Undo, read, and a reload keeps it back', async ({ page }) => {
  await listen(page);
  await page.goto('/app/inbox');
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  await expect(page.getByRole('heading', { name: 'Q4 budget needs your approval' })).toBeVisible();
  // The removal and the way back to the list are one commit: the gone message's not-found detail never shows, and focus
  // goes from Delete to the row that took its place and nowhere between.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as { seen?: string[] }).seen = seen;
    new MutationObserver(() => {
      for (const h of document.querySelectorAll('.ld-md-detail :is(h1, h2)')) if (!seen.includes(h.textContent!)) seen.push(h.textContent!);
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', (e) => seen.push(`focus: ${(e.target as HTMLElement).textContent}`));
  });
  await page.locator('.ld-message-actions').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expectNotice(page, 'Deleted 1 message.', 'Undo');
  // Stacked, the list and its line are hidden while the message is open, so the text must reach a live region that was
  // on the page, and rendered, before the text arrived.
  expect((await spoken(page)).filter((s) => s.text === 'Deleted 1 message. Undo')).toEqual([{ text: 'Deleted 1 message. Undo', before: true, rendered: true }]);
  const next = page.getByRole('link', { name: /Launch date/ });
  await expect(next).toBeFocused();
  const seen = await page.evaluate(() => (window as { seen?: string[] }).seen!);
  expect(seen.filter((s) => /deleted|archived|not found/i.test(s) || s.startsWith('focus:'))).toEqual(['focus: Delete', `focus: ${await next.textContent()}`]);
  await expect(page.getByRole('link', { name: /Q4 budget/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expectNotice(page, 'Restored 1 message.');
  await expect(page.getByText('4 unread of 6')).toBeVisible();
  expect(await inboxOrder(page)).toEqual(ALL);
  await page.reload();
  await expect(page.getByText('4 unread of 6')).toBeVisible();
  expect(await inboxOrder(page)).toEqual(ALL);
  await expect(line(page)).toHaveCount(0);
});

for (const [how, subject, id] of [['archived', 'Launch date', 'm2'], ['deleted', 'Design review agenda', 'm3']] as const) {
  test(`Back to a message ${how} from its own page says it was ${how}, with one h1 and a way back`, async ({ page, isMobile }) => {
    await page.goto('/app/inbox');
    await page.getByRole('link', { name: new RegExp(subject) }).click();
    await page.locator('.ld-message-actions').getByRole('button', { name: how === 'archived' ? 'Archive' : 'Delete' }).click();
    await expect(page).toHaveURL(/\/app\/inbox$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app/inbox/${id}$`));
    await expectMissing(page, isMobile, how === 'archived' ? 'This message is archived' : 'This message was deleted');
  });
}

test('a gone message’s URL marks nothing read, so Undo would bring it back as it was', async ({ page, isMobile }) => {
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: /Launch date/ }).check();
  await page.getByRole('toolbar').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('4 unread of 5')).toBeVisible();
  await page.goto('/app/inbox/m2');
  await expect(page.getByRole('heading', { name: 'This message is archived' })).toBeVisible();
  // Opening a message that exists afterwards shows the effects have run: only that one is read.
  if (isMobile) await page.getByRole('region', { name: 'Open message' }).getByRole('link', { name: 'Inbox' }).click();
  await page.getByRole('link', { name: /Q4 budget needs your approval/ }).click();
  const read = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('lede:demo')!).inbox.read as string[]);
  await expect.poll(read).toEqual(['m1']);
});

test('a message URL that never had a message says so, with one h1 and a way back', async ({ page, isMobile }) => {
  await page.goto('/app/inbox/nope');
  await expectMissing(page, isMobile, 'Message not found', 'This link doesn’t match any message in the Inbox.');
});

/** A title alone says enough for a message this visit removed; with no description there is no empty paragraph. */
async function expectMissing(page: Page, isMobile: boolean, title: string, description?: string) {
  const pane = page.getByRole('region', { name: 'Open message' });
  await expect(pane.getByRole('heading', { level: isMobile ? 1 : 2, name: title })).toBeVisible();
  await expect(pane.locator('.ld-empty p')).toHaveText(description ? [description] : []);
  expect(await page.locator('h1').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length)).toBe(1);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  // Its title takes focus in either layout, so the link lands on the explanation.
  await expect(pane.getByRole('heading', { name: title })).toBeFocused();
  if (isMobile) {
    // Stacked, it is the whole screen, and the back link returns to the list.
    await pane.getByRole('link', { name: 'Inbox' }).click();
    await expect(page).toHaveURL(/\/app\/inbox$/);
    await expect(heading(page, 'Inbox')).toBeFocused();
  } else {
    // Side by side, the list is the way back, as it is from an open message.
    await page.getByRole('link', { name: /Team offsite in March/ }).click();
    await expect(page).toHaveURL(/\/app\/inbox\/m6$/);
    await expect(pane.getByRole('heading', { name: /Team offsite in March/ })).toBeFocused();
  }
}
