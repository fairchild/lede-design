// OnboardingFlow on its own, outside the demo: an uncontrolled Finish that waits for its save, and a controlled step
// that waits for an account. src/pages/fixtures/OnboardingFixtures.tsx holds both.
import { test, expect, type Page } from '@playwright/test';

const slow = (page: Page) => page.getByRole('region', { name: 'Slow finish' });
const held = (page: Page) => page.getByRole('region', { name: 'Held step' });
const RETRY = 'Your answers weren’t saved. They’re still here, so try again.';

/** Opens the fixture and takes the slow flow to Review, with Finish pressed and its save pending. */
async function pending(page: Page) {
  await page.goto('/fixtures/onboarding');
  await slow(page).getByRole('button', { name: 'Continue' }).click();
  await slow(page).getByRole('button', { name: 'Continue' }).click();
  await slow(page).getByRole('button', { name: 'Finish', exact: true }).press('Enter');
  await expect(slow(page).getByRole('button', { name: 'Finishing…' })).toBeFocused();
}

test('Finish saves once while its save is pending, and the done step waits for it', async ({ page }) => {
  await pending(page);
  await page.keyboard.press('Enter');
  await slow(page).getByRole('button', { name: 'Finishing…' }).click();
  await expect(slow(page).getByText('Saves asked for: 1')).toBeVisible();
  await expect(slow(page).locator('form')).toHaveAttribute('aria-busy', 'true');
  await expect(slow(page).getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
  await expect(slow(page).getByRole('button', { name: 'Back' })).toBeDisabled();
  await slow(page).getByRole('button', { name: 'Finish save' }).click();
  await expect(slow(page).getByRole('heading', { level: 1, name: 'You’re all set, Ada' })).toBeVisible();
  await expect(slow(page).getByText('Saves asked for: 1')).toBeVisible();
});

test('a refused save stays on Review with its reason, and Finish can try again', async ({ page }) => {
  await pending(page);
  await slow(page).getByRole('button', { name: 'Refuse save' }).click();
  await expect(slow(page).getByRole('alert')).toHaveText('The server is busy. Try again in a minute.');
  await expect(slow(page).getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
  await expect(slow(page).locator('form')).not.toHaveAttribute('aria-busy');
  const finish = slow(page).getByRole('button', { name: 'Finish', exact: true });
  await finish.press('Enter');
  await expect(slow(page).getByText('Saves asked for: 2')).toBeVisible();
  await slow(page).getByRole('button', { name: 'Refuse, no reason' }).click();
  await expect(slow(page).getByRole('alert')).toHaveText(RETRY);
  await finish.press('Enter');
  await slow(page).getByRole('button', { name: 'Finish save' }).click();
  await expect(slow(page).getByRole('heading', { level: 1, name: 'You’re all set, Ada' })).toBeVisible();
});

test('a save that throws as Finish is pressed stays on Review with its reason, and Finish works again', async ({ page }) => {
  await page.goto('/fixtures/onboarding');
  await slow(page).getByRole('button', { name: 'Throw on the next Finish' }).click();
  await slow(page).getByRole('button', { name: 'Continue' }).click();
  await slow(page).getByRole('button', { name: 'Continue' }).click();
  const finish = slow(page).getByRole('button', { name: 'Finish', exact: true });
  await finish.press('Enter');
  await expect(slow(page).getByRole('alert')).toHaveText('The form couldn’t be sent.');
  await expect(finish).toBeFocused();
  await finish.press('Enter');
  await expect(slow(page).getByText('Saves asked for: 1')).toBeVisible();
  await slow(page).getByRole('button', { name: 'Finish save' }).click();
  await expect(slow(page).getByRole('heading', { level: 1, name: 'You’re all set, Ada' })).toBeVisible();
});

const controlled = (page: Page) => page.getByRole('region', { name: 'Controlled finish' });

/** Opens the fixture and takes the controlled flow to Review, with Finish pressed and its save pending. */
async function controlledPending(page: Page) {
  const flow = controlled(page);
  await page.goto('/fixtures/onboarding');
  await flow.getByRole('button', { name: 'Continue' }).click();
  await flow.getByRole('button', { name: 'Continue' }).click();
  await flow.getByRole('button', { name: 'Finish', exact: true }).press('Enter');
  await expect(flow.getByRole('button', { name: 'Finishing…' })).toBeVisible();
  return flow;
}

test('a save that settles after a controlled step moved on leaves the step where it is', async ({ page }) => {
  const flow = await controlledPending(page);
  await flow.getByRole('button', { name: 'Show Preferences', exact: true }).click();
  await expect(flow.getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
  await flow.getByRole('button', { name: 'Finish save' }).click();
  await expect(flow.getByText('Saves settled: 1')).toBeVisible();
  await expect(flow.getByText('Step asked for: 1')).toBeVisible();
  await expect(flow.getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
});

test('back on Review while its save is on its way, Finish waits for that save, which finishes the flow', async ({ page }) => {
  const flow = await controlledPending(page);
  await flow.getByRole('button', { name: 'Show Preferences', exact: true }).click();
  await expect(flow.getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
  await flow.getByRole('button', { name: 'Show Review' }).click();
  const finishing = flow.getByRole('button', { name: 'Finishing…' });
  await expect(finishing).toBeVisible();
  await finishing.press('Enter');
  await expect(flow.getByText('Saves asked for: 1')).toBeVisible();
  // The answers on Review are the ones the save carries, so it counts.
  await flow.getByRole('button', { name: 'Finish save' }).click();
  await expect(flow.getByRole('heading', { level: 1, name: 'You’re all set, Grace' })).toBeVisible();
  await expect(flow.getByText('Saves asked for: 1')).toBeVisible();
});

test('a save on its way with answers changed since leaves Review as it is, and Finish saves the new ones', async ({ page }) => {
  const flow = await controlledPending(page);
  await flow.getByRole('button', { name: 'Show Preferences', exact: true }).click();
  await flow.getByRole('switch', { name: 'Send me a daily brief' }).click();
  await flow.getByRole('button', { name: 'Show Review' }).click();
  await expect(flow.getByRole('button', { name: 'Finishing…' })).toBeVisible();
  await flow.getByRole('button', { name: 'Finish save' }).click();
  await expect(flow.getByText('Saves settled: 1')).toBeVisible();
  await expect(flow.getByText('Step asked for: 2')).toBeVisible();
  const finish = flow.getByRole('button', { name: 'Finish', exact: true });
  await expect(finish).toBeVisible();
  await finish.press('Enter');
  await expect(flow.getByText('Saves asked for: 2')).toBeVisible();
  await flow.getByRole('button', { name: 'Finish save' }).click();
  await expect(flow.getByRole('heading', { level: 1, name: 'You’re all set, Grace' })).toBeVisible();
});

test('a controlled step past Account waits for Continue, not for the keystroke that makes the account valid', async ({ page }) => {
  await page.goto('/fixtures/onboarding');
  await expect(held(page).getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await held(page).getByLabel('Name').fill('Ada Lovelace');
  const email = held(page).getByLabel('Email');
  await email.click();
  await email.pressSequentially('ada@example.com');
  await expect(email).toBeFocused();
  await expect(email).toHaveValue('ada@example.com');
  await expect(held(page).getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(held(page).getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
  await expect(held(page).getByText('Step asked for: 1')).toBeVisible();
});

test('a field’s error clears as it’s fixed, and stays while it’s still wrong', async ({ page }) => {
  await page.goto('/fixtures/onboarding');
  const name = slow(page).getByLabel('Name');
  const email = slow(page).getByLabel('Email');
  await name.fill('');
  await email.fill('ada@');
  await slow(page).getByRole('button', { name: 'Continue' }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await name.pressSequentially('A');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription('');
  await email.pressSequentially('example');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await email.pressSequentially('.com');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('We’ll send your brief here.');
});
