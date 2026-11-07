import * as React from 'react';
import { createStateStore, type Spec, type StateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { focusLanding } from '../input-modality';
import { functions, type CatalogAction } from './catalog';
import { FieldChecks, registry, SpecHeadingLevel, SpecRoot } from './registry';

/** The catalog's actions, each called with its params when a spec runs it. Add an action to the catalog and it's here. */
export type SpecHandlers = Partial<Record<CatalogAction, (params: Record<string, unknown>) => void>>;
type State = Record<string, unknown>;

export interface SpecViewProps {
  /** The spec so far, such as `specFromParts(message.parts)` while a reply streams. */
  spec: Spec | null;
  /** True while the spec streams: elements still on their way draw nothing until they arrive. */
  streaming?: boolean;
  /** The level of the spec's title. Default 2, under a page's h1; a chat message's author heading makes it 3. */
  headingLevel?: 2 | 3;
  /**
   * Called when the spec runs a catalog action. Keep them stable: json-render reads them once, when the view mounts.
   * An action whose params read a field that fails its check doesn't run, so its handler isn't called.
   */
  handlers?: SpecHandlers;
  /** Called with the screen's whole state after each change, such as for a chat to send what the person entered. */
  onStateChange?: (state: State) => void;
}

/**
 * The screen a spec describes, drawn with Lede. It draws once the spec's root element arrives, and state that arrives
 * after it, as a model streams it, fills in what's drawn: a list drawn with repeat gains a row per item. The person can
 * use the screen while the rest streams in.
 */
export function SpecView({ spec, ...props }: SpecViewProps) {
  return spec?.elements[spec.root] ? <Screen spec={spec} {...props} /> : null;
}

function Screen({ spec, streaming = false, headingLevel = 2, handlers, onStateChange }: SpecViewProps & { spec: Spec }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [{ store, sync }] = React.useState(() => specStore(spec.state));
  React.useLayoutEffect(() => sync(spec.state), [spec.state, sync]);
  React.useEffect(() => {
    if (!onStateChange) return;
    onStateChange(store.getSnapshot());
    return store.subscribe(() => onStateChange(store.getSnapshot()));
  }, [store, onStateChange]);
  useKeptFocus(root);
  useTokensCheck(root);
  return (
    <SpecHeadingLevel.Provider value={headingLevel}>
      <SpecRoot.Provider value={root}>
        <div ref={root}>
          <JSONUIProvider registry={registry} functions={functions} store={store} handlers={handlers as Record<string, (params: Record<string, unknown>) => void>}>
            <FieldChecks>
              <Renderer spec={spec} registry={registry} loading={streaming} />
            </FieldChecks>
          </JSONUIProvider>
        </div>
      </SpecRoot.Provider>
    </SpecHeadingLevel.Provider>
  );
}

/** Each value in a state object by its JSON Pointer. Objects open up; arrays, empty objects and the rest are values. */
function leaves(state: State, prefix = ''): Array<[string, unknown]> {
  return Object.entries(state).flatMap(([key, value]) => {
    const path = `${prefix}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    const open = value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    return open ? leaves(value as State, path) : [[path, value] as [string, unknown]];
  });
}
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The screen's state. A spec's state arrives as it streams; each value the person changes, by typing, a press or an
 * action, keeps their change, and the stream no longer writes it or anything under it. A value the stream writes above
 * one of theirs, such as a list that gains a row after they switched on an earlier one, still arrives, with their
 * change written back on top. `sync` takes the spec's state so far.
 */
export function specStore(initial: State = {}): { store: StateStore; sync: (state?: State) => void } {
  const inner = createStateStore(initial);
  const touched = new Set<string>();
  let sent = new Map(leaves(initial));
  const theirs = (path: string) => [...touched].some((t) => path === t || path.startsWith(`${t}/`));
  const under = (path: string) => [...touched].filter((t) => t.startsWith(`${path}/`));
  const store: StateStore = {
    ...inner,
    set: (path, value) => { touched.add(path); inner.set(path, value); },
    update: (updates) => { for (const path of Object.keys(updates)) touched.add(path); inner.update(updates); },
  };
  const sync = (state: State = {}) => {
    const next = new Map(leaves(state));
    const changed = [...next].filter(([path, value]) => !same(sent.get(path), value) && !theirs(path));
    sent = next;
    const kept = changed.flatMap(([path]) => under(path)).map((t) => [t, inner.get(t)] as const);
    if (changed.length) inner.update(Object.fromEntries([...changed, ...kept]));
  };
  return { store, sync };
}

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';
/** The first control in a node that a person can reach: shown, and not in an inert or hidden part, such as a row's swipe actions. */
const focusable = (node: Node | null) =>
  node instanceof HTMLElement
    ? [node, ...node.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => el.matches(FOCUSABLE) && !el.closest('[inert], [aria-hidden="true"]') && el.checkVisibility({ visibilityProperty: true })) ?? null
    : null;
const along = (node: Node | null, step: 'nextSibling' | 'previousSibling') => {
  for (let at = node; at; at = at[step]) {
    const found = focusable(at);
    if (found) return found;
  }
  return null;
};

/** Where focus goes when the control that held it leaves: the control that took its place, a neighbor, or the title. */
function landing(records: MutationRecord[], gone: Element, root: HTMLElement) {
  const added = records.flatMap((r) => [...r.addedNodes]).filter((n) => root.contains(n)).map(focusable).find(Boolean);
  if (added) return added;
  const removal = records.find((r) => [...r.removedNodes].some((n) => n === gone || n.contains(gone)));
  const neighbor = removal && (along(removal.nextSibling, 'nextSibling') ?? along(removal.previousSibling, 'previousSibling'));
  return neighbor && root.contains(neighbor) ? neighbor : root.querySelector<HTMLElement>('.ld-page-title');
}

/**
 * A press can take away the control that made it: a row action that hides its row, or a button that hides itself and
 * shows another. Focus then moves to the control that took its place, the next or previous control beside it, or the
 * screen's title, so it never falls to `<body>`. A control in a menu or other popup counts as the one that opened it.
 */
function useKeptFocus(root: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const screen = root.current;
    if (!screen) return;
    let last: Element | null = null;
    let away: Element | null = null;
    let next: HTMLElement | null = null;
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Element;
      if (screen.contains(target)) [last, away] = [target, null];
      else away = target;
      next = null;
    };
    const observer = new MutationObserver((records) => {
      if (!last || last.isConnected) return;
      next ??= landing(records, last, screen);
      if (away?.isConnected) return;
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost && next?.isConnected) focusLanding(next);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', onFocus);
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', onFocus);
    };
  }, [root]);
}

// Bundlers replace `process.env.NODE_ENV` in the browser; where nothing does, there is no `process` and no warning.
declare const process: { env: Record<string, string | undefined> };
const development = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();
let warned = false;
/** In development, a console warning when Lede's tokens aren't on the page, where the screen would draw unstyled. */
function useTokensCheck(root: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!development || warned || !root.current) return;
    if (getComputedStyle(root.current).getPropertyValue('--radius-step').trim()) return;
    warned = true;
    console.warn('SpecView: Lede’s tokens aren’t on the page, so the screen draws unstyled. Import Lede’s CSS in your app’s CSS, such as @import "./styles/lede/index.css".');
  }, [root]);
}
