// A row's ••• menu: it opens on a touch tap (a plain list, and the data table's cards on a phone), it is shown wherever
// a finger can be used, and a swipe still starts on the row itself.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main')).toBeVisible();
}

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'The phone project.');

  test('tapping a list row\'s ••• opens its menu', async ({ page }) => {
    await open(page, '/components');
    await page.getByRole('button', { name: 'More actions for Q4 budget needs your approval' }).tap();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
  });

  test('tapping a data table card\'s ••• opens its menu', async ({ page }) => {
    await open(page, '/app/work');
    const more = page.getByRole('button', { name: /^More actions for/ }).first();
    await expect(more).toBeVisible();
    await more.tap();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem').first()).toBeVisible();
  });

  // The menu is portaled, but React events from it bubble to the row: a press in the menu must not start a swipe.
  const tapAt = async (page: Page, target: ReturnType<Page['locator']>) => {
    const box = (await target.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  const openFirstMenu = async (page: Page) => {
    await open(page, '/app/inbox');
    await page.getByRole('button', { name: 'More actions for Q4 budget needs your approval' }).tap();
    await expect(page.getByRole('menu')).toBeVisible();
  };

  test('tapping a menu item on a swipeable row runs the action and closes the menu', async ({ page }) => {
    await openFirstMenu(page);
    await tapAt(page, page.getByRole('menuitem', { name: 'Archive' }));
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Q4 budget needs your approval/ })).toHaveCount(0);
  });

  test('tapping outside the menu closes it', async ({ page }) => {
    await openFirstMenu(page);
    await tapAt(page, page.getByRole('heading', { level: 1 }));
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page).toHaveURL(/\/app\/inbox$/);
  });

  test('tapping another row while the menu is open closes the menu', async ({ page }) => {
    await openFirstMenu(page);
    await tapAt(page, page.getByRole('link', { name: /Launch date/ }));
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('on a touch screen the ••• is shown without hover: it is the visible twin of the swipe', async ({ page }) => {
    await open(page, '/components');
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    await expect(page.getByRole('button', { name: 'More actions for Q4 budget needs your approval' })).toHaveCSS('opacity', '1');
  });

  test('a swipe still starts on the row itself', async ({ page }) => {
    await open(page, '/components');
    const row = page.locator('.ld-row-wrap').filter({ hasText: 'Q4 budget needs your approval' });
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    // A touch drag from the middle of the row, leftwards, past half the actions' width.
    const cdp = await page.context().newCDPSession(page);
    const at = (x: number) => [{ x, y }];
    const x0 = box.x + box.width * 0.5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(x0) });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(x0 - i * 20) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(row).toHaveClass(/ld-row-open/);
  });

  test('at double text, a swipe reveals every action label whole, and the row slides by the actions\' width', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/app/inbox');
    const row = page.locator('.ld-row-wrap').filter({ hasText: 'Launch date' });
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    const at = (x: number) => [{ x, y }];
    const x0 = box.x + box.width * 0.9;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(x0) });
    for (let i = 1; i <= 15; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(x0 - i * 20) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(row).toHaveClass(/ld-row-open/);
    // The row settles from the drag's overshoot to the actions' width.
    await expect.poll(() => row.evaluate((li) =>
      Math.abs(new DOMMatrix(getComputedStyle(li.querySelector('.ld-row')!).transform).m41 + li.querySelector('.ld-row-actions')!.getBoundingClientRect().width),
    )).toBeLessThanOrEqual(1);
    const labels = await row.evaluate((li) => {
      const wrap = li.getBoundingClientRect();
      return [...li.querySelectorAll('.ld-row-action')].map((a) => {
        const range = document.createRange();
        range.selectNodeContents(a);
        const text = range.getBoundingClientRect(), b = a.getBoundingClientRect();
        return { label: a.textContent, inside: text.left >= Math.max(b.left, wrap.left) - 0.5 && text.right <= Math.min(b.right, wrap.right) + 0.5 };
      });
    });
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l, l.label ?? '').toMatchObject({ inside: true });
  });
});

test.describe('keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'The table layout: desktop.');

  test('a table row\'s menu opens with Enter and closes with Escape, back to its •••', async ({ page }) => {
    await open(page, '/blocks/data-table');
    const more = page.getByRole('table', { name: 'Work items (client mode)' }).getByRole('button', { name: /^More actions for/ }).first();
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(more).toBeFocused();
  });
});

// Revealed swipe actions stay inside a narrow row, each label inside its action on all four sides, at the default and at
// double the text size. At double size three actions are wider than a 288px row, so their labels keep their default
// size; two still fit and grow. Where even the default size doesn't fit, across or down, the row doesn't open and the
// ••• menu is the way to the actions.
test.describe('revealed actions in a narrow row', () => {
  const placed = (page: Page, name: string) => page.getByRole('region', { name }).locator('.ld-row-wrap').evaluate((li) => {
    const wrap = li.getBoundingClientRect();
    const panel = li.querySelector<HTMLElement>('.ld-row-actions')!;
    const within = (inner: DOMRect, outer: DOMRect) =>
      inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
    const actions = [...panel.querySelectorAll('.ld-row-action')].map((a) => {
      const range = document.createRange();
      range.selectNodeContents(a);
      const b = a.getBoundingClientRect();
      return { label: a.textContent, width: Math.round(b.width), size: parseFloat(getComputedStyle(a).fontSize), inside: within(b, wrap) && within(range.getBoundingClientRect(), b) };
    });
    const slide = new DOMMatrix(getComputedStyle(li.querySelector('.ld-row')!).transform).m41;
    const width = panel.getBoundingClientRect().width;
    return {
      actions, fit: panel.dataset.fit ?? null, slide, offset: Math.abs(slide + width), withinRow: width <= wrap.width + 0.5,
      shown: getComputedStyle(panel).display !== 'none',
    };
  });
  const check = async (page: Page, name: string, [fit, size]: [string | null, number]) => {
    if (fit === 'menu') {
      await expect.poll(async () => (await placed(page, name)).fit, name).toBe('menu');
      expect(await placed(page, name), name).toMatchObject({ shown: false, slide: 0 });
      await expect(page.getByRole('region', { name }).getByRole('button', { name: /More/ })).toBeAttached();
      return;
    }
    await expect.poll(async () => { const p = await placed(page, name); return p.fit === fit && p.offset <= 1; }, name).toBe(true);
    const { actions, withinRow } = await placed(page, name);
    expect(withinRow, name).toBe(true);
    for (const a of actions) expect(a, `${name}: ${a.label}`).toMatchObject({ inside: true, size });
    // At least the 76px minimum; wider where a font's longest word needs it ("Archive" is 80px in CI's font).
    for (const a of actions) expect(a.width, `${name}: ${a.label}`).toBeGreaterThanOrEqual(76);
  };
  const expected: Record<string, [string | null, number][]> = {
    // [fit, label size] at 100% and at 200%
    'Three actions, 288px': [[null, 15], ['tight', 15]],
    'Two actions, 288px': [[null, 15], [null, 30]],
    'Three actions, 200px': [['menu', 0], ['menu', 0]],
    'A long label, 200px': [['menu', 0], ['menu', 0]],
  };

  for (const [i, scale] of [1, 2].entries()) {
    test(`at ${scale * 100}% text, revealed actions fit a narrow row with every label inside its action, or the row stays closed`, async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 * scale, fixed: 13 * scale } });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, '/fixtures/list-row');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${16 * scale}px`);
      for (const [name, fits] of Object.entries(expected)) await check(page, name, fits[i]);
    });
  }

  test('at double text, a longer label in a row that keeps its width re-fits the actions', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/fixtures/list-row');
    // At double text A, B and C are 76px each, filling the 228px row. "Move" needs more at full size and 76px at the
    // default size, in any font.
    const name = 'A label lengthens, 228px';
    await check(page, name, [null, 30]);
    await page.getByRole('region', { name }).getByRole('button', { name: 'Lengthen the first action' }).click();
    await expect(page.getByRole('region', { name }).locator('.ld-row-action').first()).toHaveText('Move');
    await check(page, name, ['tight', 15]);
  });

  // A row whose actions stop fitting closes, as a tap away would: it stays closed when they fit again, and a controlled
  // row's parent hears about it.
  const row = (page: Page, title: string) => page.getByRole('region', { name: 'Opened, then narrowed' }).locator('.ld-row-wrap').filter({ hasText: title });
  const slide = (page: Page, title: string) => row(page, title).evaluate((li) => new DOMMatrix(getComputedStyle(li.querySelector('.ld-row')!).transform).m41);
  const fit = (page: Page, title: string) => row(page, title).evaluate((li) => li.querySelector<HTMLElement>('.ld-row-actions')!.dataset.fit ?? null);

  test('a controlled row closes when its actions stop fitting, and stays closed when they fit again', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/fixtures/list-row');
    const region = page.getByRole('region', { name: 'Opened, then narrowed' });
    await expect(row(page, 'Parent-controlled')).toHaveClass(/ld-row-open/);
    await expect(region.getByText('Changes: none')).toBeVisible();
    await region.getByRole('button', { name: 'Narrow the rows' }).click();
    await expect.poll(() => fit(page, 'Parent-controlled')).toBe('menu');
    await expect(region.getByText('Changes: closed')).toBeVisible();
    await region.getByRole('button', { name: 'Restore the width' }).click();
    await expect.poll(() => fit(page, 'Parent-controlled')).toBeNull();
    await expect(row(page, 'Parent-controlled')).not.toHaveClass(/ld-row-open/);
    expect(await slide(page, 'Parent-controlled')).toBe(0);
    await expect(region.getByText('Changes: closed')).toBeVisible();
  });

  test('a swiped-open row closes when its actions stop fitting, and stays closed when they fit again', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The swipe is touch only.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/fixtures/list-row');
    const region = page.getByRole('region', { name: 'Opened, then narrowed' });
    const li = row(page, 'Swiped open');
    await li.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = (await li.boundingBox())!;
    const y = box.y + box.height / 2, x0 = box.x + box.width * 0.9;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 20, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(li).toHaveClass(/ld-row-open/);
    await region.getByRole('button', { name: 'Narrow the rows' }).click();
    await expect.poll(() => fit(page, 'Swiped open')).toBe('menu');
    await region.getByRole('button', { name: 'Restore the width' }).click();
    await expect.poll(() => fit(page, 'Swiped open')).toBeNull();
    await expect(li).not.toHaveClass(/ld-row-open/);
    expect(await slide(page, 'Swiped open')).toBe(0);
  });
});
