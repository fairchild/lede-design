import { test, expect, type Page } from '@playwright/test';
import { NOT_FOUND, ROUTES } from './routes';

// Every target on every route answers a press over at least 24×24px (WCAG 2.5.8), and over 44×44px where its nearest
// density is `touch`, and a press just inside each of its edges reaches it, so no neighbor's overhang covers it. The area is measured with `elementFromPoint` around each target's center, because a pseudo-element
// can widen what a press reaches past the box that `boundingBox` reports. A press on an input's label counts as a press
// on it. A link inside a sentence is exempt, as WCAG exempts it, and so is what's on a row slid aside to show its actions,
// which is hidden on purpose.

type Density = 'regular' | 'compact' | 'touch';

// The demo stores `compact` and has no setting for `touch`, so touch is set where ThemeProvider renders it, on the
// app's theme root. Every rule a density keys reads that attribute.
async function open(page: Page, route: string, density: Density) {
  await page.addInitScript((compact) => localStorage.setItem('lede:appearance', JSON.stringify({ compact })), density === 'compact');
  await page.goto(route);
  await expect(page.locator('main').first()).toBeVisible();
  if (density === 'touch') await page.locator('.app-root').evaluate((root) => root.setAttribute('data-density', 'touch'));
  expect(await page.locator('.app-root').getAttribute('data-density')).toBe(density);
  await settle(page);
}

// A revealed row's slide is measured from its actions, which change width once the fonts load.
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** Targets whose square around their center doesn't all reach them, with what a press there reaches. */
function short(): string[] {
  // A neighbor's overhang may take a sliver of a target's edge, as the row ••• does on a phone, and no more.
  const EDGE = 4;
  const TARGETS = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="separator"][tabindex]';
  const name = (el: Element) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const inSentence = (el: Element) => getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent?.trim().length ?? 0) > (el.textContent?.trim().length ?? 0);
  const slid = (el: Element) => new DOMMatrix(getComputedStyle(el.closest('.ld-row') ?? document.body).transform).e !== 0;
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(TARGETS)) {
    if (!el.checkVisibility({ visibilityProperty: true }) || el.closest('[inert], [aria-hidden="true"], .ld-sr-only, .ld-skip') || slid(el) || (el as HTMLButtonElement).disabled || inSentence(el)) continue;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const size = el.closest('[data-density]')?.getAttribute('data-density') === 'touch' ? 44 : 24;
    const r = el.getBoundingClientRect();
    const [cx, cy, d] = [r.left + r.width / 2, r.top + r.height / 2, size / 2 - 1];
    const labels = [...((el as HTMLInputElement).labels ?? [])];
    const reaches = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit && (el.contains(hit) || labels.some((label) => label.contains(hit)));
    };
    const e = EDGE;
    const edges = [[r.left + e, cy], [r.right - e, cy], [cx, r.top + e], [cx, r.bottom - e]].filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
    const misses = [[cx - d, cy], [cx + d, cy], [cx, cy - d], [cx, cy + d], ...edges].filter(([x, y]) => !reaches(x, y));
    if (misses.length) {
      const [x, y] = misses[0];
      const hit = document.elementFromPoint(x, y);
      out.push(`“${name(el)}” (${el.className || el.tagName}, ${Math.round(r.width)}×${Math.round(r.height)}px, needs ${size}px) misses at ${Math.round(x - cx)},${Math.round(y - cy)}: ${hit?.className || hit?.tagName}`);
    }
  }
  return out;
}

for (const density of ['regular', 'compact', 'touch'] as const) {
  for (const route of ROUTES.filter((r) => !NOT_FOUND.has(r))) {
    test(`${route} · ${density}: every target answers over its density's hit area`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, route, density);
      expect(await page.evaluate(short)).toEqual([]);
    });
  }
}

// Select mode puts a checkbox on every Inbox row.
for (const density of ['regular', 'compact', 'touch'] as const) {
  test(`/app/inbox in Select mode · ${density}: every target answers over its density's hit area`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/app/inbox', density);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(page.getByRole('checkbox').first()).toBeVisible();
    await settle(page);
    expect(await page.evaluate(short)).toEqual([]);
  });
}

// A finger is the coarse pointer: there the row ••• answers over `size-hit-min` in every density, though it's drawn at
// 32px outside `touch`.
for (const density of ['regular', 'compact'] as const) {
  test(`With a coarse pointer in ${density}, the row ••• answers over 44×44px`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'A phone has the coarse pointer.');
    await open(page, '/app/inbox', density);
    const more = page.locator('.ld-row-more').first();
    expect((await more.boundingBox())!.width).toBeLessThan(44);
    expect(await more.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
      return [[cx - 21.5, cy], [cx + 21.5, cy], [cx, cy - 21.5], [cx, cy + 21.5]].every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
    })).toBe(true);
  });
}
