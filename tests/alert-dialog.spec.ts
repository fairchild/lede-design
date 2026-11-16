import { expect, test } from '@playwright/test';

// AlertDialog in the detail on /fixtures/page-header, whose PageHeader backs out on Escape.
test.beforeEach(async ({ page }) => {
  await page.goto('/fixtures/page-header');
  await page.getByRole('button', { name: 'Open the detail' }).click();
});

test('a critical dialog opens on Cancel, names and describes itself, and Cancel changes nothing', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Delete the venue' });
  await trigger.click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete Harbor Hall?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription('Thursday’s booking goes too. You can’t undo this.');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByText('Last action: Nothing yet')).toBeVisible();
});

test('confirming runs the action, closes the dialog and returns focus to the trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Delete the venue' });
  await trigger.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByText('Last action: Deleted')).toBeVisible();
  await expect(trigger).toBeFocused();
});

test('a primary dialog a parent opens lands on its confirm button, and Enter confirms', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A keyboard path.');
  const opener = page.getByRole('button', { name: 'Book the venue' });
  await opener.click();
  const dialog = page.getByRole('alertdialog', { name: 'Book Harbor Hall for Thursday?' });
  await expect(dialog.getByRole('button', { name: 'Book' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Last action: Booked')).toBeVisible();
  await expect(opener).toBeFocused();
});

test('Escape closes the dialog and leaves the detail under it open; a second Escape backs out', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Escape is a keyboard path.');
  const trigger = page.getByRole('button', { name: 'Delete the venue' });
  await trigger.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Venue for Thursday' })).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open the detail' })).toBeFocused();
});

test('Tab stays inside the open dialog, and a press outside it does nothing', async ({ page, isMobile }) => {
  await page.getByRole('button', { name: 'Delete the venue' }).click();
  const dialog = page.getByRole('alertdialog');
  // Focus moves in once the dialog has opened; Tab before then would start from the trigger.
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  if (!isMobile) {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  }
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
});
