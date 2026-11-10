import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The chat's own behavior, matched to ../json-render-chat/tests/chat.e2e.ts. The tests of what Lede's screens do,
// such as an action held back while a field fails, have no match here: README.md names each one.

const composer = (page: Page) => page.getByRole('textbox', { name: 'Message' });
const turns = (page: Page) => page.getByRole('region', { name: 'Conversation' }).getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
const focusIn = (page: Page) => page.evaluate(() => document.activeElement?.tagName.toLowerCase());

async function ask(page: Page, text: string) {
  await composer(page).fill(text);
  await composer(page).press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('focus starts in the composer, where the person acts next', async ({ page }) => {
  await expect(composer(page)).toBeFocused();
});

test('a reply reads in order: the question, then the answer’s text, then its screen, with focus left in the composer', async ({ page }) => {
  await ask(page, 'How’s my week?');
  const [question, answer] = [turns(page).nth(0), turns(page).nth(1)];
  await expect(question.getByRole('heading', { level: 2 })).toContainText('You');
  await expect(answer.getByRole('heading', { level: 3, name: 'Your week' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(answer.getByRole('button', { name: /Venue review|Launch window sync|Design critique/ })).toHaveCount(3);
  const order = await answer.evaluate((li) => [...li.querySelectorAll('.jrc-text, .jrc-screen')].map((el) => el.className));
  expect(order).toEqual(['jrc-text', 'jrc-screen']);
  await expect(composer(page)).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('an action on the screen says what it did', async ({ page }) => {
  await ask(page, 'What’s in my inbox?');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden({ timeout: 15_000 });
  const screen = turns(page).nth(1).locator('.jrc-screen');
  await screen.getByRole('button', { name: 'Grace Hopper' }).click();
  await screen.getByRole('textbox', { name: 'Reply to Grace' }).fill('The venue is confirmed.');
  await screen.getByRole('button', { name: 'Send reply' }).click();
  await expect(turns(page).nth(1).getByRole('list', { name: 'What you did here' })).toHaveText('You pressed Send reply.');
});

test('an item opens in place, as in the Lede chat, and its Back button shows the list again', async ({ page }) => {
  await ask(page, 'What’s in my inbox?');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden({ timeout: 15_000 });
  const screen = turns(page).nth(1).locator('.jrc-screen');
  await screen.getByRole('button', { name: 'Katherine Johnson' }).click();
  await expect(screen.getByRole('heading', { level: 3, name: 'Katherine Johnson' })).toBeVisible();
  await expect(screen.getByRole('heading', { level: 3, name: 'Inbox' })).toHaveCount(0);
  await screen.getByRole('button', { name: 'Back to Inbox' }).click();
  await expect(screen.getByRole('heading', { level: 3, name: 'Inbox' })).toBeVisible();
});

for (const how of ['Stop', 'Escape'] as const) {
  test(`${how} ends a streaming reply and leaves focus in the composer`, async ({ page }) => {
    await ask(page, 'How’s my week?');
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    if (how === 'Stop') await page.getByRole('button', { name: 'Stop' }).click();
    else await composer(page).press('Escape');
    await expect(page.getByText('You stopped this reply.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
    await expect(composer(page)).toBeFocused();
  });
}

test('Try again moves focus to the composer at once, and it never falls to <body> while the retry streams', async ({ page }) => {
  await ask(page, 'Fail once');
  await page.getByRole('button', { name: 'Try again' }).focus();
  await page.keyboard.press('Enter');
  const seen = new Set<string | undefined>();
  while (await page.getByRole('button', { name: 'Stop' }).isVisible()) seen.add(await focusIn(page));
  seen.add(await focusIn(page));
  expect([...seen]).toEqual(['textarea']);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeHidden();
});

test('a control reached with Shift+Tab from the composer stops above the composer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await ask(page, 'How’s my week?');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  const control = page.getByRole('switch', { name: 'Block Friday morning for focus time' });
  await control.evaluate((el) => scrollBy(0, el.getBoundingClientRect().bottom - innerHeight + 8));
  await composer(page).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(control).toBeFocused();
  const [box, footer] = await Promise.all([control.boundingBox(), page.locator('.jrc-footer').boundingBox()]);
  expect(box!.y + box!.height).toBeLessThanOrEqual(footer!.y);
});

test('a reply that fails before it begins says so after the question, outside its bubble', async ({ page }) => {
  await ask(page, 'Am I offline?');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  const question = turns(page).nth(0);
  await expect(question.locator('.jrc-body')).not.toContainText('failed');
  await expect(question.getByText('This reply failed.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('The reply failed: The server couldn’t reach the model.');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(turns(page).nth(1)).toContainText('The connection is back.');
  await expect(page.getByText('This reply failed.')).toBeHidden();
  await expect(composer(page)).toBeFocused();
});

test('a list drawn from state fills in a row at a time as the reply streams, each row once', async ({ page }) => {
  await ask(page, 'Show my tasks');
  const rows = turns(page).nth(1).getByText(/^(Draft the venue brief|Review the Q3 budget|Book the caterer)$/);
  const seen = new Set<number>();
  while (await page.getByRole('button', { name: 'Stop' }).isVisible()) seen.add(await rows.count());
  seen.add(await rows.count());
  expect([...seen].filter((n) => n > 0).sort()).toEqual([1, 2, 3]);
});

test('the window follows a reply only while it streams, and a scroll the person makes keeps their place', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await ask(page, 'How’s my week?');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
  await page.evaluate(() => scrollTo(0, 120));
  await composer(page).pressSequentially('ok');
  expect(await page.evaluate(() => scrollY)).toBe(120);
});
