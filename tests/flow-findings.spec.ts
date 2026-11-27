// Smaller findings in the flows (#57): Appearance names each choice once, and its summary lists every setting that's on.
import { test, expect } from '@playwright/test';
import { describeAppearance } from '../registry/lede/flows/settings';

test('Appearance names Mode and Corners once each, not as a group inside a group of the same name', async ({ page }) => {
  await page.goto('/app/settings/appearance');
  for (const name of ['Mode', 'Corners']) {
    await expect(page.getByRole('group', { name, exact: true })).toHaveCount(1);
    await expect(page.getByRole('group', { name, exact: true }).getByRole('radio')).toHaveCount(3);
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
});

test('the appearance summary lists the accessibility settings that are on', ({ isMobile }) => {
  test.skip(isMobile, 'No page: one project is enough.');
  const base = { scheme: 'auto', highContrast: false, accent: 'blue', shape: 'soft', compact: false, solidGlass: false } as const;
  expect(describeAppearance(base)).toBe('Automatic · Blue · Soft corners');
  expect(describeAppearance({ ...base, highContrast: true, solidGlass: true, compact: true }))
    .toBe('Automatic · Blue · Soft corners · High contrast · Reduced transparency · Compact controls');
});
