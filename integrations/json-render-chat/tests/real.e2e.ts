import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { fakeLog } from './fake-log';

// The path a copy of this chat ships: the AI SDK's DefaultChatTransport, posting to server/chat.ts, which streams a
// model's reply through pipeJsonRender. The model is a fake Anthropic (tests/fake-anthropic.ts).

const composer = (page: Page) => page.getByRole('textbox', { name: 'Message' });

async function ask(page: Page, text: string) {
  await composer(page).fill(text);
  await composer(page).press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('a model’s reply arrives as its text and then its screen, with focus left in the composer', async ({ page }) => {
  await ask(page, 'Show my notification settings');
  await expect(page.getByRole('heading', { level: 3, name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(page.getByRole('switch')).toHaveCount(4);
  await expect(page.locator('.jrc-text', { hasText: 'Here are your notification settings.' })).toBeVisible();
  await expect(composer(page)).toBeFocused();
});

test('a connection that drops partway through a reply shows the error and Try again, and the server keeps answering', async ({ page }) => {
  await ask(page, 'Please drop this one');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText('The reply failed: The assistant couldn’t answer.')).toBeVisible();
  await ask(page, 'Show my notification settings');
  await expect(page.getByRole('heading', { level: 3, name: 'Notifications' })).toBeVisible();
});

test('a malformed body gets a 400, a body that isn’t JSON a 415, and the server keeps answering', async ({ page }) => {
  const post = (data: string, type = 'application/json') => page.request.post('/api/chat', { data, headers: { 'content-type': type } });
  expect((await post('{"messages":[null]}')).status()).toBe(400);
  expect((await post('{"messages":[{"id":"u1","role":"user","parts":"x"}]}')).status()).toBe(400);
  expect((await post('{"messages":[]}', 'text/plain')).status()).toBe(415);
  await ask(page, 'Show my notification settings');
  await expect(page.getByRole('heading', { level: 3, name: 'Notifications' })).toBeVisible();
});

/** What the model was sent with the request whose last message contains `marker`, as one string. */
function sentWith(marker: string) {
  const bodies = readFileSync(fakeLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { messages: Array<{ content: Array<{ text?: string }> | string }> });
  const body = bodies.findLast((b) => JSON.stringify(b.messages.at(-1)).includes(marker));
  return body?.messages.flatMap((m) => (typeof m.content === 'string' ? [m.content] : m.content.map((c) => c.text ?? ''))).join('\n') ?? '';
}

test('a follow-up sends each earlier screen with what the person left in it', async ({ page }) => {
  await ask(page, 'Show my notification settings');
  const push = page.getByRole('switch', { name: 'Push notifications' });
  await expect(push).toBeChecked();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await push.click();
  await expect(push).not.toBeChecked();
  await ask(page, 'Now the email digest, marker-7319');
  await expect(page.getByRole('heading', { level: 3, name: 'Notifications' })).toHaveCount(2);
  const sent = sentWith('marker-7319');
  expect(sent).toContain('"/state/settings","value":{"push":false');
});

test('a reply that only patches an earlier screen says it couldn’t be drawn, with Try again', async ({ page }) => {
  await ask(page, 'Show my notification settings');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await ask(page, 'Just patch push off');
  await expect(page.getByText('The reply failed: The reply’s screen couldn’t be drawn.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText('This reply failed.')).toBeVisible();
});

test('a control that hides itself, or a row an action hides, hands focus on and never drops it to <body>', async ({ page }) => {
  await ask(page, 'A quiz, please');
  const screen = page.locator('.jrc-screen');
  await expect(screen.getByRole('button', { name: 'Check answers' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();

  await screen.getByRole('button', { name: 'Check answers' }).focus();
  await page.keyboard.press('Enter');
  await expect(screen.getByRole('button', { name: 'Start over' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(screen.getByRole('button', { name: 'Check answers' })).toBeFocused();

  for (const [word, after] of [['la manzana', screen.getByRole('button', { name: 'More actions for el perro' })], ['el perro', screen.getByRole('heading', { level: 3, name: 'Practice words' })]] as const) {
    await screen.getByRole('button', { name: `More actions for ${word}` }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Learned' }).press('Enter');
    await expect(screen.getByText(word)).toBeHidden();
    await expect(after).toBeFocused();
  }
});

test('a field checks only what it says: a pattern holds back a short ZIP code, and a number field takes a decimal', async ({ page }) => {
  await ask(page, 'My morning check-in');
  const screen = page.locator('.jrc-screen');
  const [zip, hours] = [screen.getByRole('textbox', { name: 'ZIP code' }), screen.getByRole('spinbutton', { name: 'Hours slept' })];
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await zip.fill('973');
  await hours.fill('7.5');
  await screen.getByRole('button', { name: 'Save' }).click();
  await expect(zip).toBeFocused();
  await expect(screen.getByText('Enter a 5-digit ZIP code.')).toBeVisible();
  await expect(screen.getByText('Enter hours from 0 to 24.')).toBeHidden();
  await expect(page.getByRole('list', { name: 'What you did here' })).toHaveCount(0);
  await zip.fill('97301');
  await expect(screen.getByText('Enter a 5-digit ZIP code.')).toBeHidden();
  await screen.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('list', { name: 'What you did here' })).toHaveText('You pressed Save.');
});
