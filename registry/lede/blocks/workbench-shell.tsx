import * as React from 'react';
import { Button } from '../button';
import { SegmentedControl } from '../segmented-control';
import { cn } from '../cn';
import { focusLanding } from '../input-modality';
import { useStackedPanes } from './master-detail';

type WorkbenchSide = 'start' | 'end';
type WorkbenchRegion = WorkbenchSide | 'main';

export interface WorkbenchPanel {
  /** Names the landmark, its top-bar toggle, its divider and its switcher option ("Files"). */
  label: string;
  content: React.ReactNode;
  /** Width in px, from 200 to 480. Default 280. */
  defaultWidth?: number;
}

export interface WorkbenchShellProps {
  /** Product name, wordmark or a link out, at the start of the top bar. */
  brand: React.ReactNode;
  /** The screen's title, in the top bar: its one `<h1>`, which stays exposed whichever panels are showing. */
  title: React.ReactNode;
  /** The start panel, on the left, a named `<nav>`: what can be opened. On narrow screens, following a link here shows main. */
  start: WorkbenchPanel;
  /** The end panel, on the right, a named `<aside>`: what supports the work. */
  end: WorkbenchPanel;
  /** The center panel, inside `<main>`. */
  children: React.ReactNode;
  /** Names the center panel and its switcher option. Default `'Content'`. */
  mainLabel?: string;
  /** One or two controls at the end of the top bar. */
  actions?: React.ReactNode;
  /**
   * Remembers the widths asked for and the collapsed state under this `localStorage` key. Read on mount and whenever
   * the key changes. Tabs don't sync: each saves its own changes, and the last to save wins.
   */
  storageKey?: string;
  className?: string;
}

type Widths = Record<WorkbenchSide, number>;
type Sides = Record<WorkbenchSide, { width: number; collapsed: boolean }>;
/** The widths asked for, which are kept and saved, and the drawn widths a resize holds still in a window as wide as the one it was made in. */
interface Layout { sides: Sides; held: { room: number; widths: Partial<Widths> } | null }

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
/** The narrowest `<main>` can be, its dividers included. */
const MIN_MAIN = 400;
const STEP = 16;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));
const otherSide = (side: WorkbenchSide): WorkbenchSide => (side === 'start' ? 'end' : 'start');

function restore(key: string, sides: Sides): Sides {
  let saved: Partial<Sides> | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch { /* unreadable or unavailable: keep the defaults */ }
  const side = (name: WorkbenchSide) => {
    const { width, collapsed } = saved?.[name] ?? {};
    return { width: Number.isFinite(width) ? (width as number) : sides[name].width, collapsed: collapsed === true };
  };
  return { start: side('start'), end: side('end') };
}

/** The widths to draw: those asked for, each giving up its share when main needs the room back. */
function fit(want: Widths, room: number): Widths {
  const total = want.start + want.end;
  if (total === 0 || total <= room) return want;
  const floor = { start: want.start && MIN_WIDTH, end: want.end && MIN_WIDTH };
  const start = Math.max(floor.start, Math.min(Math.round((want.start * room) / total), room - floor.end));
  return { start, end: want.end && Math.max(floor.end, room - start) };
}

/** The widths drawn: those asked for, held where a resize in this window left them, then fitted to the room. */
function draw({ sides, held }: Layout, room: number): Widths {
  const hold = held?.room === room ? held.widths : {};
  const wanted = (side: WorkbenchSide) => (sides[side].collapsed ? 0 : Math.min(clamp(sides[side].width, MIN_WIDTH, MAX_WIDTH), hold[side] ?? Infinity));
  return fit({ start: wanted('start'), end: wanted('end') }, room);
}

const widest = (drawn: Widths, side: WorkbenchSide, room: number) => clamp(room - drawn[otherSide(side)], MIN_WIDTH, MAX_WIDTH);

/** A click that follows a link in this tab: its `target` is unset or `_self`, and no modifier key is held. */
function followsHere(event: React.MouseEvent) {
  const link = (event.target as Element).closest('a');
  return !!link && (!link.target || link.target === '_self') && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

function PanelIcon({ side, open }: { side: WorkbenchSide; open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <path d={side === 'start' ? 'M8 3.5v13H5A2.5 2.5 0 0 1 2.5 14V6A2.5 2.5 0 0 1 5 3.5z' : 'M12 3.5v13h3a2.5 2.5 0 0 0 2.5-2.5V6A2.5 2.5 0 0 0 15 3.5z'} fill={open ? 'currentColor' : 'none'} />
    </svg>
  );
}

interface SplitterProps {
  side: WorkbenchSide;
  label: string;
  controls: string;
  /** The panel's drawn width. 0 while collapsed. */
  value: number;
  max: number;
  collapsed: boolean;
  onResize: (width: number) => void;
  onToggle: () => void;
  onDragging: (dragging: boolean) => void;
}

/**
 * A WAI-ARIA window splitter: drag it, or use the arrow keys, Home and End. Enter collapses and restores its panel. It
 * lives in `<main>`, the one region that always stays, so it can bring a collapsed panel back. One pointer drags it at
 * a time: another finger on it does nothing, and only lifting the first one ends the drag.
 */
function Splitter({ side, label, controls, value, max, collapsed, onResize, onToggle, onDragging }: SplitterProps) {
  const grab = React.useRef<{ pointer: number; x: number; width: number } | null>(null);
  const [grow, shrink] = side === 'start' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
  return (
    <div
      role="separator"
      tabIndex={0}
      className="ld-wb-sep"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-controls={controls}
      aria-valuenow={value}
      aria-valuemin={collapsed ? 0 : MIN_WIDTH}
      aria-valuemax={max}
      aria-valuetext={collapsed ? 'Collapsed' : `${value} pixels wide`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || (event.key === grow && collapsed)) onToggle();
        else if (event.key === 'Home') onResize(MIN_WIDTH);
        else if (event.key === 'End') onResize(max);
        else if (event.key === grow) onResize(value + STEP);
        else if (event.key === shrink) { if (!collapsed) onResize(value - STEP); }
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || grab.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        grab.current = { pointer: event.pointerId, x: event.clientX, width: value };
        onDragging(true);
      }}
      onPointerMove={(event) => {
        if (grab.current?.pointer !== event.pointerId) return;
        const moved = event.clientX - grab.current.x;
        const width = grab.current.width + (side === 'start' ? moved : -moved);
        if (!collapsed || width >= MIN_WIDTH) onResize(width);
      }}
      onLostPointerCapture={(event) => {
        if (grab.current?.pointer !== event.pointerId) return;
        grab.current = null;
        onDragging(false);
      }}
    />
  );
}

/**
 * Page layout for tools, as in an IDE: a top bar, with the skip link, over a `<nav>`, a `<main>` and an `<aside>` side
 * by side that fill the window. Each panel scrolls alone and the page doesn't. Side panels collapse from the top bar
 * and resize from their dividers, and main keeps a usable width whatever they do. Narrow screens show one panel at a
 * time, chosen with a SegmentedControl, and the rest are `display: none`. Router-agnostic: links in the panels are the
 * caller's.
 *
 * Left-to-right only: the start panel is on the left, and the dividers' keys and drags are physical.
 */
export function WorkbenchShell(props: WorkbenchShellProps) {
  const { start, end, mainLabel = 'Content' } = props;
  const id = React.useId();
  const ids = { start: `${id}start`, end: `${id}end` };
  const panels = { start, end };
  const stacked = useStackedPanes();

  const [layout, setLayout] = React.useState<Layout>(() => ({
    sides: {
      start: { width: start.defaultWidth ?? 280, collapsed: false },
      end: { width: end.defaultWidth ?? 280, collapsed: false },
    },
    held: null,
  }));
  const { sides } = layout;
  const [room, setRoom] = React.useState(Infinity);
  const [dragging, setDragging] = React.useState(false);
  const [active, setActive] = React.useState<WorkbenchRegion>('main');

  const root = React.useRef<HTMLDivElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const nav = React.useRef<HTMLElement>(null);
  const content = React.useRef<HTMLElement>(null);
  const aside = React.useRef<HTMLElement>(null);

  // After the first render, which has to match a server's, and before the first paint.
  React.useLayoutEffect(() => {
    if (props.storageKey) setLayout((now) => ({ sides: restore(props.storageKey!, now.sides), held: null }));
  }, [props.storageKey]);

  React.useLayoutEffect(() => {
    const el = root.current!;
    const measure = () => setRoom(el.clientWidth - MIN_MAIN);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // In the commit that mounts it, so a route change never paints a frame with focus on `<body>`.
  React.useLayoutEffect(() => {
    // Only when this document already has focus: never pull focus into an embedded frame or a background tab.
    if (document.hasFocus()) focusLanding(heading.current);
  }, []);

  // Whatever hid the focused element, focus lands in the panel on show instead of falling back to the document. The
  // browser may let go of that element before this commit (`lost`) or after it, depending on when it lays out.
  const lost = React.useRef(false);
  const shown = stacked ? active : 'main';
  React.useLayoutEffect(() => {
    const focused = document.activeElement;
    const hiddenHere = !!focused && !!root.current?.contains(focused) && !focused.getClientRects().length;
    if (hiddenHere || (lost.current && focused === document.body)) ({ start: nav, main: content, end: aside })[shown].current?.focus({ preventScroll: true });
    lost.current = false;
  }, [shown, stacked, sides.start.collapsed, sides.end.collapsed]);

  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!props.storageKey || dragging || !touched.current) return;
    try {
      localStorage.setItem(props.storageKey, JSON.stringify(sides));
    } catch { /* unavailable: the layout lasts for this visit */ }
  }, [props.storageKey, sides, dragging]);

  const drawn = draw(layout, room);
  const change = (next: (now: Layout) => Layout) => {
    touched.current = true;
    setLayout(next);
  };
  // Worked out from `now`, so resizes batched into one render build on each other. In a squeezed window the width asked
  // for moves by the step taken, so it survives a wider window. Both panels are then held as drawn, or `fit()` would
  // rebalance the pair against this divider.
  const resize = (side: WorkbenchSide, target: number) =>
    change((now) => {
      const before = draw(now, room);
      const width = Math.round(clamp(target, MIN_WIDTH, widest(before, side, room)));
      const asked = now.sides[side];
      const squeeze = asked.collapsed ? 0 : clamp(asked.width, MIN_WIDTH, MAX_WIDTH) - before[side];
      const other = otherSide(side);
      return {
        sides: { ...now.sides, [side]: { width: width === MIN_WIDTH ? MIN_WIDTH : clamp(width + squeeze, MIN_WIDTH, MAX_WIDTH), collapsed: false } },
        held: { room, widths: before[other] ? { [side]: width, [other]: before[other] } : { [side]: width } },
      };
    });
  const toggle = (side: WorkbenchSide) =>
    change((now) => ({ ...now, sides: { ...now.sides, [side]: { ...now.sides[side], collapsed: !now.sides[side].collapsed } } }));

  const hidden = (region: WorkbenchRegion) => (stacked ? active !== region : region !== 'main' && sides[region].collapsed);
  const sized = (side: WorkbenchSide) => ({ '--ld-wb-width': `${drawn[side]}px` }) as React.CSSProperties;
  const toggleButton = (side: WorkbenchSide) => (
    <Button
      className="ld-wb-toggle"
      variant="plain"
      icon={<PanelIcon side={side} open={!sides[side].collapsed} />}
      aria-label={`${panels[side].label} panel`}
      aria-expanded={!sides[side].collapsed}
      aria-controls={ids[side]}
      onClick={() => toggle(side)}
    />
  );
  const splitter = (side: WorkbenchSide) => (
    <Splitter
      side={side}
      label={panels[side].label}
      controls={ids[side]}
      value={drawn[side]}
      max={widest(drawn, side, room)}
      collapsed={sides[side].collapsed}
      onResize={(width) => resize(side, width)}
      onToggle={() => toggle(side)}
      onDragging={setDragging}
    />
  );

  return (
    <div
      ref={root}
      className={cn('ld-wb', props.className)}
      onBlur={(event) => { lost.current = !event.relatedTarget && !event.target.getClientRects().length; }}
    >
      <header className="ld-wb-bar">
        <div className="ld-wb-row">
          {toggleButton('start')}
          <div className="ld-wb-brand">{props.brand}</div>
          <h1 ref={heading} tabIndex={-1} className="ld-wb-title">{props.title}</h1>
          {/* After the `<h1>`, which takes focus on load, so the next Tab reaches it. It draws at the window's corner. */}
          <a className="ld-skip" href="#main" onClick={() => setActive('main')}>Skip to content</a>
          {props.actions ? <div className="ld-wb-actions">{props.actions}</div> : null}
          {toggleButton('end')}
        </div>
        <div className="ld-wb-switch">
          <SegmentedControl
            block
            label="Panel"
            options={[{ value: 'start', label: start.label }, { value: 'main', label: mainLabel }, { value: 'end', label: end.label }]}
            value={active}
            onValueChange={(region) => setActive(region as WorkbenchRegion)}
          />
        </div>
      </header>
      <div className="ld-wb-body">
        <nav
          ref={nav}
          id={ids.start}
          className="ld-wb-panel"
          aria-label={start.label}
          tabIndex={-1}
          hidden={hidden('start')}
          style={sized('start')}
          onClick={(event) => { if (followsHere(event)) setActive('main'); }}
        >
          {start.content}
        </nav>
        {/* The skip link lands on `<main>`, and focus goes on to the content, past the start divider. */}
        <main
          id="main"
          className="ld-wb-main"
          aria-label={`${mainLabel} panel`}
          tabIndex={-1}
          onFocus={(event) => { if (event.target === event.currentTarget) content.current?.focus(); }}
        >
          {splitter('start')}
          <section ref={content} className="ld-wb-content" aria-label={mainLabel} tabIndex={0} hidden={hidden('main')}>{props.children}</section>
          {hidden('main') ? <p className="ld-sr-only">{mainLabel} isn’t showing. Choose it under Panel, at the top of the page.</p> : null}
          {splitter('end')}
        </main>
        <aside ref={aside} id={ids.end} className="ld-wb-panel" aria-label={end.label} tabIndex={0} hidden={hidden('end')} style={sized('end')}>
          {end.content}
        </aside>
      </div>
    </div>
  );
}
