// Back, Forward and back links return focus to where the person was, as a full page's back-forward cache would. Each
// history entry keeps the last element focused inside `<main>`, found again on return by what it is (its tag, and its
// href or its name) and where it stands among its likes. A `<nav>` link lives on across routes, so it's never recorded.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/** An element as a later render of the same screen can find it again. */
interface Mark { tag: string; href?: string; name?: string; nth: number }
interface Entry { key: string; idx: number; url: string }

const marks = new Map<string, Mark>();
/** The entries this tab has seen, by position in its history, so a link to the one before is known as a return. */
const entries = new Map<number, Entry>();
let current: Entry | undefined;
/** A return whose element hasn't arrived yet, such as a row that loads after the screen. The person moving focus ends it. */
let waiting: { key: string; mark: Mark } | undefined;

const historyState = () => (window.history.state ?? {}) as { key?: string; idx?: number };
const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The visible elements in `main` that `mark` could name, in document order. */
function likes(main: Element, mark: Omit<Mark, 'nth'>) {
  const selector = mark.href === undefined ? mark.tag : `${mark.tag}[href="${CSS.escape(mark.href)}"]`;
  return [...main.querySelectorAll<HTMLElement>(selector)]
    .filter((el) => el.checkVisibility() && (mark.href !== undefined || name(el) === mark.name));
}

function markOf(el: Element, main: Element): Mark | undefined {
  const tag = el.localName;
  // A link is its destination: its text can change while it's away, as an inbox row's does once its message is read.
  const href = tag === 'a' ? el.getAttribute('href') ?? undefined : undefined;
  const like = { tag, href, name: href === undefined ? name(el) : undefined };
  const nth = likes(main, like).indexOf(el as HTMLElement);
  return nth < 0 ? undefined : { ...like, nth };
}

/**
 * Focuses the element `mark` names, unless a move earlier in this commit placed focus inside `<main>` (focus is no
 * longer on `before`, the element that had it as the route changed). False when the element isn't there.
 */
function place(mark: Mark, before?: Element | null): boolean {
  const main = document.querySelector('main');
  if (!main || !document.hasFocus()) return true;
  const active = document.activeElement;
  if (before !== undefined && active !== before && active !== main && main.contains(active)) return true;
  const el = likes(main, mark)[mark.nth];
  if (!el) return false;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest' });
  // ScrollRestoration resets a link's scroll to the top in a later commit of the same change, so it scrolls again once
  // that's done, while the element still has focus.
  requestAnimationFrame(() => { if (document.activeElement === el) el.scrollIntoView({ block: 'nearest' }); });
  return true;
}

function record(event: FocusEvent) {
  const el = event.target as Element;
  // A wait parks focus on the screen's h1. Focus that goes anywhere else, by the keyboard, a pointer or a screen
  // reader's browse cursor, is the person's own, and the late restore must not take it back.
  if (waiting && el.localName !== 'h1') waiting = undefined;
  const main = el.closest?.('main');
  if (!main || el === main) return;
  const mark = markOf(el, main);
  if (mark) marks.set(historyState().key ?? 'default', mark);
}
const stopWaiting = () => { waiting = undefined; };

/**
 * Restores focus on Back and Forward, and on a link to the entry just before this one, such as a back link. It runs
 * at the end of each route change's commit, after the screen's own move and before PageHeader's, and yields to the
 * screen's. Render it once, above the routes.
 */
export function useFocusRestoration() {
  const { key, pathname, search, hash } = useLocation();
  const type = useNavigationType();
  // Where focus was as the route changed, read in the render that brings the new route, before its commit moves it.
  const before = useRef<{ key: string; active: Element | null }>(undefined);
  if (before.current?.key !== key) before.current = { key, active: document.activeElement };
  useEffect(() => {
    document.addEventListener('focusin', record, true);
    document.addEventListener('keydown', stopWaiting, true);
    document.addEventListener('pointerdown', stopWaiting, true);
    return () => {
      document.removeEventListener('focusin', record, true);
      document.removeEventListener('keydown', stopWaiting, true);
      document.removeEventListener('pointerdown', stopWaiting, true);
    };
  }, []);
  useLayoutEffect(() => {
    const left = current;
    // A Fast Refresh re-runs this effect on the same entry, which must not restore again. No Playwright row reaches it.
    if (left?.key === key) return;
    const here: Entry = { key, idx: historyState().idx ?? 0, url: pathname + search + hash };
    current = here;
    entries.set(here.idx, here);
    // A replace stays on the screen, such as a list writing its page into the URL: what it had carries over.
    if (type === 'REPLACE') {
      const mark = left && marks.get(left.key);
      if (mark && !marks.has(key)) marks.set(key, mark);
      if (waiting && waiting.key === left?.key) waiting.key = key;
      return;
    }
    const previous = left && entries.get(left.idx - 1);
    const from = type === 'POP' ? key : previous?.url === here.url ? previous.key : undefined;
    const mark = from === undefined ? undefined : marks.get(from);
    waiting = mark && !place(mark, before.current?.active) ? { key, mark } : undefined;
  }, [key]);
}

/**
 * For a screen whose content arrives after it mounts: call once that content is in, and a return still waiting for
 * its element takes focus there. Until then the screen's arrival target holds focus, so no frame shows it on `<body>`.
 */
export function restoreFocus() {
  if (!waiting || waiting.key !== current?.key) return;
  if (place(waiting.mark)) waiting = undefined;
}
