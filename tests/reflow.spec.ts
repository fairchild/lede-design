import { test, expect, type Page } from '@playwright/test';
import { ROUTES } from './routes';
import { openPanels } from './open-panels';

// At double and triple the browser's text size on a phone, text reflows: no row or Disclosure paints its title or
// subtitle under its value or meta, a title beside either keeps its longest word, and no text is cut off by a box that
// clips it. A box that truncates its own text on purpose (an ellipsis, a line clamp) is a designed cut, so only what it
// shows is checked against the boxes around it. Scroll containers end the walk, since what they hide can be scrolled to.
// At enlarged text on a narrow window, row subtitles (all but an inbox row's one-line preview) and the workbench's title
// wrap or take a line of their own, so they're also checked for a cut of their own, and so is a select's chosen option.

interface Findings { overflow: number; overlaps: string[]; squeezed: string[]; clipped: string[]; truncated: string[] }

// Sideways scroll is measured against `clientWidth`, the screen's width: a phone widens `innerWidth` to fit a page wider
// than its screen.
function inspect(wordTakesLine: boolean | void = true): Findings {
  const found: Findings = { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, overlaps: [], squeezed: [], clipped: [], truncated: [] };
  const crosses = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const text = (el: Element | null) => (el?.textContent ?? '').trim().slice(0, 40);

  // A ListRow's value, a Disclosure's meta and a ListGroup's summary sit beside the title while both fit, and move under
  // it otherwise. A
  // Disclosure's meta takes a column of its own beside the title and summary, so it narrows the title anywhere but under.
  const beside = (t: DOMRect, v: DOMRect) => v.top < t.bottom && t.top < v.bottom;
  const pairs = [
    { box: '.ld-row', title: '.ld-row-title', parts: '.ld-row-title, .ld-row-subtitle', value: '.ld-row-value', line: '.ld-row-primary', beside },
    { box: '.ld-disc-head', title: '.ld-disc-title', parts: '.ld-disc-title, .ld-disc-summary', value: '.ld-disc-meta', line: '.ld-disc-head', beside: (t: DOMRect, v: DOMRect) => v.left >= t.right - 0.5 },
    { box: '.ld-list-header', title: '.ld-list-title', parts: '.ld-list-title', value: '.ld-list-summary', line: '.ld-list-header', beside },
  ];
  for (const pair of pairs) for (const row of document.querySelectorAll(pair.box)) {
    const value = row.querySelector(pair.value);
    const title = row.querySelector<HTMLElement>(pair.title);
    if (!value || !title || !value.checkVisibility()) continue;
    const v = value.getBoundingClientRect();
    for (const part of row.querySelectorAll(pair.parts)) {
      if (crosses(part.getBoundingClientRect(), v)) found.overlaps.push(`“${text(part)}” under “${text(value)}”`);
    }
    // Beside its value, the title is at least as wide as its longest word. A word longer than the line takes the whole
    // line at enlarged text, and at the default size, where the value stays beside the title, it breaks.
    const t = title.getBoundingClientRect();
    if (pair.beside(t, v)) {
      const probe = title.cloneNode(true) as HTMLElement;
      probe.style.cssText = 'position: absolute; visibility: hidden; display: block; width: min-content; overflow-wrap: normal; word-break: normal; -webkit-line-clamp: none;';
      title.parentElement!.append(probe);
      const word = probe.getBoundingClientRect().width;
      probe.remove();
      const line = row.matches(pair.line) ? row : row.querySelector(pair.line)!;
      const style = getComputedStyle(line);
      const room = line.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (wordTakesLine ? t.width + 1 < Math.min(word, room) : word <= room && t.width + 1 < word) found.squeezed.push(`“${text(title)}” is ${Math.round(t.width)}px beside “${text(value)}”, its longest word ${Math.round(word)}px`);
    }
  }

  for (const el of document.querySelectorAll<HTMLElement>('.ld-row-subtitle, .ld-wb-title')) {
    if (el.closest('.ld-inbox-row') || !el.checkVisibility()) continue;
    // An ellipsis cuts across and a line clamp cuts down, so both directions are read.
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) found.truncated.push(`“${text(el)}” (${el.className}) shows ${el.clientWidth}×${el.clientHeight}px of ${el.scrollWidth}×${el.scrollHeight}px`);
  }
  // A select draws its chosen option itself, so its text is measured with the select's font against its content box.
  const measure = document.createElement('canvas').getContext('2d')!;
  for (const select of document.querySelectorAll('select')) {
    if (!select.checkVisibility()) continue;
    const s = getComputedStyle(select);
    measure.font = s.font;
    const chosen = select.selectedOptions[0]?.textContent ?? '';
    const need = measure.measureText(chosen).width;
    const room = select.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    if (need > room + 1) found.truncated.push(`“${chosen}” (select) needs ${Math.round(need)}px, has ${Math.round(room)}px`);
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!node.textContent?.trim() || !el?.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue;
    // Hidden on purpose: visually hidden text, the skip link until it has focus, and a row slid aside to show its actions.
    if (el.closest('.ld-sr-only, .ld-skip, .ld-row-revealed .ld-row')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    let rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(({ left, right, top, bottom }) => ({ left, right, top, bottom }));
    for (let box: Element | null = el; box && box !== document.documentElement && rects.length; box = box.parentElement) {
      const s = getComputedStyle(box);
      if (/auto|scroll/.test(s.overflowX + s.overflowY)) break;
      const x = /hidden|clip/.test(s.overflowX), y = /hidden|clip/.test(s.overflowY);
      if (!x && !y) continue;
      const b = box.getBoundingClientRect();
      const designed = s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none';
      const out = rects.some((r) => (x && (r.left < b.left - 1 || r.right > b.right + 1)) || (y && (r.top < b.top - 1 || r.bottom > b.bottom + 1)));
      if (out && !designed) {
        found.clipped.push(`“${text(el)}” (${el.className || el.tagName}) cut off by ${box.className || box.tagName}`);
        break;
      }
      rects = rects
        .map((r) => ({ left: x ? Math.max(r.left, b.left) : r.left, right: x ? Math.min(r.right, b.right) : r.right, top: y ? Math.max(r.top, b.top) : r.top, bottom: y ? Math.min(r.bottom, b.bottom) : r.bottom }))
        .filter((r) => r.right > r.left && r.bottom > r.top);
    }
  }
  return found;
}

async function atTextSize(page: Page, scale: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 * scale, fixed: 13 * scale } });
}

// On these routes a server-mode table says "Loading", then "50 of 100+", then its exact count, and the work list's rows
// arrive after 350ms, so a page is read once its count is exact and its height has held for three reads 400ms apart.
const ESTIMATED = new Set(['/app/work', '/blocks/data-table']);
async function settle(page: Page, route: string, scale: number) {
  await page.goto(route);
  await expect(page.locator('main').first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${16 * scale}px`);
  if (ESTIMATED.has(route)) {
    await expect.poll(() => page.locator('.ld-dt-summary').evaluateAll((all) => all.length > 0 && all.every((s) => !/Loading|\d\+/.test(s.textContent ?? ''))), { timeout: 10_000 }).toBe(true);
  }
  await steady(page);
}

async function steady(page: Page) {
  const reads: number[] = [];
  await expect.poll(async () => {
    reads.push(await page.evaluate(() => document.documentElement.scrollHeight));
    return reads.length >= 3 && reads.slice(-3).every((h) => h === reads.at(-1));
  }, { intervals: [400] }).toBe(true);
}

for (const route of ROUTES) {
  test(`${route} · at 200% text on a phone, rows keep their text clear of their values, subtitles wrap, and nothing is cut off`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'A phone is the narrow case.');
    await atTextSize(page, 2);
    for (const width of [320, 390, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await settle(page, route, 2);
      expect(await page.evaluate(inspect), `${width}px`).toEqual({ overflow: 0, overlaps: [], squeezed: [], clipped: [], truncated: [] });
      // A closed panel's body takes no space, so the page is read again with every Disclosure and collapsible table open.
      if (!(await openPanels(page))) continue;
      await steady(page);
      expect(await page.evaluate(inspect), `${width}px with every panel open`).toEqual({ overflow: 0, overlaps: [], squeezed: [], clipped: [], truncated: [] });
    }
  });
}

// At triple the text size on a 320px phone, every route still fits its width: a word longer than the line breaks, and a
// control's label wraps inside the control, where a word too long for it would otherwise spill past its edge. A native
// select draws its chosen option on one line, and the work list's sort option “Due, ascending” is wider than the screen
// at this size, so that one cut on `/app/work` is the one allowed.
async function inspectAt300(page: Page, route: string) {
  const found = await page.evaluate(inspect);
  const spilled = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.ld-btn, .ld-bar-tool, .ld-bar-item, .ld-accent, .ld-switch')].flatMap((control) => {
    if (!control.checkVisibility()) return [];
    const box = control.getBoundingClientRect();
    const text = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
    let out = false;
    for (let node = text.nextNode(); node && !out; node = text.nextNode()) {
      if (node.parentElement?.closest('.ld-sr-only')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      out = [...range.getClientRects()].some((r) => r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1));
    }
    return out ? [`“${control.textContent?.trim().slice(0, 40)}” (${control.className}) spills past its edge`] : [];
  }));
  return { ...found, truncated: found.truncated.filter((t) => !(route === '/app/work' && t.startsWith('“Due, ascending” (select)'))), spilled };
}
for (const route of ROUTES) {
  test(`${route} · at 300% text on a 320px phone, nothing scrolls sideways and nothing is cut off`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'A phone is the narrow case.');
    await atTextSize(page, 3);
    await page.setViewportSize({ width: 320, height: 800 });
    await settle(page, route, 3);
    expect(await inspectAt300(page, route)).toEqual({ overflow: 0, overlaps: [], squeezed: [], clipped: [], truncated: [], spilled: [] });
    if (!(await openPanels(page))) return;
    await steady(page);
    expect(await inspectAt300(page, route), 'with every panel open').toEqual({ overflow: 0, overlaps: [], squeezed: [], clipped: [], truncated: [], spilled: [] });
  });
}

// At the default text size on a phone, a title keeps its longest word beside a row's value, a Disclosure's meta or a
// list's summary: a ListGroup summary longer than the room beside its title moves under it. Only a word longer than the
// whole line breaks.
for (const route of ROUTES) {
  test(`${route} · at the default text size on a phone, every title beside a value keeps its words whole`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'A phone is the narrow case.');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await settle(page, route, 1);
      expect((await page.evaluate(inspect, false)).squeezed, `${width}px`).toEqual([]);
      if (!(await openPanels(page))) continue;
      await steady(page);
      expect((await page.evaluate(inspect, false)).squeezed, `${width}px with every panel open`).toEqual([]);
    }
  });
}

test('At 300% text on a phone, the workbench’s top bar wraps, shows its whole title and keeps every control on screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'A phone is the narrow case.');
  await atTextSize(page, 3);
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await settle(page, '/layouts/workbench', 3);
    expect(await page.evaluate(inspect), `${width}px`).toEqual({ overflow: 0, overlaps: [], squeezed: [], clipped: [], truncated: [] });
    for (const control of await page.locator('.ld-wb-bar').getByRole('button').or(page.locator('.ld-wb-bar').getByRole('link')).filter({ visible: true }).all()) {
      const box = (await control.boundingBox())!;
      expect(box.x, `${width}px`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

// The Inbox notice holds the top of the list pane while the list scrolls. At 200% text on a phone and at 400% zoom (a
// 1280px window is 320px wide) it wraps inside the pane and is cut off nowhere, the row focus kept starts below it, and
// it stays clear of the tab bar and SelectionBar at the foot of the screen.
for (const { label, scale, viewport } of [
  { label: '200% text on a phone', scale: 2, viewport: { width: 390, height: 844 } },
  { label: '400% zoom', scale: 1, viewport: { width: 320, height: 256 } },
]) {
  test(`At ${label}, the Inbox notice wraps in the list pane, clear of the landed row and the bars at the foot`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'A phone is the narrow case.');
    await atTextSize(page, scale);
    await page.setViewportSize(viewport);
    await settle(page, '/app/inbox', scale);
    await page.getByRole('button', { name: 'More actions for Your receipt for October' }).tap();
    await page.getByRole('menuitem', { name: 'Archive' }).tap();
    const notice = page.locator('.ld-inbox-notice');
    const landed = page.getByRole('link', { name: /Design review agenda/ });
    await expect(landed).toBeFocused();
    await steady(page);
    // The live announcer's copy is visually hidden by a clip, and leaves a second after it's spoken.
    await expect(page.getByText('Archived 1 message. Undo', { exact: true })).toHaveCount(0, { timeout: 3000 });
    expect(await page.evaluate(() => window.scrollY), 'the list is scrolled, so the notice is stuck').toBeGreaterThan(0);
    await expect(notice).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Undo' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(inspect)).toEqual({ overflow: 0, overlaps: [], squeezed: [], clipped: [], truncated: [] });
    const below = async (what: string, top: () => Promise<{ y: number } | null>) => {
      const [n, other] = [(await notice.boundingBox())!, (await top())!];
      expect(n.y + n.height, `the notice ends above ${what}`).toBeLessThanOrEqual(other.y);
    };
    await below('the landed row', () => landed.boundingBox());
    await below('the tab bar', () => page.locator('.ld-shell-tabbar > *').boundingBox());
    await page.screenshot({ path: test.info().outputPath(`notice-${scale}x-${viewport.width}.png`) });
    // Selecting brings SelectionBar up over the tab bar; the notice stays at the top.
    await page.getByRole('button', { name: 'Select', exact: true }).tap();
    await page.getByRole('checkbox', { name: /Design review agenda/ }).tap();
    await expect(notice).toBeInViewport({ ratio: 1 });
    await below('SelectionBar', () => page.getByRole('toolbar').boundingBox());
    await page.screenshot({ path: test.info().outputPath(`notice-selecting-${scale}x-${viewport.width}.png`) });
  });
}

// At the default text size a value moves under its title only where the two don't fit side by side: the title's
// longest word, the gap and the value's text, in the line from where the text starts. Either way the row keeps its inset
// above and below. On these screens, at phone and
// desktop widths, every value that fits beside its title shares its line. Which ones fit depends on the fonts, so the
// fit is measured.
test('At the default text size, a row’s value stays on its title’s line wherever the two fit, and the row keeps its inset', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The widths are set here, so one project is enough.');
  const apart = () => page.evaluate(() => [...document.querySelectorAll('.ld-row')].flatMap((row) => {
    const value = row.querySelector<HTMLElement>('.ld-row-value');
    const title = row.querySelector<HTMLElement>('.ld-row-title');
    const line = row.querySelector<HTMLElement>('.ld-row-primary');
    const main = row.querySelector<HTMLElement>('.ld-row-main');
    if (!value || !title || !line || !main || !value.checkVisibility()) return [];
    const v = value.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    if (v.top < t.bottom && t.top < v.bottom) return [];
    const width = (el: HTMLElement, css: string) => {
      const probe = el.cloneNode(true) as HTMLElement;
      probe.style.cssText = `position: absolute; visibility: hidden; display: block; padding: 0; ${css}`;
      line.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    const word = width(title, 'width: min-content; overflow-wrap: normal; -webkit-line-clamp: none;');
    const text = width(value, 'width: max-content; white-space: nowrap;');
    const s = getComputedStyle(line);
    const room = line.getBoundingClientRect().right - parseFloat(s.paddingRight) - main.getBoundingClientRect().left;
    const need = word + parseFloat(s.columnGap) + text;
    return need + 1 < room ? [`“${title.textContent?.trim()}” and “${value.textContent?.trim()}” fit in ${Math.round(room)}px (${Math.round(need)}px) but are apart`] : [];
  }));
  const values = () => page.locator('.ld-row-value').filter({ visible: true }).count();
  // The line holds the row's inset, above and below its text and whatever value shares or wraps under it.
  const uninset = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.ld-row-primary')].flatMap((line) => {
    if (!line.checkVisibility()) return [];
    // A custom property's computed value is its unresolved text, so a probe takes it as a height.
    const probe = line.appendChild(document.createElement('i'));
    probe.style.cssText = 'position: absolute; height: var(--ld-row-pad);';
    const pad = probe.getBoundingClientRect().height;
    probe.remove();
    const box = line.getBoundingClientRect();
    const text = [...line.querySelectorAll('.ld-row-main, .ld-row-value')].map((el) => el.getBoundingClientRect());
    const [top, bottom] = [Math.min(...text.map((r) => r.top)), Math.max(...text.map((r) => r.bottom))];
    return top - box.top + 0.5 < pad || box.bottom - bottom + 0.5 < pad ? [`“${line.textContent?.trim().slice(0, 40)}” has ${Math.round(top - box.top)}px above, ${Math.round(box.bottom - bottom)}px below, under ${pad}px`] : [];
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/app/settings', '/app/inbox', '/app']) {
      await page.goto(route);
      await expect(page.locator('main').first()).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('16px');
      // Today's rows with values sit in Disclosures, so each closed one is opened.
      await page.locator('main .ld-disc-head[aria-expanded="false"]').evaluateAll((heads) => heads.forEach((head) => (head as HTMLButtonElement).click()));
      await expect.poll(values).toBeGreaterThan(0);
      expect(await apart(), `${route} at ${width}px`).toEqual([]);
      expect(await uninset(), `${route} at ${width}px`).toEqual([]);
    }
    // Review lists every answer as a row with its value. Once the draft has reached it, its URL opens it.
    if (width === 320) {
      await page.goto('/app/welcome');
      for (const step of ['Make it yours', 'Review']) {
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByRole('heading', { level: 1, name: step })).toBeVisible();
      }
    } else {
      await page.goto('/app/welcome/review');
      await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
    }
    await expect.poll(values).toBeGreaterThan(3);
    expect(await apart(), `Review at ${width}px`).toEqual([]);
  }
});

// Breakpoints are in em of the browser's text size, so at 200% text a 1280px window lays out as a 640px one would: the
// tab bar instead of the sidebar, and one workbench panel at a time. The workbench's panels are hidden by
// `useStackedPanes`, so the script and the CSS have to agree on where the split is. At the default size the same window
// keeps its sidebar and all three panels, so the check isn't met by a layout that never splits.
test('At 200% text on a 1280px window, the shell and the workbench lay out as on a 640px one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A desktop window is the wide case.');
  await page.setViewportSize({ width: 1280, height: 800 });
  const panels = () => page.locator('.ld-wb-panel, .ld-wb-content').filter({ visible: true }).count();
  for (const scale of [1, 2]) {
    await atTextSize(page, scale);
    const stacked = scale === 2;
    await settle(page, '/app/inbox', scale);
    await expect(page.locator('.ld-shell-tabbar'), `${scale}x`).toBeVisible({ visible: stacked });
    await expect(page.locator('.ld-shell-sidebar'), `${scale}x`).toBeVisible({ visible: !stacked });
    await settle(page, '/layouts/workbench', scale);
    await expect(page.locator('.ld-wb-switch'), `${scale}x`).toBeVisible({ visible: stacked });
    await expect.poll(panels, `${scale}x`).toBe(stacked ? 1 : 3);
  }
});

// SelectionBar's count and actions wrap onto lines of their own when they don't fit on one, so at large text on a phone
// each label shows in full inside its control, no two parts cross and the whole bar stays on screen.
test('At 200% and 300% text on a phone, SelectionBar wraps its parts and shows every label in full', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'A phone is the narrow case.');
  for (const { scale, widths } of [{ scale: 2, widths: [320, 390, 412] }, { scale: 3, widths: [320, 412] }]) {
    await atTextSize(page, scale);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await settle(page, '/app/inbox', scale);
      await page.getByRole('button', { name: 'Select', exact: true }).tap();
      await page.getByRole('checkbox', { name: /Design review agenda/ }).tap();
      const bar = page.getByRole('toolbar', { name: /selected$/ });
      await expect(bar).toBeVisible();
      const found = await bar.evaluate((toolbar) => {
        const out: string[] = [];
        const vw = document.documentElement.clientWidth;
        const parts = [...toolbar.children].filter((el) => (el as HTMLElement).checkVisibility()) as HTMLElement[];
        const boxes = parts.map((el) => el.getBoundingClientRect());
        const name = (el: Element) => el.textContent?.trim() || el.className;
        parts.forEach((el, i) => {
          const r = boxes[i];
          if (r.left < -0.5 || r.right > vw + 0.5) out.push(`“${name(el)}” at ${Math.round(r.left)}..${Math.round(r.right)}px`);
          if (el.scrollWidth > el.clientWidth + 1) out.push(`“${name(el)}” shows ${el.clientWidth}px of ${el.scrollWidth}px`);
          for (let j = i + 1; j < parts.length; j++) {
            const o = boxes[j];
            if (r.left < o.right - 0.5 && o.left < r.right - 0.5 && r.top < o.bottom - 0.5 && o.top < r.bottom - 0.5) out.push(`“${name(el)}” crosses “${name(parts[j])}”`);
          }
        });
        // On a phone at large text the count has its row to itself, and a separator only ever sits between two parts.
        const row = (r: DOMRect) => boxes.filter((o) => o.top < r.bottom - 0.5 && r.top < o.bottom - 0.5);
        const count = parts.findIndex((el) => el.matches('.ld-selection-count'));
        if (count >= 0 && row(boxes[count]).length > 1) out.push('the count shares its row');
        parts.forEach((el, i) => {
          if (!el.matches('.ld-bar-sep')) return;
          const line = row(boxes[i]).filter((o) => o !== boxes[i]);
          if (!line.some((o) => o.right <= boxes[i].left + 0.5) || !line.some((o) => o.left >= boxes[i].right - 0.5)) out.push(`a separator ends a line at ${Math.round(boxes[i].left)}px`);
        });
        return out;
      });
      expect(found, `${scale}x at ${width}px`).toEqual([]);
      const [over, under] = [(await bar.boundingBox())!, (await page.locator('.ld-shell-tabbar .ld-bar').boundingBox())!];
      expect(over.y + over.height, `${scale}x at ${width}px: SelectionBar ends above the tab bar`).toBeLessThanOrEqual(under.y);
    }
  }
});

// Under 68.75em (1100px at the default size) MasterDetail shows one pane at a time, so at 1024px an open message fills
// the page and its list waits behind Back.
test('At 1024px and the default text size, an open message shows alone, without its list', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A desktop window is the wide case.');
  await page.setViewportSize({ width: 1024, height: 800 });
  await settle(page, '/app/inbox/m1', 1);
  await expect(page.locator('.ld-md-detail')).toBeVisible();
  await expect(page.locator('.ld-md-list')).toBeHidden();
});

// The docs site's layout previews open at the width the site itself is showing: Narrow wherever the site shows its tab
// bar, which at 200% text includes a 1280px window.
test('At 200% text on a 1280px window, the layout previews open at Narrow', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A desktop window is the wide case.');
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const scale of [1, 2]) {
    await atTextSize(page, scale);
    await settle(page, '/layouts', scale);
    await expect(page.locator('.docs-shell-tabbar, .ld-shell-tabbar').first(), `${scale}x`).toBeVisible({ visible: scale === 2 });
    await expect(page.getByRole('radio', { name: scale === 2 ? 'Narrow' : 'Wide' }).first(), `${scale}x`).toBeChecked();
  }
});
