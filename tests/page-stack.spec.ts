import { expect, test } from '@playwright/test';

// Page and Stack on the Blocks page: one gap between children whatever margins they bring, and a gutter around a
// widest width.
const px = (v: string) => parseFloat(v);

test('Stack and Page space their children by the gap alone, and Page keeps the narrow width inside its gutter', async ({ page }) => {
  await page.goto('/blocks');
  const box = page.getByRole('region', { name: 'A narrow page' });
  const tokens = await box.evaluate((el) => {
    const s = getComputedStyle(el);
    return { lg: s.getPropertyValue('--space-6'), sm: s.getPropertyValue('--space-2'), narrow: s.getPropertyValue('--layout-flow-narrow-max-width') };
  });
  const gap = async (a: string, b: string) => {
    const [top, bottom] = await Promise.all([box.locator(a).first().boundingBox(), box.locator(b).first().boundingBox()]);
    return bottom!.y - (top!.y + top!.height);
  };
  // PageHeader brings a bottom margin, and the list a top one: the gaps replace both.
  expect(await gap('.ld-page-header', '.ld-stack')).toBeCloseTo(px(tokens.lg), 0);
  expect(await gap('.ld-stack > p', '.ld-stack > .ld-list')).toBeCloseTo(px(tokens.sm), 0);
  // A PageHeader's own bottom margin is larger than the small gap, and gives way to it too.
  await box.evaluate((el) => {
    const header = el.querySelector('.ld-page-header')!.cloneNode(true) as HTMLElement;
    header.querySelector('h3')!.removeAttribute('id');
    el.querySelector('.ld-stack')!.prepend(header);
  });
  expect(await gap('.ld-stack > .ld-page-header', '.ld-stack > p')).toBeCloseTo(px(tokens.sm), 0);
  const content = await box.evaluate((el) => {
    const s = getComputedStyle(el);
    return el.getBoundingClientRect().width - px(s.paddingLeft) - px(s.paddingRight);
    function px(v: string) { return parseFloat(v); }
  });
  expect(content).toBeLessThanOrEqual(px(tokens.narrow) + 0.5);
  expect(await box.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThan(0);
});
