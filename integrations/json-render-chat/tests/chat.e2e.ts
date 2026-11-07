import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  const order = await answer.evaluate((li) => [...li.querySelectorAll('.jrc-text, .jrc-screen')].map((el) => el.className));
  expect(order).toEqual(['jrc-text', 'jrc-screen']);
  await expect(composer(page)).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('an action on the screen says what it did', async ({ page }) => {
  await ask(page, 'How’s my week?');
  await page.getByRole('button', { name: /Venue review/ }).click();
  await expect(turns(page).nth(1).getByRole('list', { name: 'What you did here' })).toHaveText('You opened Venue review.');
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
