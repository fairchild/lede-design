import { test, expect, type Page } from '@playwright/test';

// A docs view is shareable by its URL (src/url-state.ts), which is the only place view state lives. A choice writes
// itself to the address without a new history entry; a fresh browser that opens the address sees the same screen; the
// look and the appearance follow the reader from page to page; and a bare URL is the defaults.

const historyLength = (page: Page) => page.evaluate(() => history.length);

test('picking a look writes ?look= and a fresh browser opening the link sees that look', async ({ page, browser }) => {
  await page.goto('/looks?chrome=0');
  const before = await historyLength(page);
  await page.getByRole('group', { name: 'Look' }).getByRole('radio', { name: 'Neo-brutalist' }).check();
  await expect(page.locator('.app-root')).toHaveAttribute('data-look', 'brutal');
  expect(new URL(page.url()).searchParams.get('look')).toBe('brutal');
  expect(await historyLength(page), 'a change of view adds no Back step').toBe(before);
  // Back to Lede takes the param out again.
  await page.getByRole('group', { name: 'Look' }).getByRole('radio', { name: 'Lede' }).check();
  expect(new URL(page.url()).searchParams.has('look')).toBe(false);

  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto('/looks?look=broadsheet&chrome=0');
  await expect(fresh.locator('.app-root')).toHaveAttribute('data-look', 'broadsheet');
  await expect(fresh.getByRole('group', { name: 'Look' }).getByRole('radio', { name: 'Broadsheet' })).toBeChecked();
  await other.close();
});

test('the look and the appearance follow the reader to the next page, and a page’s own choice stays behind', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?look=skeuo&chrome=0');
  await page.locator('.ld-shell-footer, .docs-page-foot').filter({ visible: true }).getByRole('radio', { name: 'Dark' }).check();
  await page.getByRole('group', { name: 'Example' }).getByRole('radio', { name: 'Daily brief' }).check();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ look: 'skeuo', chrome: '0', scheme: 'dark', example: 'today' });
  await page.getByRole('link', { name: 'Components' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/components\?/);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ look: 'skeuo', scheme: 'dark' });
  // Back brings the example back with its entry.
  await page.goBack();
  await expect(page.getByRole('group', { name: 'Example' }).getByRole('radio', { name: 'Daily brief' })).toBeChecked();
});

test('a bare URL is the defaults: nothing a page chose before is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/foundations?scheme=dark&contrast=high&look=brutal&chrome=0');
  await expect(page.locator('.app-root')).toHaveAttribute('data-theme', 'dark-hc');
  await page.goto('/foundations');
  await expect(page.locator('.app-root')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.app-root')).not.toHaveAttribute('data-look');
  expect(new URL(page.url()).search).toBe('');
});

test('a layout preview’s frame gets the look and the appearance in its own URL', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The frame’s URL is the same at every width.');
  await page.goto('/?look=skeuo&contrast=high&chrome=0');
  const frame = page.locator('iframe.docs-preview-frame');
  await expect(frame).toHaveAttribute('src', '/app/inbox/m1?look=skeuo&contrast=high');
  await page.locator('.ld-shell-footer, .docs-page-foot').filter({ visible: true }).getByRole('switch', { name: 'Increase contrast' }).click();
  await expect(frame).toHaveAttribute('src', '/app/inbox/m1?look=skeuo');
});

test('Back to a page brings its own choice back', async ({ page }) => {
  await page.goto('/blocks/data-table');
  await page.getByRole('group', { name: 'Table state' }).getByRole('radio', { name: 'Empty' }).check();
  expect(new URL(page.url()).searchParams.get('table-state')).toBe('empty');
  await page.goto('/components');
  await page.goBack();
  await expect(page.getByRole('group', { name: 'Table state' }).getByRole('radio', { name: 'Empty' })).toBeChecked();
});

test('a page’s own view opens from its link: Overview’s example and the data table’s state', async ({ page }) => {
  await page.goto('/?example=workbench');
  await expect(page.getByRole('group', { name: 'Example' }).getByRole('radio', { name: 'Three panels' })).toBeChecked();
  await page.goto('/blocks/data-table?table-state=error&rows=500');
  await expect(page.getByRole('group', { name: 'Table state' }).getByRole('radio', { name: 'Error' })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Rows in the example' }).getByRole('radio', { name: '500 rows' })).toBeChecked();
  // An unknown value reads as the default.
  await page.goto('/?example=nope');
  await expect(page.getByRole('group', { name: 'Example' }).getByRole('radio', { name: 'Inbox' })).toBeChecked();
});
