import { expect, test, type Page } from '@playwright/test';
import type { Spec } from '@json-render/core';

// SpecView drawn on tests/fixture.html, which records each action a spec runs in `window.ran` and each held one in
// `window.held`.
const draw = (page: Page, spec: unknown, streaming = false) => page.evaluate(([s, live]) => window.draw(s as Spec, live as boolean), [spec, streaming] as const);
const ran = (page: Page) => page.evaluate(() => window.ran);
const held = (page: Page) => page.evaluate(() => window.held.map((h) => h.action));
const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement;
  return el === document.body ? 'BODY' : `${el?.tagName} ${el?.getAttribute('name') ?? el?.textContent?.trim().slice(0, 40)}`;
});

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixture.html');
});

/** A form whose Send runs `press`, with a required name field that starts at `name`. */
const form = (name: string, press: unknown, extra: Record<string, unknown> = {}) => ({
  root: 'screen',
  state: { form: { name, on: false } },
  elements: {
    screen: { type: 'Screen', props: {}, children: ['header', 'name', 'send', ...Object.keys(extra)] },
    header: { type: 'PageHeader', props: { title: 'Sign up' }, children: [] },
    name: { type: 'TextField', props: { label: 'Name', required: true, error: 'Enter your name.', value: { $bindState: '/form/name' } }, children: [] },
    send: { type: 'Button', props: { label: 'Send', variant: 'filled' }, on: { press }, children: [] },
    ...extra,
  },
});
const submit = { action: 'submit', params: { form: 'signup', values: { $state: '/form' } } };

test.describe('a field is checked right before each action that reads it', () => {
  test('an action earlier in the binding that empties a field holds the submit that reads it', async ({ page }) => {
    await draw(page, form('Ada', [{ action: 'setState', params: { statePath: '/form/name', value: '' } }, submit]));
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => held(page)).toEqual(['submit']);
    expect(await ran(page)).toEqual([]);
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await expect(page.getByText('Enter your name.')).toBeVisible();
  });

  test('an action earlier in the binding that fills a field lets the submit that reads it run', async ({ page }) => {
    await draw(page, form('', [{ action: 'setState', params: { statePath: '/form/name', value: 'Ada' } }, submit]));
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => ran(page)).toEqual([{ name: 'submit', params: { form: 'signup', values: { name: 'Ada', on: false } } }]);
    expect(await held(page)).toEqual([]);
  });

  test('a Switch’s change goes through the same check as a press', async ({ page }) => {
    await draw(page, form('', { action: 'setState', params: { statePath: '/x', value: 1 } }, {
      notify: { type: 'Switch', props: { label: 'Notify me', checked: { $bindState: '/form/on' } }, on: { change: submit }, children: [] },
    }));
    await page.getByRole('switch', { name: 'Notify me' }).click();
    await expect.poll(() => held(page)).toEqual(['submit']);
    expect(await ran(page)).toEqual([]);
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();
  });
});

test('actions before a held one read their repeat item, as json-render resolves them', async ({ page }) => {
  await draw(page, {
    root: 'screen',
    state: { items: [{ id: 'a', title: 'First' }], form: { name: '' } },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['header', 'name', 'list'] },
      header: { type: 'PageHeader', props: { title: 'Items' }, children: [] },
      name: { type: 'TextField', props: { label: 'Name', required: true, value: { $bindState: '/form/name' } }, children: [] },
      list: { type: 'FormSection', props: { legend: 'Items' }, repeat: { statePath: '/items', key: 'id' }, children: ['archive'] },
      archive: {
        type: 'Button',
        props: { label: { $item: 'title' } },
        on: { press: [{ action: 'archive', params: { id: { $template: '${id}' } } }, submit] },
        children: [],
      },
    },
  });
  await page.getByRole('button', { name: 'First' }).click();
  await expect.poll(() => held(page)).toEqual(['submit']);
  expect(await ran(page)).toEqual([{ name: 'archive', params: { id: 'a' } }]);
});

test('a number field keeps a number in state', async ({ page }) => {
  await draw(page, {
    root: 'screen',
    state: { minutes: '' },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['minutes'] },
      minutes: { type: 'TextField', props: { label: 'Minutes', type: 'number', value: { $bindState: '/minutes' } }, children: [] },
    },
  });
  await page.getByRole('spinbutton', { name: 'Minutes' }).fill('7.5');
  await expect.poll(() => page.evaluate(() => window.states.at(-1)?.minutes)).toBe(7.5);
});

/** A list whose row opens a detail View in place, with the detail left out while it's still on its way. */
const inbox = (withDetail: boolean) => ({
  root: 'screen',
  state: { open: '' },
  elements: {
    screen: { type: 'Screen', props: {}, children: ['list', 'detail'] },
    list: { type: 'View', props: {}, visible: { $state: '/open', not: true }, children: ['header', 'rows'] },
    header: { type: 'PageHeader', props: { title: 'Inbox' }, children: [] },
    rows: { type: 'ListGroup', props: { title: 'Today' }, children: ['m1'] },
    m1: { type: 'ListRow', props: { title: 'Grace Hopper' }, on: { press: { action: 'setState', params: { statePath: '/open', value: 'm1' } } }, children: [] },
    ...(withDetail ? {
      detail: { type: 'View', props: {}, visible: { $state: '/open', eq: 'm1' }, children: ['detail-header'] },
      'detail-header': {
        type: 'PageHeader',
        props: { title: 'Venue for Thursday', back: { label: 'Inbox' } },
        on: { back: { action: 'setState', params: { statePath: '/open', value: '' } } },
        children: [],
      },
    } : {}),
  },
});

test('a row whose detail hasn’t streamed yet can’t be pressed, and opens once its View arrives', async ({ page }) => {
  await draw(page, inbox(false), true);
  const row = page.locator('.ld-row', { hasText: 'Grace Hopper' });
  await expect(row).toBeVisible();
  await expect(row.locator('.ld-row-target')).toHaveCount(0);
  await expect(row.locator('.ld-row-chevron')).toHaveCount(0);
  await draw(page, inbox(true), false);
  await row.locator('.ld-row-target').press('Enter');
  await expect(page.getByRole('heading', { name: 'Venue for Thursday' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(row.locator('.ld-row-target')).toBeFocused();
});

test('a press that hides every control leaves focus on the screen, not on the page’s body', async ({ page }) => {
  await draw(page, {
    root: 'screen',
    state: { done: false },
    elements: {
      screen: { type: 'Screen', props: {}, children: ['view'] },
      view: { type: 'View', props: {}, visible: { $state: '/done', not: true }, children: ['go'] },
      go: { type: 'Button', props: { label: 'Finish' }, on: { press: { action: 'setState', params: { statePath: '/done', value: true } } }, children: [] },
    },
  });
  await page.getByRole('button', { name: 'Finish' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Finish' })).toHaveCount(0);
  await expect.poll(() => focused(page)).not.toBe('BODY');
});
