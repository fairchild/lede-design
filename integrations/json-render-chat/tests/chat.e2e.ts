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

test('a control reached with Shift+Tab from the composer stops above the composer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await ask(page, 'How’s my week?');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  const control = page.getByRole('switch', { name: 'Block Friday morning for focus time' });
  // Put the control just inside the window's bottom edge, behind the composer, where it counts as in view.
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

test('a form sends only when its fields pass, each failing field shows its error after a press, and the button names it', async ({ page }) => {
  await ask(page, 'Help me sign up');
  const reply = turns(page).nth(1);
  const notes = reply.getByRole('list', { name: 'What you did here' });
  const [name, email] = [reply.getByRole('textbox', { name: 'Name' }), reply.getByRole('textbox', { name: 'Email' })];
  const [needName, needAt] = [reply.getByText('Enter your name.'), reply.getByText('Enter an email address with an @, such as ada@example.com.')];
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(needName).toBeHidden();
  await expect(needAt).toBeHidden();

  await reply.getByRole('button', { name: 'Create account' }).click();
  await expect(name).toBeFocused();
  await expect(needName).toBeVisible();
  await expect(name).toHaveAccessibleDescription(/Enter your name\./);
  await expect(needAt).toBeVisible();

  await name.fill('Ada Lovelace');
  await expect(needName).toBeHidden();
  await email.fill('ada.example.com');
  await expect(needAt).toBeVisible();
  await email.press('Enter');
  await expect(email).toBeFocused();
  await expect(notes).toHaveCount(0);
  await email.fill('ada@example.com');
  await expect(needAt).toBeHidden();
  await email.press('Enter');
  const terms = reply.getByRole('checkbox', { name: /I agree to the terms/ });
  await expect(terms).toBeFocused();
  await expect(reply.getByText('Agree to the terms to continue.')).toBeVisible();
  await terms.check();
  await expect(reply.getByText('Agree to the terms to continue.')).toBeHidden();
  await email.press('Enter');
  await expect(notes).toHaveText('You pressed Create account.');
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

test('a screen takes typing and presses while the rest of it streams in, and keeps them', async ({ page }) => {
  await ask(page, 'Show my tasks');
  const reply = turns(page).nth(1);
  const rows = reply.getByRole('list').filter({ hasText: 'Draft the venue brief' }).getByRole('listitem');
  const high = reply.getByRole('radio', { name: 'High' });
  await high.check();
  await reply.getByRole('textbox', { name: 'Task' }).fill('Call the florist');
  // The draft's state streams after the rows, so with a row still to come these acted before it arrived.
  expect(await rows.count()).toBeLessThan(3);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(rows).toHaveCount(3);
  await expect(high).toBeChecked();
  await expect(reply.getByRole('textbox', { name: 'Task' })).toHaveValue('Call the florist');
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
