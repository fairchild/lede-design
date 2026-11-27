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

// #68: a control that is a group is named by its own label, and a section holding only it shows the name once.
for (const [where, route] of [['Appearance', '/app/settings/appearance'], ['Onboarding', '/app/welcome']] as const) {
  test(`${where} names Accent once, with its description, as AccentPicker's own group`, async ({ page }) => {
    await page.goto(route);
    // The demo fills in the account step, so Continue reaches the step with Accent.
    if (where === 'Onboarding') await page.getByRole('button', { name: 'Continue' }).click();
    const group = page.getByRole('group', { name: 'Accent', exact: true });
    await expect(group).toHaveCount(1);
    await expect(group.getByRole('radio')).toHaveCount(7);
    await expect(group).toHaveAccessibleDescription('Used for buttons, links, selection and focus.');
    await expect(page.locator('fieldset.ld-form-section').filter({ has: group })).toHaveCount(0);
    // The visible name is the section's legend, apart from the group's own, which only screen readers get.
    await expect(page.locator('.ld-form-legend', { hasText: /^Accent$/ })).toBeVisible();
  });
}

test('the appearance summary lists the accessibility settings that are on', ({ isMobile }) => {
  test.skip(isMobile, 'No page: one project is enough.');
  const base = { scheme: 'auto', highContrast: false, accent: 'blue', shape: 'soft', compact: false, solidGlass: false } as const;
  expect(describeAppearance(base)).toBe('Automatic · Blue · Soft corners');
  expect(describeAppearance({ ...base, highContrast: true, solidGlass: true, compact: true }))
    .toBe('Automatic · Blue · Soft corners · High contrast · Reduced transparency · Compact controls');
});
