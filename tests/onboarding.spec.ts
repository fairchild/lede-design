// Onboarding in the Daybook demo: each URL shows the step it names, the answers are a draft that a reload keeps, Cancel
// and the browser's Back leave without saving anything, and Finish saves everything. Each test is a repro of a lost answer.
import { test, expect, type Page } from '@playwright/test';

const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });
const ACCOUNT = 'Create your account';
const PREFERENCES = 'Make it yours';
const next = (page: Page) => page.getByRole('button', { name: 'Continue' }).click();
const cancel = (page: Page) => page.getByRole('link', { name: 'Cancel' }).click();
const savedAccent = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('lede:appearance') ?? '{}').accent ?? 'blue');
const draft = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('lede:demo') ?? '{}').onboarding?.draft);
/** What a filled button inside onboarding is painted with, once its color has settled, and what a preset paints there. */
const fill = (page: Page) => page.getByRole('button', { name: 'Continue' }).evaluate((el) => getComputedStyle(el).backgroundColor);
const preset = (page: Page, name: string) => page.locator('main').evaluate((main, name) => {
  const probe = main.appendChild(document.createElement('i'));
  probe.style.background = `var(--preset-${name})`;
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}, name);

/** Settings → Replay onboarding, the way in from the app. */
async function replay(page: Page) {
  await page.goto('/app/settings');
  await page.getByRole('link', { name: 'Replay onboarding' }).click();
  await expect(heading(page, ACCOUNT)).toBeVisible();
}

test('a URL for a step the draft hasn’t reached shows the furthest step it has, under that step’s URL', async ({ page, isMobile }) => {
  await page.goto('/app');
  await page.goto('/app/welcome/review');
  await expect(page).toHaveURL(/\/app\/welcome$/);
  // The step it shows takes focus as it would on arrival: the cursor in Name, or the h1 on a phone (spec §5).
  await expect(isMobile ? heading(page, ACCOUNT) : page.getByLabel('Name')).toBeFocused();
  await expect(page).toHaveTitle(`${ACCOUNT} · Lede`);
  // Replaced, so Back leaves the flow, and doesn't return to the URL that was replaced.
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);

  // Done waits for Finish, and a step that doesn't exist reads as the furthest one there is.
  for (const path of ['done', 'garbage']) {
    await page.goto(`/app/welcome/${path}`);
    await expect(page, path).toHaveURL(/\/app\/welcome$/);
    await expect(heading(page, ACCOUNT)).toBeVisible();
  }

  // Continue reaches Preferences, so Preferences is as far as a URL goes.
  await page.goto('/app/welcome');
  await next(page);
  for (const path of ['review', 'done', 'garbage']) {
    await page.goto(`/app/welcome/${path}`);
    await expect(page, path).toHaveURL(/\/app\/welcome\/preferences$/);
    await expect(heading(page, PREFERENCES)).toBeVisible();
  }
  await page.goto('/app/welcome');
  await expect(heading(page, ACCOUNT)).toBeVisible();
});

test('the flow’s Continue and Back replace its history entry, so the browser’s Back leaves onboarding', async ({ page }) => {
  await replay(page);
  await next(page);
  await next(page);
  await expect(heading(page, 'Review')).toBeVisible();
  await page.getByRole('button', { name: /^Accent/ }).click();
  await expect(page).toHaveURL(/\/app\/welcome\/preferences$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(heading(page, 'Settings')).toBeVisible();
  // The draft stays, so Forward returns to the step that was showing.
  await page.goForward();
  await expect(heading(page, ACCOUNT)).toBeVisible();
  await page.goto('/app/welcome/review');
  await expect(heading(page, 'Review')).toBeVisible();
});

test('a reload keeps the step, every answer and the accent being previewed', async ({ page }) => {
  await replay(page);
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await next(page);
  await page.getByRole('radio', { name: 'Orange' }).check();
  await page.getByRole('switch', { name: 'Send me a daily brief' }).click();
  await page.reload();
  await expect(page).toHaveURL(/\/app\/welcome\/preferences$/);
  await expect(page.getByRole('radio', { name: 'Orange' })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Orange' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Send me a daily brief' })).not.toBeChecked();
  await expect.poll(() => fill(page)).toBe(await preset(page, 'orange'));
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Ada Lovelace');
  await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');
  // A change to the account waits for Continue to check it again, so a reload stays on the step it was made on.
  await page.getByLabel('Email').fill('ada@');
  await page.reload();
  await expect(page.getByLabel('Email')).toHaveValue('ada@');
  await page.goto('/app/welcome/preferences');
  await expect(page).toHaveURL(/\/app\/welcome$/);
});

test('Cancel from a middle step returns to where the reader came from and keeps the saved accent and nothing of the draft', async ({ page }) => {
  await replay(page);
  await page.getByLabel('Name').fill('Ada Lovelace');
  await next(page);
  await page.getByRole('radio', { name: 'Orange' }).check();
  // The accent previews on the onboarding page only.
  await expect.poll(() => fill(page)).toBe(await preset(page, 'orange'));
  expect(await savedAccent(page)).toBe('blue');
  await cancel(page);
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(heading(page, 'Settings')).toBeVisible();
  expect(await savedAccent(page)).toBe('blue');
  await expect(page.getByRole('link', { name: /^Appearance/ })).toContainText('Blue');
  expect(await draft(page)).toBeUndefined();
  // A replay starts again from the profile and the saved accent.
  await page.getByRole('link', { name: 'Replay onboarding' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Hana Sato');
  await next(page);
  await expect(page.getByRole('radio', { name: 'Blue' })).toBeChecked();
  await expect.poll(() => fill(page)).toBe(await preset(page, 'blue'));

  // After a reload, Cancel still returns to where the reader came from.
  await page.getByRole('radio', { name: 'Green' }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Green' })).toBeChecked();
  await cancel(page);
  await expect(page).toHaveURL(/\/app\/settings$/);
  expect(await savedAccent(page)).toBe('blue');
  expect(await draft(page)).toBeUndefined();

  // Opened straight from its URL, the flow has nowhere it came from, so Cancel goes to Today.
  await page.goto('/app/welcome');
  await cancel(page);
  await expect(page).toHaveURL(/\/app$/);
  await expect(heading(page, 'Today')).toBeVisible();
});

test('Cancel drops the draft when the page goes as a document, before it unmounts', async ({ page }) => {
  await replay(page);
  await next(page);
  await page.getByRole('radio', { name: 'Orange' }).check();
  // Cancel goes Back to Settings. Holding that Back here leaves the page mounted, as when the earlier entry loads as a
  // new document and the old one gets only `pagehide`.
  await page.evaluate(() => { window.history.go = () => {}; });
  await cancel(page);
  expect(await draft(page)).toMatchObject({ answers: { accent: 'orange' } });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  expect(await draft(page)).toBeUndefined();
  expect(await savedAccent(page)).toBe('blue');
});

test('a page restored from the back-forward cache after Cancel keeps its next draft', async ({ page }) => {
  await replay(page);
  await next(page);
  await page.getByRole('radio', { name: 'Orange' }).check();
  // Cancel marks the exit; holding its Back keeps this page, as the cache would keep it.
  await page.evaluate(() => { window.history.go = () => {}; });
  await cancel(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.getByRole('radio', { name: 'Green' }).check();
  // Leaving now, by the browser's Back, keeps the draft.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  expect(await draft(page)).toMatchObject({ answers: { accent: 'green' } });
});

test('the accent preview’s scope keeps the reader’s other appearance settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:appearance', JSON.stringify({ solidGlass: true, scheme: 'dark' })));
  await page.goto('/app/welcome');
  const scope = page.locator('main').locator('xpath=..');
  await expect(scope).toHaveAttribute('data-glass', 'solid');
  await expect(scope).toHaveAttribute('data-theme', 'dark');
});

test('only Cancel drops the draft: the browser’s Back keeps it, so Forward returns with every answer', async ({ page, context }) => {
  await replay(page);
  await page.getByLabel('Name').fill('Ada Lovelace');
  await next(page);
  await page.getByRole('radio', { name: 'Orange' }).check();
  // Cancel opened in a new tab leaves this page, and its draft, as they are. The route changes only what that tab
  // loads: an empty document in place of the app, so the test doesn't boot a second copy of the app beside this one.
  // The click, the new tab and its URL are still the product's. The wait for the tab has its own 10s, so a tab that never
  // opens fails here by name, and the route goes either way.
  await context.route('**/app', (route) => route.fulfill({ contentType: 'text/html', body: '' }));
  const [tab] = await Promise.all([
    context.waitForEvent('page', { timeout: 10_000 }),
    page.getByRole('link', { name: 'Cancel' }).click({ modifiers: ['ControlOrMeta'] }),
  ]).finally(() => context.unroute('**/app'));
  await expect(tab).toHaveURL(/\/app$/);
  await tab.close();
  await expect(page).toHaveURL(/\/app\/welcome\/preferences$/);

  await page.goBack();
  await expect(heading(page, 'Settings')).toBeVisible();
  expect(await savedAccent(page)).toBe('blue');
  expect(await draft(page)).toMatchObject({ answers: { name: 'Ada Lovelace', accent: 'orange' }, reached: 1 });
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/welcome\/preferences$/);
  await expect(heading(page, PREFERENCES)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Orange' })).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Ada Lovelace');
  // A replay finds the same draft.
  await page.goBack();
  await page.getByRole('link', { name: 'Replay onboarding' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Ada Lovelace');
});

test('Finish saves the accent with the profile and the brief, and Back from the app shows the finished screen', async ({ page }) => {
  await replay(page);
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await next(page);
  await page.getByRole('radio', { name: 'Pink' }).check();
  await page.getByRole('radio', { name: 'Evening' }).check();
  await next(page);
  expect(await savedAccent(page)).toBe('blue');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(heading(page, 'You’re all set, Ada')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get started' })).toBeFocused();
  await expect(page).toHaveURL(/\/app\/welcome\/done$/);
  expect(await savedAccent(page)).toBe('pink');
  expect(await draft(page)).toBeUndefined();
  // Finished, the flow is done: no Cancel, and Get started is the way on.
  await expect(page.getByRole('link', { name: 'Cancel' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(heading(page, 'Today')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/welcome\/done$/);
  await expect(heading(page, 'You’re all set, Ada')).toBeVisible();
  await expect(page.getByText('Your first brief arrives tomorrow evening.')).toBeVisible();
  // The flow was one entry, so the next Back is the page before it.
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByText('Each evening at 6:00 PM')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Appearance/ })).toContainText('Pink');
  await expect(page.getByRole('main').getByRole('link', { name: /Ada Lovelace/ })).toBeVisible();
  // Finished, the furthest step is Done.
  await page.goto('/app/welcome/garbage');
  await expect(page).toHaveURL(/\/app\/welcome\/done$/);
  await expect(heading(page, 'You’re all set, Ada')).toBeVisible();
});
