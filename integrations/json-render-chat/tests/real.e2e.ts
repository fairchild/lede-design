import { expect, test, type Page } from '@playwright/test';

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
