// Where focus has been. A sampler reads `document.activeElement` on every animation frame, which is what a sighted
// keyboard user sees, and `focusin` timestamps each move as it happens, for ordering against what screen readers hear.
import { expect, type Page } from '@playwright/test';

/** What was focused on a frame. `arrived` is whether anything but `<body>` had focus earlier in this document. */
export type Frame = { t: number; focus: string; arrived: boolean };
/** One focus move, timed by `performance.now()`, the clock `tests/spoken.ts` uses too. */
export type Move = { t: number; focus: string };
type Log = { frames: Frame[]; moves: Move[] };

/** Call before the first navigation: it records from each document's first frame on. */
export async function trackFocus(page: Page) {
  await page.addInitScript(() => {
    const describe = (el: Element | null): string => {
      if (!el || el === document.body) return 'body';
      const role = el.getAttribute('role');
      const tag = el.tagName.toLowerCase() + (role ? `[role=${role}]` : '');
      const labelled = el.getAttribute('aria-labelledby')?.split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');
      const label = (el as HTMLInputElement).labels?.[0]?.textContent;
      const name = el.getAttribute('aria-label') ?? labelled ?? label ?? (el as HTMLElement).innerText ?? '';
      return `${tag} “${name.replace(/\s+/g, ' ').trim().slice(0, 60)}”`;
    };
    const log: Log = { frames: [], moves: [] };
    (window as unknown as { focusLog: Log }).focusLog = log;
    let last = '';
    let arrived = false;
    const sample = () => {
      const now = describe(document.activeElement);
      if (now !== last) log.frames.push({ t: performance.now(), focus: now, arrived });
      if (now !== 'body') arrived = true;
      last = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    document.addEventListener('focusin', (e) => log.moves.push({ t: performance.now(), focus: describe(e.target as Element) }), true);
  });
}

const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

/** Every focus seen per animation frame since the last call, once two more frames have passed. */
export async function focusTrail(page: Page): Promise<Frame[]> {
  await settle(page);
  return page.evaluate(() => (window as unknown as { focusLog: Log }).focusLog.frames.splice(0));
}

/** Every focus move since the document loaded. */
export const focusMoves = (page: Page): Promise<Move[]> =>
  page.evaluate(() => (window as unknown as { focusLog: Log }).focusLog.moves);

export const trailText = (trail: Frame[]) => trail.map((f) => f.focus).join(' → ') || '(no change)';

/** Fails on any frame on `<body>` after the document's first arrival: focus moves from one element to the next. */
export function expectNoBody(trail: Frame[]) {
  const through = trail.filter((f) => f.arrived && f.focus === 'body');
  expect(through, `focus passed through <body>: ${trailText(trail)}`).toEqual([]);
}

/** Resolves once the same element has kept focus for `ms`, for actions whose result arrives after a server round trip. */
export const focusSettled = (page: Page, ms = 600) => page.evaluate((ms) => new Promise<void>((done) => {
  const start = performance.now();
  let last = document.activeElement;
  let since = start;
  const tick = () => {
    const now = performance.now();
    if (document.activeElement !== last) { last = document.activeElement; since = now; }
    if (now - since >= ms || now - start > 5000) done();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), ms);

type RowFrame = { rows: string; on: boolean };

/**
 * From now on, records on every frame the row ids inside `scope` and whether focus is on or in `target`, a selector
 * inside `scope`. `expectLandsWithRows` reads it.
 */
export const watchRows = (page: Page, scope: string, target: string) => page.evaluate(({ scope, target }) => {
  const frames: RowFrame[] = [];
  (window as unknown as { rowFrames: RowFrame[] }).rowFrames = frames;
  const tick = () => {
    const root = document.querySelector(scope);
    const rows = [...(root?.querySelectorAll('[data-row-id]') ?? [])].map((r) => r.getAttribute('data-row-id')).join(' ');
    const el = root?.querySelector(target);
    const on = !!el && el.contains(document.activeElement);
    const last = frames.at(-1);
    if (!last || last.rows !== rows || last.on !== on) frames.push({ rows, on });
    requestAnimationFrame(tick);
  };
  tick();
}, { scope, target });

/**
 * Focus reached the target on the first frame that showed the new rows: not before them, not a frame after them, and
 * it stayed there. A move made in the commit that renders the rows passes; one in a later frame, or one made while
 * the old rows still show, fails.
 */
export async function expectLandsWithRows(page: Page) {
  await settle(page);
  const frames = await page.evaluate(() => (window as unknown as { rowFrames: RowFrame[] }).rowFrames);
  const first = frames.findIndex((f) => f.rows !== frames[0].rows);
  const text = frames.map((f) => `${f.on ? 'on' : 'off'} [${f.rows.split(' ').slice(0, 3).join(' ')}…]`).join(' → ');
  expect(first, `the new rows render: ${text}`).toBeGreaterThan(0);
  expect(frames.map((f, i) => f.on === i >= first), `focus lands with the new rows, once: ${text}`).not.toContain(false);
}
