import { test, expect } from '@playwright/test';

const FIELDS = ['bio', 'email', 'location', 'name', 'role'];

const stored: Record<string, string> = {
  'inherited names': '{"toString":"x","constructor":"x","hasOwnProperty":"x"}',
  'a __proto__ key': '{"__proto__":"x"}',
  'an unknown key': '{"nickname":"Han"}',
  'a non-string value': '{"name":5,"role":null,"location":["Porto"]}',
  'JSON that is not an object': '5',
  'a stored null': 'null',
  'invalid JSON': '{not json',
};

for (const [name, value] of Object.entries(stored)) {
  test(`Storage holding ${name} leaves the sample profile, and a save writes only the profile's fields`, async ({ page }) => {
    await page.addInitScript((v) => localStorage.setItem('lede:profile', v), value);
    await page.goto('/app/settings');
    await expect(page.getByRole('main').getByRole('link').first()).toHaveAccessibleName(/Hana Sato/);
    await page.goto('/app/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Hana Sato' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status')).toHaveText('Profile saved');
    const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lede:profile')!)).sort());
    expect(saved).toEqual(FIELDS);
  });
}

test('A valid field survives beside inherited, unknown and non-string ones', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:profile', '{"toString":"x","__proto__":"x","nickname":"Han","email":5,"name":"Hana Mori","location":"Porto"}'));
  await page.goto('/app/profile');
  await expect(page.getByRole('heading', { level: 1, name: 'Hana Mori' })).toBeVisible();
  const details = page.getByRole('region', { name: 'Details' });
  await expect(details.getByText('Porto', { exact: true })).toBeVisible();
  await expect(details.getByText('hana@example.com', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lede:profile')!));
  expect(Object.keys(saved).sort()).toEqual(FIELDS);
  expect(saved).toMatchObject({ name: 'Hana Mori', location: 'Porto', email: 'hana@example.com' });
});
