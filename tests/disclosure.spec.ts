// A card Disclosure's trigger draws its focus ring and pressed fill inside the card's corners: all four while the panel
// is closed, the top two while it's open and the panel continues below. A plain one stays square.
import { test, expect, type Locator } from '@playwright/test';

const corners = (el: Locator) => el.evaluate((e) => {
  const s = getComputedStyle(e);
  return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
});

for (const hc of [false, true]) {
  test(`${hc ? 'in high contrast, ' : ''}a card Disclosure's trigger follows the card's corners, closed and open`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((hc) => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: hc })), hc);
    await page.goto('/components');
    const disc = page.getByRole('region', { name: 'Disclosure' }).locator('.ld-disc').first();
    const head = disc.locator('.ld-disc-head');
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    const [card] = await corners(disc);
    expect(card).not.toBe('0px');
    expect(await corners(head)).toEqual([card, card, card, card]);
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(await corners(head)).toEqual([card, card, '0px', '0px']);
  });
}

test('a plain Disclosure\'s trigger stays square', async ({ page }) => {
  await page.goto('/app/inbox/m6');
  const heads = page.getByRole('region', { name: 'Messages, newest first' }).locator('.ld-disc-plain .ld-disc-head');
  await expect(heads.first()).toBeVisible();
  for (const head of await heads.all()) expect(await corners(head)).toEqual(['0px', '0px', '0px', '0px']);
});
