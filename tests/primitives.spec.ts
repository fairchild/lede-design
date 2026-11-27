// Small primitives and blocks behave as their docs say, on /fixtures/primitives: a glass Card turns opaque under reduced
// transparency, Enter on a Switch presses its form's default button as a native checkbox's does, an uncontrolled
// GlassBar of links marks the page it loaded on and ignores clicks that open a new tab, StepIndicator's summary is
// read on a narrow screen, an inner Escape layer backs out before the screen's however the layers mounted, and Checkbox runs a React 19 ref cleanup.
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

test('Enter on a Switch whose onKeyDown prevents its default submits nothing', async ({ page }) => {
  await open(page);
  const region = page.getByRole('region', { name: 'Switch whose onKeyDown prevents Enter' });
  await region.getByRole('switch', { name: 'Daily brief' }).press('Enter');
  // The Submit button beside it still submits, so the zero below is the Switch's doing.
  await region.getByRole('button', { name: 'Submit' }).click();
  await expect(region.getByText('Submits: 1 · Clicks: 1')).toBeVisible();
});

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

test('Escape backs out of an inner layer that mounted open before the screen’s PageHeader, in the same commit', async ({ page }) => {
  await page.goto('/fixtures/primitives?inner=open');
  await expect(page.getByRole('heading', { level: 1, name: 'Primitives fixtures' })).toBeFocused();
  await expect(page.getByText('The inner layer is open.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('The inner layer is open.')).toBeHidden();
  await expect(page).toHaveURL(/\/fixtures\/primitives\?inner=open$/);
  await expect(page.getByRole('button', { name: 'Open the inner layer' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/fixtures\/page-header$/);
});

test('Escape backs out of an open inner layer first after the screen turns backOnEscape off and on again', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Open the inner layer' }).click();
  await expect(page.getByText('The inner layer is open.')).toBeVisible();
  const toggle = page.getByRole('checkbox', { name: 'Escape goes back' });
  await toggle.uncheck();
  await toggle.check();
  await page.keyboard.press('Escape');
  await expect(page.getByText('The inner layer is open.')).toBeHidden();
  await expect(page).toHaveURL(/\/fixtures\/primitives$/);
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

// A tool's corner plus the toolbar's inset is the toolbar's corner, so they are concentric. Square tools keep a square bar.
for (const [shape, look] of [['soft', ''], ['crisp', ''], ['square', ''], ['soft', 'skeuo'], ['soft', 'brutal']] as const) {
  test(`GlassToolbar's and GlassBar's corners are concentric with their items' in the ${shape} shape${look ? ` under the ${look} look` : ''}`, async ({ page }) => {
    const params = new URLSearchParams();
    if (shape !== 'soft') params.set('shape', shape);
    if (look) params.set('look', look);
    await page.goto(`/components?${params}`);
    const bar = page.getByRole('toolbar', { name: 'Photo tools' });
    const px = (v: string) => parseFloat(v);
    const { barRadius, inset } = await bar.evaluate((el) => {
      const s = getComputedStyle(el);
      return { barRadius: s.borderTopLeftRadius, inset: s.paddingTop };
    });
    const toolRadius = await bar.getByRole('button', { name: 'Select' }).evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(px(barRadius)).toBeCloseTo(px(toolRadius) === 0 ? 0 : px(toolRadius) + px(inset), 1);
    // GlassBar beside it follows the same rule with its places.
    const places = page.locator('[aria-label="Example sections"]');
    const placeRadius = await places.locator('.ld-bar-item').first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const placesRadius = await places.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    if (px(placeRadius) < 100) expect(px(placesRadius)).toBeCloseTo(px(placeRadius) === 0 ? 0 : px(placeRadius) + px(inset), 1);
  });
}

test('A Checkbox under aria-disabled keeps focus and ignores clicks, label clicks and Space, and runs no onChange', async ({ page }) => {
  await open(page);
  const region = page.getByRole('region', { name: 'Checkbox aria-disabled' });
  for (const name of ['Controlled', 'Uncontrolled']) {
    const box = region.getByRole('checkbox', { name, exact: true });
    await expect(box).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits for an aria-disabled control to be enabled, so the clicks are forced.
    await box.click({ force: true });
    await region.getByText(name, { exact: true }).click({ force: true });
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).toBeFocused();
    await expect(box).not.toBeChecked();
  }
  await expect(region.getByText('Changes: 0')).toBeVisible();
});
