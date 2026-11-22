import { test, expect } from '@playwright/test';

// The appearance lives in the URL (src/theme.tsx), which anyone can edit, so a param counts only when it reads as an
// allowed value, a bad one reads as the default, and nothing is read from or written to storage.

const DEFAULT_SUMMARY = 'Automatic · Blue · Soft corners';

const bad: Record<string, string> = {
  'an unknown shape': 'shape=round',
  'an unknown scheme': 'scheme=sepia',
  'an unknown accent': 'accent=plaid',
  'an empty accent': 'accent=',
  'inherited names': 'accent=toString&shape=constructor&scheme=__proto__',
  'switches with other values': 'contrast=yes&density=1&glass=null',
};

for (const [name, query] of Object.entries(bad)) {
  test(`Settings and Appearance fall back to the defaults for ${name}`, async ({ page }) => {
    await page.goto(`/app/settings?${query}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('main').getByText(`${DEFAULT_SUMMARY} · sync`)).toBeVisible();
    await page.goto(`/app/settings/appearance?${query}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('main').getByText(DEFAULT_SUMMARY, { exact: true })).toBeVisible();
  });
}

test('A valid param survives beside an invalid one', async ({ page }) => {
  await page.goto('/app/settings/appearance?accent=plaid&shape=crisp&scheme=dark');
  await expect(page.getByRole('main').getByText('Dark · Blue · Crisp corners', { exact: true })).toBeVisible();
});

test('A change in Appearance goes to the URL and not to storage', async ({ page }) => {
  await page.goto('/app/settings/appearance');
  await page.getByRole('switch', { name: 'Compact controls' }).click();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ density: 'compact' });
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k === 'lede:appearance' || k === 'lede:look'))).toEqual([]);
});
