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
  await expect(await landsOn(page, 'pass-avatar-picture', 'img')).toHaveAttribute('title', 'Ren Ito');
});
