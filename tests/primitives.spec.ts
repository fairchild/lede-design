// Small primitives and blocks behave as their docs say, on /fixtures/primitives: a glass Card turns opaque under reduced
// transparency, Enter on a Switch presses its form's default button as a native checkbox's does, an uncontrolled
// GlassBar of links marks the page it loaded on and ignores clicks that open a new tab, StepIndicator's summary is
// read on a narrow screen, the most recent Escape layer backs out first, and Checkbox runs a React 19 ref cleanup.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/fixtures/primitives');
  await expect(page.getByRole('heading', { level: 1, name: 'Primitives fixtures' })).toBeVisible();
}

test('Under reduced transparency, a glass Card is as opaque as a plain one, with no blur', async ({ page }) => {
  // Playwright's emulateMedia has no reducedTransparency, and Chromium's own emulation does.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await open(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
  const style = (id: string) => page.getByTestId(id).evaluate((el) => {
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, blur: s.backdropFilter };
  });
  const [glass, plain] = [await style('glass'), await style('plain')];
  expect(glass.background).toBe(plain.background);
  expect(glass.blur).toBe('none');
});

const SWITCH_FORMS = [
  ['Switch with a Submit button', 1, 1],
  ['Switch with a disabled Submit button', 0, 0],
  ['Switch with an image Submit button', 1, 1],
  ['Switch alone, no Submit button', 0, 0],
  ['Switch and one text field, no Submit button', 0, 0],
  ['Switch and two text fields, no Submit button', 0, 0],
] as const;
for (const [section, submits, clicks] of SWITCH_FORMS) {
  test(`Enter on a Switch in “${section}” gives ${submits} submit and ${clicks} click, as a checkbox’s does`, async ({ page }) => {
    await open(page);
    const region = page.getByRole('region', { name: section });
    const control = region.getByRole('switch', { name: 'Daily brief' });
    await control.focus();
    await page.keyboard.press('Enter');
    await expect(region.getByText(`Submits: ${submits} · Clicks: ${clicks}`)).toBeVisible();
    await expect(control).toHaveAttribute('aria-checked', 'false');
    // The browser's own answer: Enter on the native checkbox in the same form adds as much again.
    await region.getByRole('checkbox', { name: 'Native checkbox' }).press('Enter');
    await expect(region.getByText(`Submits: ${submits * 2} · Clicks: ${clicks * 2}`)).toBeVisible();
  });
}

test('A GlassBar of links with no value marks the page it loaded on, and a click that opens a new tab leaves it', async ({ page, context }) => {
  await open(page);
  const bar = page.getByRole('navigation', { name: 'Places' });
  await expect(bar.getByRole('link', { name: 'This page' })).toHaveAttribute('aria-current', 'page');
  await expect(bar.getByRole('link', { name: 'Other page' })).not.toHaveAttribute('aria-current');
  const popup = context.waitForEvent('page');
  await bar.getByRole('link', { name: 'Other page' }).click({ modifiers: ['ControlOrMeta'] });
  await (await popup).close();
  await expect(page).toHaveURL(/\/fixtures\/primitives$/);
  await expect(bar.getByRole('link', { name: 'This page' })).toHaveAttribute('aria-current', 'page');
  await expect(bar.getByRole('link', { name: 'Other page' })).not.toHaveAttribute('aria-current');
});

test('On a narrow screen, StepIndicator’s group reads its one-line summary', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page);
  await expect(page.getByRole('group', { name: 'Progress' })).toMatchAriaSnapshot('- group "Progress":\n  - paragraph: Step 2 of 3 · Preferences');
});

test('Escape backs out of an inner layer that uses useBackOnEscape before the screen’s back link', async ({ page }) => {
  await open(page);
  const opener = page.getByRole('button', { name: 'Open the inner layer' });
  await opener.click();
  await expect(page.getByText('The inner layer is open.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('The inner layer is open.')).toBeHidden();
  await expect(page).toHaveURL(/\/fixtures\/primitives$/);
  await expect(opener).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/fixtures\/page-header$/);
});

test('Checkbox runs the cleanup a React 19 ref callback returns', async ({ page }) => {
  await open(page);
  const region = page.getByRole('region', { name: 'Checkbox ref' });
  await region.getByRole('button', { name: 'Toggle the checkbox' }).click();
  await expect(region.getByRole('checkbox')).toHaveCount(0);
  await expect(region.getByText('Ref cleanups: 1')).toBeVisible();
});
