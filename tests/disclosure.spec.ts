// A card Disclosure's trigger draws its focus ring and pressed fill inside the card's corners: all four while the panel
// is closed, the top two while it's open and the panel continues below. A plain one stays square.
import { test, expect, type Locator } from '@playwright/test';
import { withAppearance } from './appearance';

const corners = (el: Locator) => el.evaluate((e) => {
  const s = getComputedStyle(e);
  return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
});

for (const hc of [false, true]) {
  test(`${hc ? 'in high contrast, ' : ''}a card Disclosure's trigger follows the card's corners, closed and open`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await withAppearance(page, { highContrast: hc });
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

test('while the panel closes, the trigger keeps square bottom corners, and rounds them once it has gone', async ({ page }) => {
  await page.goto('/components');
  const disc = page.getByRole('region', { name: 'Disclosure' }).locator('.ld-disc').first();
  const head = disc.locator('.ld-disc-head');
  await head.click();
  await expect(disc.locator('.ld-disc-panel')).toBeVisible();
  await expect(disc.locator('.ld-disc-panel[data-starting-style]')).toHaveCount(0);
  const [card] = await corners(disc);
  // Read the corners on each frame of the close, while the panel still has its ending style.
  const during = await head.evaluate((el) => new Promise<string[]>((done) => {
    const panel = el.closest('.ld-disc')!.querySelector('.ld-disc-panel')!;
    const seen: string[] = [];
    let frames = 0;
    const frame = () => {
      if (panel.hasAttribute('data-ending-style')) seen.push(getComputedStyle(el).borderBottomLeftRadius);
      if (seen.length > 0 && !panel.hasAttribute('data-ending-style')) return done(seen);
      if (++frames > 60) return done(seen);
      requestAnimationFrame(frame);
    };
    (el as HTMLElement).click();
    requestAnimationFrame(frame);
  }));
  expect(during.length).toBeGreaterThan(0);
  expect(new Set(during)).toEqual(new Set(['0px']));
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await corners(head))[2]).toBe(card);
});
