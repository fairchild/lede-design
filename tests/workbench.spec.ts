import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { renderToString } from 'react-dom/server';
import { HYDRATE_KEY, hydrateSample, type HydrateWindow } from '../src/pages/fixtures/WorkbenchHydrate';

const ROUTE = '/layouts/workbench';
const KEY = 'lede:workbench';
const MIN_MAIN = 400;
type Panel = 'Files' | 'Assistant';

const landmark = (page: Page, panel: Panel) =>
  page.getByRole(panel === 'Files' ? 'navigation' : 'complementary', { name: panel });
const toggle = (page: Page, panel: Panel) => page.getByRole('button', { name: `${panel} panel` });
const splitter = (page: Page, panel: Panel) => page.getByRole('separator', { name: `Resize ${panel}` });
const editor = (page: Page) => page.getByRole('region', { name: 'Editor' });
const value = async (el: Locator, attr = 'aria-valuenow') => Number(await el.getAttribute(attr));
const box = async (el: Locator) => (await el.boundingBox())!;
const width = async (el: Locator) => (await box(el)).width;
const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function drag(page: Page, from: Locator, dx: number) {
  const start = centre(await box(from));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx / 2, start.y, { steps: 3 });
  await page.mouse.move(start.x + dx, start.y, { steps: 3 });
  await page.mouse.up();
}

async function focusedPanelIs(page: Page, label: string) {
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)).toBe(label);
}

test.describe('wide', () => {
  test.skip(({ isMobile }) => isMobile, 'Three columns need a wide window; the narrow tests cover phones.');
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('three columns fill the window under the top bar, and the page itself does not scroll', async ({ page }) => {
    const bar = await box(page.getByRole('banner'));
    const nav = await box(landmark(page, 'Files'));
    const main = await box(page.getByRole('main'));
    const aside = await box(landmark(page, 'Assistant'));
    for (const column of [nav, main, aside]) {
      expect(column.y).toBeCloseTo(bar.y + bar.height, 0);
      expect(column.y + column.height).toBeCloseTo(900, 0);
    }
    expect(nav.x).toBe(0);
    expect(main.x).toBeCloseTo(nav.width, 0);
    expect(aside.x + aside.width).toBeCloseTo(1440, 0);
    const page_ = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, ih: document.documentElement.clientHeight, iw: document.documentElement.clientWidth }));
    expect(page_.h).toBe(page_.ih);
    expect(page_.w).toBe(page_.iw);
  });

  test('exactly one h1, in the top bar, and every region named', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText('retry.ts');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(landmark(page, 'Files')).toHaveCount(1);
    await expect(landmark(page, 'Assistant')).toHaveCount(1);
    await expect(page.locator('main#main')).toBeVisible();
  });

  test('each panel scrolls on its own', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 280 });
    const scrollers = [landmark(page, 'Files'), editor(page), landmark(page, 'Assistant')];
    for (const scroller of scrollers) {
      expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(20);
      await scroller.evaluate((el) => { el.scrollTop = 20; });
      const tops = await Promise.all(scrollers.map((s) => s.evaluate((el) => el.scrollTop)));
      expect(tops.filter((top) => top > 0)).toHaveLength(1);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await scroller.evaluate((el) => { el.scrollTop = 0; });
    }
  });

  test('a toggle collapses its panel out of the tab order and the accessibility tree, then restores it', async ({ page }) => {
    for (const panel of ['Files', 'Assistant'] as const) {
      const button = toggle(page, panel);
      const before = await width(landmark(page, panel));
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(button).toHaveAttribute('aria-controls', (await landmark(page, panel).getAttribute('id'))!);
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(landmark(page, panel)).toHaveCount(0);
      const hidden = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
      await expect(hidden).toBeHidden();
      expect(await hidden.evaluate((el) => el.querySelectorAll('a, button, input').length)).toBeGreaterThan(0);
      await expect(button).toBeFocused();
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(await width(landmark(page, panel))).toBe(before);
    }
  });

  test('on first load the next Tab from the h1 is the skip link, drawn in view', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Enter');
    await focusedPanelIs(page, 'Editor');
  });

  test('Tab follows the visual order: top bar, left panel, its divider, main, its divider, right panel', async ({ page }) => {
    await toggle(page, 'Files').focus();
    const stops: string[] = [];
    for (;;) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement!;
        if (el === document.body) return null;
        if (el.closest('header')) return 'top bar';
        if (el.closest('nav')) return 'left panel';
        if (el.getAttribute('role') === 'separator') return el.getAttribute('aria-label');
        return el.closest('aside') ? 'right panel' : 'main';
      });
      if (!stop) break;
      if (stop !== stops.at(-1)) stops.push(stop);
    }
    expect(stops).toEqual(['top bar', 'left panel', 'Resize Files', 'main', 'Resize Assistant', 'right panel']);
  });

  test('the skip link lands in the content, past the left divider', async ({ page }) => {
    await page.locator('.ld-skip').focus();
    await page.keyboard.press('Enter');
    await focusedPanelIs(page, 'Editor');
    await page.keyboard.press('Tab');
    await expect(splitter(page, 'Assistant')).toBeFocused();
  });

  test('tabbing past a collapsed panel never lands inside it', async ({ page }) => {
    await toggle(page, 'Files').click();
    await toggle(page, 'Assistant').click();
    const stops: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      stops.push(await page.evaluate(() => document.activeElement?.closest('nav, aside')?.tagName ?? ''));
    }
    expect(stops.filter(Boolean)).toEqual([]);
  });

  test('arrow keys step the divider the way the arrow points, and the separator reports the width', async ({ page }) => {
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    await expect(left).toHaveAttribute('aria-orientation', 'vertical');
    await expect(left).toHaveAttribute('aria-controls', (await landmark(page, 'Files').getAttribute('id'))!);
    await expect(right).toHaveAttribute('aria-controls', (await landmark(page, 'Assistant').getAttribute('id'))!);
    const leftStart = await value(left);
    expect(await width(landmark(page, 'Files'))).toBe(leftStart);
    await left.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => value(left)).toBeGreaterThan(leftStart);
    const stepped = await value(left);
    expect(await width(landmark(page, 'Files'))).toBe(stepped);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => value(left)).toBe(leftStart + (stepped - leftStart) / 2);

    const rightStart = await value(right);
    expect(await width(landmark(page, 'Assistant'))).toBe(rightStart);
    await right.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => value(right)).toBeGreaterThan(rightStart);
    expect(await width(landmark(page, 'Assistant'))).toBe(await value(right));
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => value(right)).toBe(rightStart);
  });

  test('Home and End go to the limits and stop there', async ({ page }) => {
    const left = splitter(page, 'Files');
    await left.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => value(left)).toBe(await value(left, 'aria-valuemin'));
    expect(await width(landmark(page, 'Files'))).toBe(await value(left, 'aria-valuemin'));
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => value(left)).toBe(await value(left, 'aria-valuemin'));
    await page.keyboard.press('End');
    await expect.poll(() => value(left)).toBe(await value(left, 'aria-valuemax'));
    expect(await width(landmark(page, 'Files'))).toBe(await value(left, 'aria-valuemax'));
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => value(left)).toBe(await value(left, 'aria-valuemax'));
  });

  test('Enter collapses and restores, and focus stays on the divider', async ({ page }) => {
    const left = splitter(page, 'Files');
    const start = await value(left);
    await left.focus();
    await page.keyboard.press('Enter');
    await expect(landmark(page, 'Files')).toHaveCount(0);
    await expect(toggle(page, 'Files')).toHaveAttribute('aria-expanded', 'false');
    await expect(left).toBeFocused();
    expect(await value(left)).toBe(0);
    expect(await value(left, 'aria-valuemin')).toBe(0);
    await expect(left).toHaveAttribute('aria-valuetext', /collapsed/i);
    await page.keyboard.press('Enter');
    await expect(landmark(page, 'Files')).toBeVisible();
    await expect(left).toBeFocused();
    expect(await value(left)).toBe(start);
    expect(await value(left, 'aria-valuemin')).toBe(200);
  });

  test('an arrow key away from the edge reopens a collapsed panel, and one toward the edge does nothing', async ({ page }) => {
    const right = splitter(page, 'Assistant');
    const start = await value(right);
    await right.focus();
    await page.keyboard.press('Enter');
    await expect(landmark(page, 'Assistant')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(landmark(page, 'Assistant')).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    await expect(landmark(page, 'Assistant')).toBeVisible();
    expect(await value(right)).toBe(start);
  });

  test('dragging a divider resizes its panel and main takes up the difference', async ({ page }) => {
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    const [leftStart, rightStart, mainStart] = [await value(left), await value(right), await width(page.getByRole('main'))];
    await drag(page, left, 60);
    await expect.poll(() => value(left)).toBe(leftStart + 60);
    expect(await width(landmark(page, 'Files'))).toBe(leftStart + 60);
    await drag(page, right, -40);
    await expect.poll(() => value(right)).toBe(rightStart + 40);
    expect(await width(landmark(page, 'Assistant'))).toBe(rightStart + 40);
    expect(await width(page.getByRole('main'))).toBe(mainStart - 100);
  });

  test('a drag stops at the limits, and main keeps its minimum width', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    await drag(page, left, -400);
    await expect.poll(() => value(left)).toBe(await value(left, 'aria-valuemin'));
    expect(await width(landmark(page, 'Files'))).toBe(await value(left, 'aria-valuemin'));
    await drag(page, left, 900);
    await expect.poll(() => value(left)).toBe(1100 - MIN_MAIN - 320);
    expect(await value(right)).toBe(320);
    await drag(page, right, -900);
    expect(await value(right)).toBe(320);
    expect(await width(page.getByRole('main'))).toBe(MIN_MAIN);
    expect(await width(editor(page))).toBeGreaterThan(300);
    expect(await value(left)).toBe(await width(landmark(page, 'Files')));
    expect(await value(right)).toBe(await width(landmark(page, 'Assistant')));
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scroll).toBe(1100);
  });

  test('a window that shrinks takes the room from the panels, not from main', async ({ page }) => {
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    await left.focus();
    await page.keyboard.press('End');
    await right.focus();
    await page.keyboard.press('End');
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect.poll(() => width(page.getByRole('main'))).toBeGreaterThanOrEqual(MIN_MAIN);
    await expect.poll(() => value(left)).toBe(await width(landmark(page, 'Files')));
    expect(await value(right)).toBe(await width(landmark(page, 'Assistant')));
    expect(await value(left)).toBeLessThanOrEqual(await value(left, 'aria-valuemax'));
  });

  test('in a window that has squeezed the panels, each divider moves the way it is pushed', async ({ page }) => {
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    await left.focus();
    await page.keyboard.press('End');
    await right.focus();
    await page.keyboard.press('End');
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect.poll(() => value(left)).toBe(350);
    expect(await value(right)).toBe(350);

    await left.focus();
    await page.keyboard.press('ArrowRight');
    expect(await value(left)).toBe(350);
    expect(await value(right)).toBe(350);
    await page.keyboard.press('ArrowLeft');
    expect(await value(left)).toBe(334);
    expect(await value(right)).toBe(350);
    await page.keyboard.press('ArrowRight');
    expect(await value(left)).toBe(350);
    expect(await value(right)).toBe(350);

    await drag(page, right, 40);
    await expect.poll(() => value(right)).toBe(310);
    expect(await value(left)).toBe(350);
    await drag(page, left, 30);
    await expect.poll(() => value(left)).toBe(380);
    expect(await value(right)).toBe(310);
    expect(await width(page.getByRole('main'))).toBe(410);
  });

  test('two resizes in one task both land', async ({ page }) => {
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    const [startLeft, startRight] = [await value(left), await value(right)];
    await page.evaluate(() => {
      const press = (label: string, key: string) =>
        document.querySelector(`[aria-label="${label}"]`)!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      press('Resize Files', 'ArrowRight');
      press('Resize Assistant', 'ArrowLeft');
    });
    await expect.poll(() => value(left)).toBe(startLeft + 16);
    expect(await value(right)).toBe(startRight + 16);
  });

  test('a step in a squeezed window keeps the widths asked for, not the squeezed ones', async ({ page }) => {
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    await left.focus();
    await page.keyboard.press('End');
    await right.focus();
    await page.keyboard.press('End');
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect.poll(() => value(left)).toBe(350);
    await left.focus();
    await page.keyboard.press('ArrowLeft');
    expect(await value(left)).toBe(334);
    expect(await value(right)).toBe(350);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => value(left)).toBe(464);
    expect(await value(right)).toBe(480);
    await page.reload();
    await expect(left).toBeVisible();
    await expect.poll(() => value(left)).toBe(464);
    expect(await value(right)).toBe(480);
  });

  test('saved widths opened in a smaller window squeeze to fit, and the other panel holds still', async ({ page }) => {
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ start: { width: 480, collapsed: false }, end: { width: 480, collapsed: false } })), KEY);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.reload();
    const left = splitter(page, 'Files');
    const right = splitter(page, 'Assistant');
    await expect(left).toBeVisible();
    await expect.poll(() => value(left)).toBe(350);
    expect(await value(right)).toBe(350);
    await left.focus();
    await page.keyboard.press('Home');
    expect(await value(left)).toBe(200);
    expect(await value(right)).toBe(350);
    await page.keyboard.press('End');
    expect(await value(left)).toBe(350);
    expect(await value(right)).toBe(350);
  });

  test('high-contrast themes turn the top bar and panel hairlines into full lines', async ({ page }) => {
    // At 1x a browser draws 0.5px as 1px, so the two only differ where a pixel is smaller. Zoom makes it so.
    const lines = async () => {
      await page.addStyleTag({ content: 'html { zoom: 2; }' });
      await expect(editor(page)).toBeVisible();
      return page.evaluate(() => {
        const bar = getComputedStyle(document.querySelector('.ld-wb-bar')!);
        const main = getComputedStyle(document.querySelector('.ld-wb-content')!);
        return [bar.borderBottomWidth, main.borderLeftWidth, main.borderRightWidth];
      });
    };
    expect(await lines()).toEqual(['0.5px', '0.5px', '0.5px']);
    await page.addInitScript(() => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: true })));
    await page.reload();
    expect(await lines()).toEqual(['1px', '1px', '1px']);
  });

  test('dragging a collapsed divider away from the edge reopens the panel', async ({ page }) => {
    const left = splitter(page, 'Files');
    await toggle(page, 'Files').click();
    await expect(landmark(page, 'Files')).toHaveCount(0);
    await drag(page, left, 20);
    await expect(landmark(page, 'Files')).toHaveCount(0);
    await drag(page, left, 300);
    await expect(landmark(page, 'Files')).toBeVisible();
    expect(await value(left)).toBe(300);
  });

  test('the whole hit area belongs to the divider, and it stops at the divider', async ({ page }) => {
    for (const panel of ['Files', 'Assistant'] as const) {
      const sep = splitter(page, panel);
      const b = await box(sep);
      expect(b.width).toBe(28);
      const label = await sep.getAttribute('aria-label');
      const hit = (x: number, y: number) => page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.getAttribute('aria-label') ?? null, [x, y]);
      for (const y of [b.y + 1, b.y + b.height / 2, b.y + b.height - 1]) {
        for (const x of [b.x + 0.5, b.x + b.width / 2, b.x + b.width - 0.5]) expect(await hit(x, y)).toBe(label);
        expect(await hit(b.x - 1, y)).not.toBe(label);
        expect(await hit(b.x + b.width + 1, y)).not.toBe(label);
      }
    }
  });

  test('compact density takes the hit area down to the smallest control, 24px', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lede:appearance', JSON.stringify({ compact: true })));
    await page.reload();
    await expect(splitter(page, 'Files')).toBeVisible();
    expect(await width(splitter(page, 'Files'))).toBe(24);
  });

  test('a collapsed divider keeps its hit area at the window edge', async ({ page }) => {
    await toggle(page, 'Files').click();
    const sep = splitter(page, 'Files');
    const b = await box(sep);
    expect(b.x).toBe(0);
    expect(b.width).toBe(28);
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute('role'), [b.x + 1, b.y + 20])).toBe('separator');
  });

  test('widths and collapsed state survive a reload', async ({ page }) => {
    const left = splitter(page, 'Files');
    await drag(page, left, 48);
    await expect.poll(() => value(left)).toBeGreaterThan(240);
    const resized = await value(left);
    await toggle(page, 'Assistant').click();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await value(left)).toBe(resized);
    await expect(toggle(page, 'Assistant')).toHaveAttribute('aria-expanded', 'false');
    await expect(landmark(page, 'Assistant')).toHaveCount(0);
    expect(await width(landmark(page, 'Files'))).toBe(resized);
  });

  test('nothing is saved until the layout changes, and a drag saves when it ends', async ({ page }) => {
    const saved = () => page.evaluate((key) => localStorage.getItem(key), KEY);
    expect(await saved()).toBeNull();
    const left = splitter(page, 'Files');
    const start = centre(await box(left));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y, { steps: 4 });
    expect(await saved()).toBeNull();
    await page.mouse.up();
    await expect.poll(saved).not.toBeNull();
  });

  for (const [name, stored] of [['unreadable JSON', '{oops'], ['nonsense values', '{"start":{"width":"wide","collapsed":"yes"},"end":{"width":-5}}']] as const) {
    test(`stored ${name} falls back to the defaults`, async ({ page }) => {
      const start = await value(splitter(page, 'Files'));
      await page.evaluate(([key, text]) => localStorage.setItem(key, text), [KEY, stored]);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(landmark(page, 'Files')).toBeVisible();
      await expect(landmark(page, 'Assistant')).toBeVisible();
      expect(await value(splitter(page, 'Files'))).toBe(start);
      expect(await value(splitter(page, 'Assistant'))).toBeGreaterThanOrEqual(await value(splitter(page, 'Assistant'), 'aria-valuemin'));
    });
  }

  test('a stored width outside the limits is drawn inside them', async ({ page }) => {
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ start: { width: 99999, collapsed: false }, end: { width: 1, collapsed: false } })), KEY);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await value(splitter(page, 'Files'))).toBe(await value(splitter(page, 'Files'), 'aria-valuemax'));
    expect(await value(splitter(page, 'Assistant'))).toBe(await value(splitter(page, 'Assistant'), 'aria-valuemin'));
    expect(await width(page.getByRole('main'))).toBeGreaterThanOrEqual(MIN_MAIN);
  });

  test('it works with storage unavailable', async ({ page }) => {
    await page.addInitScript((key) => {
      const { getItem, setItem } = Storage.prototype;
      const refuse = (name: string) => { if (name === key) throw new DOMException('Blocked', 'SecurityError'); };
      Storage.prototype.getItem = function get(this: Storage, name) { refuse(name); return getItem.call(this, name); };
      Storage.prototype.setItem = function set(this: Storage, name, item) { refuse(name); setItem.call(this, name, item); };
    }, KEY);
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const left = splitter(page, 'Files');
    const start = await value(left);
    await left.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => value(left)).toBeGreaterThan(start);
    await toggle(page, 'Assistant').click();
    await expect(landmark(page, 'Assistant')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a preview frame keeps nothing, so a full page opened later starts from its own state', async ({ page }) => {
    await page.goto('/layouts');
    const frame = page.frameLocator('iframe[title^="Three panels"]');
    await page.locator('iframe[title^="Three panels"]').scrollIntoViewIfNeeded();
    await frame.getByRole('button', { name: 'Files panel' }).click();
    await expect(frame.getByRole('button', { name: 'Files panel' })).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
  });

  test('stays clean under axe with a panel collapsed', async ({ page }) => {
    await toggle(page, 'Files').click();
    await toggle(page, 'Assistant').click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('the forced-colours dividers and panel edges stay visible', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const grip = await splitter(page, 'Files').evaluate((el) => {
      const style = getComputedStyle(el, '::after');
      return { background: style.backgroundColor, canvas: getComputedStyle(document.body).backgroundColor };
    });
    expect(grip.background).not.toBe(grip.canvas);
    const edge = await editor(page).evaluate((el) => { const style = getComputedStyle(el); return { style: style.borderLeftStyle, width: parseFloat(style.borderLeftWidth) }; });
    expect(edge.style).toBe('solid');
    expect(edge.width).toBeGreaterThan(0);
  });
});

test('with storageKey, server-rendered markup hydrates and then takes the stored layout', async ({ page, isMobile }) => {
  test.skip(isMobile, 'One project is enough: the layout under test is the wide one.');
  const stored = JSON.stringify({ start: { width: 300, collapsed: true }, end: { width: 360, collapsed: false } });
  await page.addInitScript(([key, value_]) => localStorage.setItem(key, value_), [HYDRATE_KEY, stored]);
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/fixtures/workbench-hydrate');
  await page.waitForFunction(() => !!(window as HydrateWindow).hydrateSample);
  const markup = renderToString(hydrateSample);
  expect(markup).toContain('aria-expanded="true"');
  await page.evaluate((html) => (window as HydrateWindow).hydrateSample!(html), markup);

  await expect(toggle(page, 'Files')).toHaveAttribute('aria-expanded', 'false');
  await expect(landmark(page, 'Files')).toHaveCount(0);
  await expect.poll(() => width(landmark(page, 'Assistant'))).toBe(360);
  expect(await page.evaluate((key) => localStorage.getItem(key), HYDRATE_KEY)).toBe(stored);
  await toggle(page, 'Files').click();
  await expect(toggle(page, 'Files')).toHaveAttribute('aria-expanded', 'true');
  expect(await width(landmark(page, 'Files'))).toBe(300);
  expect(problems).toEqual([]);
});

async function coarseContext(browser: Browser, baseURL: string | undefined) {
  return browser.newContext({ baseURL, hasTouch: true, viewport: { width: 1280, height: 800 } });
}

test.describe('a wide touch screen', () => {
  test.skip(({ isMobile }) => isMobile, 'One project is enough; this builds its own touch context.');

  test('dividers grow to the full touch target and a finger can drag them', async ({ browser, baseURL }) => {
    const context = await coarseContext(browser, baseURL);
    const page = await context.newPage();
    await page.goto(ROUTE);
    const left = splitter(page, 'Files');
    await expect(left).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
    expect(await width(left)).toBe(44);
    const start = await value(left);
    const from = centre(await box(left));
    const cdp = await context.newCDPSession(page);
    const touch = (type: string, x: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: from.y }] } as never);
    await touch('touchStart', from.x);
    for (const dx of [10, 25, 40, 50]) await touch('touchMove', from.x + dx);
    await touch('touchEnd', from.x + 50);
    await expect.poll(() => value(left)).toBe(start + 50);
    await context.close();
  });
});

test.describe('a wide touch screen, two fingers', () => {
  test.skip(({ isMobile }) => isMobile, 'One project is enough; this builds its own touch context.');

  test('a second finger on a divider neither moves the drag nor ends it', async ({ browser, baseURL }) => {
    const context = await coarseContext(browser, baseURL);
    const page = await context.newPage();
    await page.goto(ROUTE);
    const left = splitter(page, 'Files');
    await expect(left).toBeVisible();
    const start = await value(left);
    const b = await box(left);
    const y = b.y + b.height / 2;
    const [near, far] = [b.x + 8, b.x + b.width - 8];
    const cdp = await context.newCDPSession(page);
    const touch = (type: string, touchPoints: Array<{ x: number; y: number; id: number }>) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints } as never);
    await touch('touchStart', [{ x: near, y, id: 1 }]);
    await touch('touchMove', [{ x: near + 10, y, id: 1 }]);
    await expect.poll(() => value(left)).toBe(start + 10);
    await touch('touchStart', [{ x: near + 10, y, id: 1 }, { x: far, y, id: 2 }]);
    await touch('touchMove', [{ x: near + 20, y, id: 1 }, { x: far, y, id: 2 }]);
    await expect.poll(() => value(left)).toBe(start + 20);
    await touch('touchMove', [{ x: near + 20, y, id: 1 }, { x: far + 30, y, id: 2 }]);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect(await value(left)).toBe(start + 20);
    // touchEnd lifts the points it lists: here the second finger, while the first stays down.
    await touch('touchEnd', [{ x: far, y, id: 2 }]);
    await touch('touchMove', [{ x: near + 60, y, id: 1 }]);
    await expect.poll(() => value(left)).toBe(start + 60);
    await touch('touchEnd', []);
    await context.close();
  });
});

test.describe('narrow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
  const switcher = (page: Page) => page.getByRole('group', { name: 'Panel' });
  const option = (page: Page, name: string) => switcher(page).getByRole('radio', { name });

  test('one panel at a time, chosen with a visible switcher', async ({ page }) => {
    await expect(switcher(page)).toBeVisible();
    await expect(option(page, 'Editor')).toBeChecked();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(landmark(page, 'Files')).toHaveCount(0);
    await expect(landmark(page, 'Assistant')).toHaveCount(0);
    for (const [name, shown] of [['Files', landmark(page, 'Files')], ['Assistant', landmark(page, 'Assistant')]] as const) {
      await option(page, name).check();
      await expect(shown).toBeVisible();
      await expect(editor(page)).toHaveCount(0);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      expect((await box(shown)).width).toBe(390);
    }
    await option(page, 'Editor').check();
    await expect(editor(page)).toBeVisible();
  });

  test('hidden panels are display:none, and toggles and dividers leave', async ({ page }) => {
    await expect(page.getByRole('separator')).toHaveCount(0);
    await expect(toggle(page, 'Files')).toBeHidden();
    await expect(toggle(page, 'Assistant')).toBeHidden();
    const display = await page.locator('nav.ld-wb-panel').evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('a panel collapsed on a wide screen can still be chosen on a narrow one', async ({ page, isMobile }) => {
    test.skip(isMobile, 'A phone never reaches the wide state.');
    await page.setViewportSize({ width: 1280, height: 800 });
    await toggle(page, 'Files').click();
    await page.setViewportSize({ width: 390, height: 800 });
    await option(page, 'Files').check();
    await expect(landmark(page, 'Files')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(landmark(page, 'Files')).toHaveCount(0);
  });

  test('at 320 wide every panel fits, with no sideways scrolling of the page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const name of ['Files', 'Assistant', 'Editor']) {
      await option(page, name).check();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      for (const radio of await switcher(page).locator('label').all()) {
        const b = await box(radio);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(320);
      }
      await expect(page.getByRole('button', { name: 'Run checks' })).toBeVisible();
      const action = await box(page.getByRole('button', { name: 'Run checks' }));
      expect(action.x + action.width).toBeLessThanOrEqual(320);
    }
  });

  test('switching with the keyboard keeps focus on the switcher, and Tab goes on into the panel', async ({ page }) => {
    await option(page, 'Editor').focus();
    await page.keyboard.press('ArrowRight');
    await expect(option(page, 'Assistant')).toBeChecked();
    await expect(option(page, 'Assistant')).toBeFocused();
    await expect(landmark(page, 'Assistant')).toBeVisible();
    await page.keyboard.press('Tab');
    await focusedPanelIs(page, 'Assistant');
  });

  test('choosing a file shows the editor and takes focus there', async ({ page }) => {
    await option(page, 'Files').check();
    await landmark(page, 'Files').getByRole('link', { name: 'upload.ts' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('upload.ts');
    await expect(option(page, 'Editor')).toBeChecked();
    await expect(editor(page)).toBeVisible();
    await focusedPanelIs(page, 'Editor');
  });

  for (const modifier of ['ControlOrMeta', 'Shift', 'Alt'] as const) {
    test(`${modifier}+click opens elsewhere, so the left panel stays showing`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'A phone has no modifier keys.');
      await option(page, 'Files').check();
      await landmark(page, 'Files').getByRole('link', { name: 'upload.ts' }).click({ modifiers: [modifier] });
      await expect(option(page, 'Files')).toBeChecked();
      await expect(landmark(page, 'Files')).toBeVisible();
    });
  }

  test('a link with a target of its own opens elsewhere, so the left panel stays showing', async ({ page }) => {
    await option(page, 'Files').check();
    const link = landmark(page, 'Files').getByRole('link', { name: 'upload.ts' });
    await link.evaluate((el) => el.setAttribute('target', '_blank'));
    await link.click();
    await expect(option(page, 'Files')).toBeChecked();
    await expect(landmark(page, 'Files')).toBeVisible();
  });

  test('main is never empty: with a side panel showing it says where its content went', async ({ page }) => {
    const note = page.getByRole('main').getByText('Editor isn’t showing');
    await expect(note).toHaveCount(0);
    await option(page, 'Files').check();
    await expect(note).toHaveCount(1);
    await expect(note).toHaveClass('ld-sr-only');
    await option(page, 'Editor').check();
    await expect(note).toHaveCount(0);
  });

  test('the skip link reaches main from any panel', async ({ page }) => {
    await option(page, 'Assistant').check();
    await page.locator('.ld-skip').focus();
    await page.keyboard.press('Enter');
    await expect(editor(page)).toBeVisible();
    await expect(option(page, 'Editor')).toBeChecked();
    await focusedPanelIs(page, 'Editor');
  });

  test('crossing the breakpoint never strands focus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'A phone does not cross the breakpoint.');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(landmark(page, 'Files')).toBeVisible();
    await splitter(page, 'Files').focus();
    await page.setViewportSize({ width: 390, height: 800 });
    await focusedPanelIs(page, 'Editor');
    await option(page, 'Assistant').check();
    await option(page, 'Assistant').focus();
    await page.setViewportSize({ width: 1280, height: 800 });
    await focusedPanelIs(page, 'Editor');
  });

  test('in forced colours the switcher still marks the panel on show', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const colours = await switcher(page).evaluate((el) => {
      const chosen = getComputedStyle(el.querySelector('input:checked + .ld-seg-label')!);
      return { fill: chosen.backgroundColor, text: chosen.color, canvas: getComputedStyle(document.body).backgroundColor };
    });
    expect(colours.fill).not.toBe(colours.canvas);
    expect(colours.fill).not.toMatch(/, 0\)$/);
    expect(colours.text).not.toBe(colours.fill);
  });

  test('every panel stays clean under axe', async ({ page }) => {
    for (const name of ['Files', 'Assistant']) {
      await option(page, name).check();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
});
