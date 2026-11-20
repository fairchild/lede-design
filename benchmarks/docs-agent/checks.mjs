// The scripted checks every task shares, and helpers for each task's own checks in tasks/*/check.mjs. A check is
// { name, pass, detail }, and a run's score is the share that pass. Each one is pass or fail, read from the built app
// or its source, so no judgment of taste goes into the score.
import { readFileSync } from 'node:fs';

export const ok = (name, pass, detail = '') => ({ name, pass: Boolean(pass), detail });

/** Runs `fn`, and gives back undefined where an app lacks what it looks for. */
export async function safely(fn) {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

/** How many of a locator's matches are visible. */
export async function countVisible(locator) {
  let n = 0;
  const count = await safely(() => locator.count());
  for (let i = 0; i < (count ?? 0); i++) if (await safely(() => locator.nth(i).isVisible())) n++;
  return n;
}

/**
 * How many visible elements show `text` whole: the smallest element holding it, not cut short by an ellipsis, a line
 * clamp or overflow. A list's preview of a message holds its body too, but clipped, so it doesn't count.
 */
export function countShownWhole(page, text) {
  return page.evaluate((needle) => {
    let n = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (!(el.textContent ?? '').includes(needle) || !el.getClientRects().length) continue;
      if ([...el.children].some((child) => (child.textContent ?? '').includes(needle))) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) continue;
      n++;
    }
    return n;
  }, text);
}

/** How far the page's visible text and controls come to the window's edges, and whether it scrolls sideways. */
export function edges(page) {
  return page.evaluate(() => {
    let left = Infinity;
    let right = Infinity;
    const width = document.documentElement.clientWidth;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    // Text inside a region that scrolls sideways, such as a wide table, is measured at that region's edges: what
    // runs past them is scrolled out of view, not crowding the window.
    const clip = (el) => {
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const x = getComputedStyle(a).overflowX;
        if ((x === 'auto' || x === 'scroll' || x === 'hidden' || x === 'clip') && a.scrollWidth > a.clientWidth + 1) return a.getBoundingClientRect();
      }
      return null;
    };
    const boxes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const region = clip(node.parentElement);
      for (const r of range.getClientRects()) boxes.push({ r, region });
    }
    for (const el of document.querySelectorAll('input, button, select, textarea')) boxes.push({ r: el.getBoundingClientRect(), region: clip(el.parentElement) });
    for (const { r: box, region } of boxes) {
      if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight) continue;
      const l = region ? Math.max(box.left, region.left) : box.left;
      const r = region ? Math.min(box.right, region.right) : box.right;
      if (r <= l) continue;
      left = Math.min(left, l);
      right = Math.min(right, width - r);
    }
    return { left, right, scrolls: document.documentElement.scrollWidth > width + 1 };
  });
}

/** Checks of the page as a page: a heading, a gutter and, on a phone, no sideways scroll. */
export async function pageChecks(page, where) {
  const e = await edges(page);
  const results = [ok(`${where}: text and controls keep 8px from the window's edges`, e.left >= 8 && e.right >= 8, `left ${Math.round(e.left)}px, right ${Math.round(e.right)}px`)];
  if (where === 'phone') results.push(ok('phone: no sideways scroll', !e.scrolls));
  if (where === 'desktop') results.push(ok('desktop: the page has one h1', (await page.locator('h1').count()) === 1));
  return results;
}

/** Axe at WCAG 2.1 A and AA. */
export async function axe(page, where) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const rules = result.violations.map((v) => `${v.id} (${v.nodes.length})`);
  return ok(`${where}: no axe violations`, rules.length === 0, rules.join(', '));
}

/** Checks of the app's own source, not Lede's copied files: that it builds on Lede rather than around it. */
export function sourceChecks(files, ledeImports) {
  const read = files.map((file) => readFileSync(file, 'utf8'));
  const code = read.join('\n');
  const colors = code.match(/(?<=["'`:\s(])#[0-9a-f]{3,8}(?=["'`;\s),])|\b(?:rgb|hsl|oklch)a?\(/gi) ?? [];
  const palette = code.match(/\b(?:bg|text|border|ring|fill)-(?:red|blue|green|gray|slate|zinc|neutral|stone|amber|yellow|emerald|sky|indigo|violet|rose|orange)-\d{2,3}\b/g) ?? [];
  const clickable = code.match(/<(?:div|span|li|td|tr)\b[^>]*\bonClick=/g) ?? [];
  return [
    ok('source: builds on Lede, importing at least one of its modules', ledeImports > 0, `${ledeImports} imported`),
    ok('source: no hard-coded colors or Tailwind palette colors', colors.length + palette.length === 0, [...colors, ...palette].slice(0, 5).join(' ')),
    ok('source: no click handlers on elements that aren’t controls', clickable.length === 0, clickable.slice(0, 3).join(' ')),
  ];
}
