import * as React from 'react';
import { createStateStore, type InferActionParams, type Spec, type StateStore } from '@json-render/core';
import { JSONUIProvider, Renderer, type ComponentRenderer } from '@json-render/react';
import { focusLanding } from '../input-modality';
import { catalog, functions, type CatalogAction } from './catalog';
import { ActionHeld, DrillScope, FieldChecks, registry, SpecHeadingLevel, SpecKeys, specKeys, SpecRoot, SpecShown, type HeldAction } from './registry';

export type { HeldAction } from './registry';

/**
 * The catalog's actions, each called with its params, typed from its schema, when a spec runs it. Add an action to the
 * catalog and it's here.
 */
export type SpecHandlers = { [K in CatalogAction]?: (params: InferActionParams<typeof catalog, K>) => void | Promise<void> };
type State = Record<string, unknown>;

export interface SpecViewProps {
  /** The spec so far, such as `specFromParts(message.parts)` while a reply streams. */
  spec: Spec | null;
  /** True while the spec streams: elements still on their way draw nothing until they arrive. */
  streaming?: boolean;
  /** The level of the spec's title. Default 2, under a page's h1; a chat message's author heading makes it 3. */
  headingLevel?: 2 | 3;
  /**
   * Called when the spec runs a catalog action. Read through a ref, so each call reaches the latest, and an inline
   * object is fine. One that returns a promise holds the actions after it until it settles. An action whose params read a field that fails its check doesn't run, so its handler isn't called.
   */
  handlers?: SpecHandlers;
  /**
   * Drawn for an element whose type the registry doesn't have, such as one from a newer catalog. Without it, that
   * element draws nothing and json-render logs a warning.
   */
  fallback?: ComponentRenderer;
  /** Called with the screen's whole state after each change, such as for a chat to send what the person entered. */
  onStateChange?: (state: State) => void;
  /**
   * Called when an action doesn't run because fields it reads fail their checks, with the action and each field's name
   * and the error it shows. Read through a ref, so an inline function is fine.
   */
  onActionHeld?: (held: HeldAction) => void;
}

/**
 * The screen a spec describes, drawn with Lede. It draws once the spec's root element arrives, and state that arrives
 * after it, as a model streams it, fills in what's drawn: a list drawn with repeat gains a row per item. The person can
 * use the screen while the rest streams in.
 */
export function SpecView({ spec, ...props }: SpecViewProps) {
  return spec?.elements[spec.root] ? <Screen spec={spec} {...props} /> : null;
}

const actionNames = Object.keys(catalog.data.actions) as CatalogAction[];

function Screen({ spec, streaming = false, headingLevel = 2, handlers, fallback, onStateChange, onActionHeld }: SpecViewProps & { spec: Spec }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [{ store, sync }] = React.useState(() => specStore(spec.state));
  React.useLayoutEffect(() => sync(spec.state), [spec.state, sync]);
  React.useEffect(() => {
    if (!onStateChange) return;
    onStateChange(store.getSnapshot());
    return store.subscribe(() => onStateChange(store.getSnapshot()));
  }, [store, onStateChange]);
  const held = React.useRef(onActionHeld);
  React.useLayoutEffect(() => { held.current = onActionHeld; });
  const [report] = React.useState(() => (h: HeldAction) => held.current?.(h));
  // json-render keeps the handlers it mounts with, so it gets these, which call the latest.
  const latest = React.useRef(handlers);
  React.useLayoutEffect(() => { latest.current = handlers; });
  const [dispatch] = React.useState(() => Object.fromEntries(actionNames.map((name) => [name, (params: Record<string, unknown>) =>
    (latest.current?.[name] as ((p: Record<string, unknown>) => void | Promise<void>) | undefined)?.(params)])));
  useKeptFocus(root);
  useTokensCheck(root);
  const keys = React.useMemo(() => specKeys(spec), [spec]);
  return (
    <SpecHeadingLevel.Provider value={headingLevel}>
      <SpecRoot.Provider value={root}>
        <div ref={root}>
          <JSONUIProvider registry={registry} functions={functions} store={store} handlers={dispatch}>
            <FieldChecks>
              <ActionHeld.Provider value={report}>
                <SpecShown.Provider value={spec}>
                  <SpecKeys.Provider value={keys}>
                    <DrillScope>
                      <Renderer spec={spec} registry={registry} loading={streaming} fallback={fallback} />
                    </DrillScope>
                  </SpecKeys.Provider>
                </SpecShown.Provider>
              </ActionHeld.Provider>
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

/**
 * Where focus goes when the control that held it leaves: the control that took its place, a neighbor, the title, or
 * the screen itself when it shows none of those.
 */
function landing(records: MutationRecord[], gone: Element, root: HTMLElement): HTMLElement {
  const added = records.flatMap((r) => [...r.addedNodes]).filter((n) => root.contains(n)).map(focusable).find(Boolean);
  if (added) return added;
  const removal = records.find((r) => [...r.removedNodes].some((n) => n === gone || n.contains(gone)));
  const neighbor = removal && (along(removal.nextSibling, 'nextSibling') ?? along(removal.previousSibling, 'previousSibling'));
  if (neighbor && root.contains(neighbor)) return neighbor;
  const title = root.querySelector<HTMLElement>('.ld-page-title');
  if (title) return title;
  root.tabIndex = -1;
  return root;
}

/**
 * A press can take away the control that made it: a row action that hides its row, or a button that hides itself and
 * shows another. Focus then moves to the control that took its place, the next or previous control beside it, the
 * screen's title or the screen, so it never falls to `<body>`. A control in a menu or other popup counts as the one that opened it.
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
