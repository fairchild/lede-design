import * as React from 'react';
import { useLinkComponent } from '../link';
import { cn } from '../cn';
import { focusLanding } from '../input-modality';

export interface PageHeaderProps {
  /** The screen's title: its one `<h1>`. */
  title: React.ReactNode;
  /** The page's takeaway in one line: what needs attention, or the state. Lead with the number. */
  summary?: React.ReactNode;
  /** A picture beside the title, such as an Avatar. The title already names it, so it's hidden from assistive tech. */
  leading?: React.ReactNode;
  /**
   * Back for nested screens: a link, such as `{ href: '/settings', label: 'Settings' }`, or a button that acts in
   * place, such as `{ label: 'Inbox', onClick: close }` for a detail that opened inside the page.
   */
  back?: { href: string; label: string } | { label: string; onClick: () => void };
  /**
   * Escape activates the back link, unless a layer above it took the key first: an open menu or dialog, or the focused
   * field when its text changed since it took focus. It doesn't see a form's other fields, so a form that must keep
   * Escape while it has unsaved changes turns this off while dirty, as ProfileFlow does. Default `true` when `back` is
   * set on a level 1 heading. A level 2 or 3 header sits inside another screen, so its Escape is off unless you turn it on.
   */
  backOnEscape?: boolean;
  /** One or two Buttons, at most one of them filled. */
  actions?: React.ReactNode;
  /**
   * Heading level: 1 for a screen's title, 2 for a header shown inside another page, or 3 for one under a heading of
   * that page, such as a chat message's author. Level 3 draws a smaller title. Default 1.
   */
  headingLevel?: 1 | 2 | 3;
  /**
   * Focus the heading on mount, and again each time this turns `true`, so people using a keyboard or a screen reader
   * land on the new screen. A screen that shows its list again after a detail, such as InboxFlow, sets it back to `true`
   * to land there. It yields when something else in the same commit moved focus inside its `<main>`. Default `true`.
   */
  focusOnMount?: boolean;
  /** The heading element, for moving focus here after an action removes the focused control. */
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}

/** Text the person typed into since it took focus: its Escape is theirs, as are a search field's while it holds text. */
const edits = new WeakMap<Element, string>();
const UNTYPED = new Set(['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset', 'image']);
const valueOf = (el: Element) =>
  (el instanceof HTMLInputElement && !UNTYPED.has(el.type)) || el instanceof HTMLTextAreaElement ? el.value : undefined;
function remember(el: Element | null) {
  const v = el ? valueOf(el) : undefined;
  if (el && v !== undefined) edits.set(el, v);
}
function fieldKeeps(el: Element) {
  const v = valueOf(el);
  if (v === undefined) return (el as HTMLElement).isContentEditable;
  return (edits.has(el) && edits.get(el) !== v) || ((el as HTMLInputElement).type === 'search' && v !== '');
}
function overlayOpen() {
  try { return document.querySelector(':modal, :popover-open') !== null; } catch { return false; }
}

type Layer = React.RefObject<(() => void) | undefined>;
/**
 * Active Escape handlers, latest last. A screen's PageHeader is the outermost layer by definition, so screens stack
 * below every other layer whatever order they activated in, and the top inner layer takes the press.
 */
const screens: Layer[] = [];
const inner: Layer[] = [];
const focused = (e: FocusEvent) => remember(e.target as Element);
function key(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || e.isComposing || overlayOpen()) return;
  if (e.target instanceof Element && fieldKeeps(e.target)) return;
  e.preventDefault();
  (inner.at(-1) ?? screens.at(-1))?.current?.();
}

function useEscapeLayer(onEscape: (() => void) | undefined, stack: Layer[]) {
  const run = React.useRef(onEscape);
  React.useLayoutEffect(() => { run.current = onEscape; });
  const on = onEscape !== undefined;
  // In the commit that shows the screen, so an Escape pressed as it appears already backs out of it.
  React.useLayoutEffect(() => {
    if (!on) return undefined;
    remember(document.activeElement);
    stack.push(run);
    if (screens.length + inner.length === 1) {
      document.addEventListener('focusin', focused, true);
      document.addEventListener('keydown', key);
    }
    return () => {
      stack.splice(stack.lastIndexOf(run), 1);
      if (screens.length + inner.length === 0) {
        document.removeEventListener('focusin', focused, true);
        document.removeEventListener('keydown', key);
      }
    };
  }, [on, stack]);
}

/**
 * Escape backs out one layer per press: calls `onEscape` for a press no layer above took. An open menu, `<dialog>` or
 * popover closes first, an IME composition keeps its Escape, and so does a field the person changed. A held key's
 * repeats back out of nothing more. The press goes to the caller of this hook activated most recently, and to the
 * screen's level 1 PageHeader only when no caller of this hook is active, so an inner layer backs out first even when
 * it opened in the same commit as the screen or the screen turned `backOnEscape` back on while it was open. A level 2
 * PageHeader with `backOnEscape` counts as one of these callers: it sits inside another screen. An inner layer that
 * handles Escape itself, such as SelectionBar, calls `preventDefault()` and this one leaves it. Pass `undefined` when
 * there's nothing to back out of. PageHeader uses it for `backOnEscape`.
 */
export function useBackOnEscape(onEscape: (() => void) | undefined) {
  useEscapeLayer(onEscape, inner);
}

const chevron = (
  <svg viewBox="0 0 8 14" width="8" height="14" fill="none" aria-hidden="true">
    <path d="M6.5 1.5 1.5 7l5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A `<header>` with the screen's `<h1>` and its one-line summary: the top level of progressive disclosure. */
export function PageHeader(props: PageHeaderProps) {
  const Link = useLinkComponent();
  const ref = React.useRef<HTMLHeadingElement>(null);
  const level = props.headingLevel ?? 1;
  const H = `h${level}` as 'h1';
  const backRef = React.useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  useEscapeLayer(props.back && (props.backOnEscape ?? H === 'h1') ? () => backRef.current?.click() : undefined, H === 'h1' ? screens : inner);
  React.useImperativeHandle(props.headingRef, () => ref.current as HTMLHeadingElement);
  // Where focus was as the screen rendered, before its commit moved it. Read in render, which runs before every effect
  // of the commit: StrictMode replays the effects, and a second run would read the move it should yield to.
  const [before] = React.useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  // At the end of the commit that mounts it, so a route change never paints a frame with focus on `<body>`, and after
  // every other move in that commit: an `autoFocus` control, a flow's own target or the app's restore on Back. When one
  // of those moved focus inside this `<main>`, it stays there.
  React.useLayoutEffect(() => {
    if (props.focusOnMount === false) return undefined;
    let live = true;
    queueMicrotask(() => {
      const heading = ref.current;
      // Only when this document already has focus: never pull focus into an embedded frame or a background tab.
      if (!live || !heading || !document.hasFocus()) return;
      const scope = heading.closest('main') ?? document.body;
      const active = document.activeElement;
      if (active !== before && active && active !== scope && scope.contains(active) && active.checkVisibility()) return;
      focusLanding(heading);
    });
    return () => { live = false; };
  }, [props.focusOnMount]);
  const text = (
    <div className="ld-page-header-text">
      <H ref={ref} tabIndex={-1} className={cn(level === 3 ? 'text-title-2' : 'text-large-title', 'ld-page-title')}>{props.title}</H>
      {props.summary ? <p className="ld-page-summary">{props.summary}</p> : null}
    </div>
  );
  return (
    <header className={cn('ld-page-header', props.className)}>
      {props.back && 'href' in props.back ? (
        <Link ref={backRef} className="ld-back" href={props.back.href}>{chevron}{props.back.label}</Link>
      ) : props.back ? (
        <button ref={backRef} type="button" className="ld-back" onClick={props.back.onClick}>{chevron}{props.back.label}</button>
      ) : null}
      <div className="ld-page-header-row">
        {props.leading ? <div className="ld-page-header-lead"><span aria-hidden="true">{props.leading}</span>{text}</div> : text}
        {props.actions ? <div className="ld-page-actions">{props.actions}</div> : null}
      </div>
    </header>
  );
}
