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
  await expect(answer.getByRole('list').filter({ hasText: 'Venue review' }).getByRole('listitem')).toHaveCount(3);
  await expect(answer.locator('.ld-field-label', { hasText: 'Period' })).toBeVisible();
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

test('a control reached with the keyboard stops above the composer, not under it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await ask(page, 'How’s my week?');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  const control = page.getByRole('switch', { name: 'Block Friday morning for focus time' });
  // Put the control just inside the window's bottom edge, behind the composer, where it counts as in view.
  await control.evaluate((el) => scrollBy(0, el.getBoundingClientRect().bottom - innerHeight + 8));
  await control.focus();
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

test('a form sends only when its fields pass, from Enter in a field as from its button, and the button names it', async ({ page }) => {
  await ask(page, 'Help me sign up');
  const reply = turns(page).nth(1);
  const notes = reply.getByRole('list', { name: 'What you did here' });
  const [name, email] = [reply.getByRole('textbox', { name: 'Name' }), reply.getByRole('textbox', { name: 'Email' })];
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await name.press('Enter');
  await expect(name).toBeFocused();
  await expect(reply.getByText('Enter your name.')).toBeVisible();
  await name.fill('Ada Lovelace');
  await name.press('Enter');
  await expect(email).toBeFocused();
  await expect(notes).toHaveCount(0);
  await email.fill('ada@example.com');
  await email.press('Enter');
  await expect(notes).toHaveText('You pressed Create account.');
  await expect(reply.getByText('Enter your name.')).toBeHidden();
});

test('a list drawn from state fills in a row at a time as the reply streams', async ({ page }) => {
  await ask(page, 'Show my tasks');
  const rows = turns(page).nth(1).getByRole('list').filter({ hasText: 'Draft the venue brief' }).getByRole('listitem');
  const seen = new Set<number>();
  while (await page.getByRole('button', { name: 'Stop' }).isVisible()) seen.add(await rows.count());
  seen.add(await rows.count());
  expect([...seen].filter((n) => n > 0).sort()).toEqual([1, 2, 3]);
});

test('an action holds back while a field it reads fails, focus moves to that field, and an add leaves focus in place', async ({ page }) => {
  await ask(page, 'Show my tasks');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  const reply = turns(page).nth(1);
  const rows = reply.getByRole('list').filter({ hasText: 'Draft the venue brief' }).getByRole('listitem');
  const [task, minutes, add] = [reply.getByRole('textbox', { name: 'Task' }), reply.getByRole('spinbutton', { name: 'Minutes' }), reply.getByRole('button', { name: 'Add task' })];

  await add.click();
  await expect(task).toBeFocused();
  await expect(rows).toHaveCount(3);
  await expect(reply.getByText('Enter what the task is.')).toBeVisible();
  await expect(reply.getByText('Choose a priority.')).toBeVisible();
  await expect(reply.getByRole('group', { name: 'Priority' })).toHaveAccessibleDescription('Choose a priority.');
  expect((await new AxeBuilder({ page }).include('.jrc-screen').analyze()).violations).toEqual([]);

  await task.fill('Call the florist');
  await minutes.fill('500');
  await minutes.press('Enter');
  await expect(minutes).toBeFocused();
  await expect(reply.getByText('Enter minutes from 5 to 240.')).toBeVisible();
  await minutes.fill('20');
  await minutes.press('Enter');
  await expect(reply.getByRole('radio', { name: 'Low' })).toBeFocused();
  await expect(rows).toHaveCount(3);

  await reply.getByRole('radio', { name: 'High' }).check();
  await add.click();
  await expect(rows).toHaveCount(4);
  await expect(rows.last()).toContainText('Call the florist');
  await expect(rows.last()).toContainText('20 min');
  await expect(add).toBeFocused();
  await expect(task).toHaveValue('');
  await expect(reply.getByText('Enter what the task is.')).toBeHidden();
});

test('a checkbox’s long label wraps beside the box, at a phone’s width and 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 32 } });
  await page.reload();
  await ask(page, 'Help me sign up');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  const label = turns(page).nth(1).locator('label', { has: page.getByRole('checkbox') });
  const lines = await label.evaluate((el) => {
    const box = el.querySelector('input')!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el.querySelector('input')!.parentElement!.nextElementSibling ?? el);
    return { right: box.right, lefts: [...range.getClientRects()].map((r) => r.left) };
  });
  expect(lines.lefts.length).toBeGreaterThan(1);
  expect(Math.min(...lines.lefts)).toBeGreaterThanOrEqual(lines.right);
});
