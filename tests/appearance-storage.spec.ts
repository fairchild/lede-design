import { test, expect } from '@playwright/test';

const DEFAULT_SUMMARY = 'Automatic · Blue · Soft corners';

const stored: Record<string, string> = {
  'a null accent': '{"accent":null}',
  'an unknown shape': '{"shape":"round"}',
  'an unknown scheme': '{"scheme":"sepia"}',
  'an unknown accent': '{"accent":"plaid"}',
  'wrong-typed switches': '{"highContrast":"yes","compact":1,"solidGlass":null}',
  'JSON that is not an object': '5',
  'a stored null': 'null',
  'an array': '[1]',
  'invalid JSON': '{not json',
};

for (const [name, value] of Object.entries(stored)) {
  test(`Settings and Appearance fall back to the defaults for ${name}`, async ({ page }) => {
    await page.addInitScript((v) => localStorage.setItem('lede:appearance', v), value);
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('main').getByText(`${DEFAULT_SUMMARY} · sync`)).toBeVisible();
    await page.goto('/app/settings/appearance');
    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('main').getByText(DEFAULT_SUMMARY, { exact: true })).toBeVisible();
  });
}

test('A valid field survives beside an invalid one', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:appearance', '{"accent":null,"shape":"crisp","scheme":"dark"}'));
  await page.goto('/app/settings/appearance');
  await expect(page.getByRole('main').getByText('Dark · Blue · Crisp corners', { exact: true })).toBeVisible();
});

const inherited = [
  { name: 'inherited names', value: '{"toString":1,"constructor":1,"hasOwnProperty":true}', summary: 'Automatic · Blue · Soft corners' },
  { name: 'a __proto__ key beside a valid accent', value: '{"__proto__":1,"accent":"pink"}', summary: 'Automatic · Pink · Soft corners' },
];

for (const { name, value, summary } of inherited) {
  test(`Storage holding ${name} adds no keys, and valid fields still load`, async ({ page }) => {
    await page.addInitScript((v) => localStorage.setItem('lede:appearance', v), value);
    await page.goto('/app/settings/appearance');
    await expect(page.getByRole('main').getByText(summary, { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Compact controls' }).click();
    const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lede:appearance')!)).sort());
    expect(saved).toEqual(['accent', 'compact', 'highContrast', 'scheme', 'shape', 'solidGlass']);
  });
}
