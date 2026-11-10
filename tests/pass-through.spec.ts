// Components take HTML attributes and a ref, and each lands on the element the component's doc comment names: the one
// a person sees and acts on. src/pages/fixtures/PassThroughFixtures.tsx gives every case an id, a data-* attribute,
// aria-describedby and a ref callback that marks its element.
import { test, expect, type Page } from '@playwright/test';

/** The element with the case's id, checked for the tag the doc comment names and for all four pass-throughs. */
async function landsOn(page: Page, id: string, tag: string) {
  const el = page.locator(`#${id}`);
  await expect(el).toHaveCount(1);
  expect(await el.evaluate((e) => e.tagName.toLowerCase())).toBe(tag);
  await expect(el).toHaveAttribute('data-case', id);
  await expect(el).toHaveAttribute('aria-describedby', 'pass-note');
  await expect(el).toHaveAttribute('data-ref', 'attached');
  return el;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/fixtures/pass-through');
  await expect(page.getByRole('heading', { level: 1, name: 'Pass-through fixtures' })).toBeVisible();
});

test('a Button\'s attributes and ref land on its <button>, or its <a> with href', async ({ page }) => {
  await expect(await landsOn(page, 'pass-button', 'button')).toHaveAccessibleDescription(/names this paragraph/);
  await expect(await landsOn(page, 'pass-button-link', 'a')).toHaveAttribute('href', '#pass-note');
});

test('a Disclosure\'s attributes, style and ref land on its <section>', async ({ page }) => {
  const section = await landsOn(page, 'pass-disclosure', 'section');
  await expect(section).toHaveClass(/(?<![\w-])ld-disc(?![\w-])/);
  expect(await section.getAttribute('style')).toContain('max-inline-size: 40rem');
});

test('a SegmentedControl\'s attributes and ref land on its <fieldset>, and form and required on each radio', async ({ page }) => {
  const set = await landsOn(page, 'pass-segmented', 'fieldset');
  const radios = set.getByRole('radio');
  await expect(radios).toHaveCount(2);
  for (const radio of await radios.all()) {
    await expect(radio).toHaveAttribute('form', 'pass-form');
    await expect(radio).toHaveAttribute('required', '');
  }
  expect(await page.locator('#pass-form').evaluate((f: HTMLFormElement) => f.elements.length)).toBe(2);
});

test('an Avatar\'s attributes and ref land on its initials <span>, or its <img>', async ({ page }) => {
  await expect(await landsOn(page, 'pass-avatar', 'span')).toHaveAttribute('title', 'Hana Sato');
  const img = await landsOn(page, 'pass-avatar-picture', 'img');
  await expect(img).toHaveAttribute('title', 'Ren Ito');
  for (const [name, value] of [['loading', 'lazy'], ['decoding', 'async'], ['referrerpolicy', 'no-referrer'], ['crossorigin', 'anonymous']]) {
    await expect(img).toHaveAttribute(name, value);
  }
});

test('a link to a Disclosure\'s id scrolls to the level and leaves it closed', async ({ page }) => {
  const section = page.locator('#pass-disclosure');
  await expect(section).not.toBeInViewport();
  await page.getByRole('link', { name: 'Go to the level' }).click();
  await expect(page).toHaveURL(/#pass-disclosure$/);
  await expect(section).toBeInViewport();
  await expect(section.getByRole('button', { name: /A level/ })).toHaveAttribute('aria-expanded', 'false');
});

test('a SegmentedControl\'s and a Table.Root\'s ref run the cleanup a React 19 ref callback returns', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Ref cleanups' });
  await region.getByRole('button', { name: 'Toggle the refs' }).click();
  await expect(region.getByText('SegmentedControl cleanups: 1 · Table cleanups: 1')).toBeVisible();
});

test('a Table.Root\'s attributes land on its <table>, and className, style and ref on the scroll box', async ({ page }) => {
  const table = page.locator('#pass-table');
  await expect(table).toHaveCount(1);
  expect(await table.evaluate((e) => e.tagName.toLowerCase())).toBe('table');
  await expect(table).toHaveAttribute('data-case', 'pass-table');
  await expect(table).toHaveAccessibleDescription(/names this paragraph/);
  await expect(table).toHaveAccessibleName('Two days');
  const box = page.locator('.pass-table-box');
  await expect(box).toHaveClass(/(?<![\w-])ld-table-scroll(?![\w-])/);
  await expect(box).toHaveAttribute('data-ref', 'attached');
  expect(await box.getAttribute('style')).toContain('max-inline-size: 40rem');
  await expect(box.locator('> table')).toHaveAttribute('id', 'pass-table');
});

test('a Switch\'s attributes and ref land on its role="switch" element, id and the form props on its native checkbox, and className and style on the <label>', async ({ page }) => {
  const sw = page.getByRole('switch', { name: 'Reminders' });
  await expect(sw).toHaveAttribute('data-case', 'pass-switch');
  await expect(sw).toHaveAttribute('aria-describedby', 'pass-note');
  await expect(sw).toHaveAttribute('data-ref', 'attached');
  // Base UI gives the id to the hidden native checkbox, so a <label htmlFor> names the switch.
  expect(await page.locator('#pass-switch').evaluate((e) => (e as HTMLInputElement).type)).toBe('checkbox');
  await expect(sw).toHaveAccessibleName('Reminders');
  await expect(sw).toHaveAccessibleDescription(/names this paragraph/);
  const wrapper = page.locator('.pass-switch-wrapper');
  expect(await wrapper.evaluate((e) => e.tagName.toLowerCase())).toBe('label');
  expect(await wrapper.getAttribute('style')).toContain('max-inline-size: 40rem');
  const form = page.locator('#pass-switch-form');
  // The hidden input Base UI keeps takes the form props: it belongs to the form by id, and an unchecked required switch leaves the form invalid.
  expect(await form.evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false);
  await sw.click();
  expect(await form.evaluate((f: HTMLFormElement) => [...new FormData(f)])).toEqual([['reminders', 'on']]);
  expect(await form.evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(true);
});

test('a Checkbox\'s attributes and ref land on its input, and className, style and hidden on the wrapper', async ({ page }) => {
  const input = await landsOn(page, 'pass-checkbox', 'input');
  await expect(input).toHaveAccessibleName('Starred');
  const wrapper = page.locator('.pass-checkbox-wrapper');
  expect(await wrapper.getAttribute('style')).toContain('max-inline-size: 40rem');
  await expect(wrapper.locator('> input')).toHaveAttribute('id', 'pass-checkbox');
  const hidden = page.locator('.pass-checkbox-hidden');
  await expect(hidden).toHaveAttribute('hidden', '');
  await expect(hidden).toBeHidden();
  await expect(page.locator('#pass-checkbox-hidden')).not.toHaveAttribute('hidden');
});

test('a GlassBar\'s attributes, style and ref land on its <nav>', async ({ page }) => {
  const nav = await landsOn(page, 'pass-glass-bar', 'nav');
  await expect(nav).toHaveAccessibleName('Places');
  expect(await nav.getAttribute('style')).toContain('max-inline-size: 40rem');
});
