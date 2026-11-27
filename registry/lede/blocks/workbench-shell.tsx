import * as React from 'react';
import { Button } from '../button';
import { SegmentedControl } from '../segmented-control';
import { cn } from '../cn';
import { focusLanding } from '../input-modality';
import { useStackedPanes } from '../stacked-panes';

type WorkbenchSide = 'start' | 'end';

export interface WorkbenchPanel {
  /** Names the landmark, its top-bar toggle, its divider and its switcher option ("Files"). */
  label: string;
  content: React.ReactNode;
  /** Width in px, from 200 to 480. Default 280. */
  defaultWidth?: number;
  /**
   * Whether the panel is open beside main on a wide screen. Unset, the shell keeps it, open at first and then as its
   * toggle and divider leave it, or as `storageKey` restores it. Set, it wins over both.
   */
  open?: boolean;
  /** Called with the panel's next open state when its toggle, divider or a drag opens or collapses it. */
  onOpenChange?: (open: boolean) => void;
}

/** A region of the shell: on a narrow screen, the one panel showing. */
export type WorkbenchRegion = 'start' | 'main' | 'end';

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
  /**
   * The panel showing on a narrow screen, where one shows at a time. Unset, the shell keeps it: main at first, then
   * what the switcher picks, and main again when a link in the start panel is followed or the skip link is used.
   */
  panel?: WorkbenchRegion;
  /** Called with the next panel when the switcher, a followed link in the start panel or the skip link changes it. */
  onPanelChange?: (panel: WorkbenchRegion) => void;
  /** One or two controls at the end of the top bar. */
  actions?: React.ReactNode;
  /**
   * Remembers the widths asked for, the collapsed state and the widths drawn after the last resize under this
   * `localStorage` key. Read on mount and whenever
   * the key changes. Tabs don't sync: each saves its own changes, and the last to save wins.
   */
  storageKey?: string;
  /** The `<main>`'s id, which the skip link targets. Default `'main'`; give each shell its own when a page has two. */
  mainId?: string;
  /**
   * Moves focus to the `<h1>` on mount, as a route change to this screen should. Default `true`. `false` leaves focus
   * where it is, for a shell that mounts inside a screen that already handles focus.
   */
  focusOnMount?: boolean;
  className?: string;
}

type Widths = Record<WorkbenchSide, number>;
type Sides = Record<WorkbenchSide, { width: number; collapsed: boolean }>;
/**
 * The widths asked for, and the drawn widths a resize holds still in a window no wider than the one it was made in.
 * Both are saved.
 */
interface Layout { sides: Sides; held: { room: number; widths: Partial<Widths> } | null }

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
/** The narrowest `<main>` can be, its dividers included. */
const MIN_MAIN = 400;
const STEP = 16;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));
const otherSide = (side: WorkbenchSide): WorkbenchSide => (side === 'start' ? 'end' : 'start');

const finite = (n: unknown): n is number => Number.isFinite(n);

function restore(key: string, sides: Sides): Layout {
  let saved: (Partial<Sides> & { held?: { room?: unknown; widths?: Partial<Record<WorkbenchSide, unknown>> } }) | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch { /* unreadable or unavailable: keep the defaults */ }
  const side = (name: WorkbenchSide) => {
    const { width, collapsed } = saved?.[name] ?? {};
    return { width: Number.isFinite(width) ? (width as number) : sides[name].width, collapsed: collapsed === true };
  };
  const { room, widths } = saved?.held ?? {};
  const hold: Partial<Widths> = {};
  for (const name of ['start', 'end'] as const) if (finite(widths?.[name])) hold[name] = clamp(widths[name], MIN_WIDTH, MAX_WIDTH);
  const held = finite(room) && room > 0 && Object.keys(hold).length ? { room, widths: hold } : null;
  return { sides: { start: side('start'), end: side('end') }, held };
}

/** The widths to draw: those asked for, each giving up its share when main needs the room back. */
function fit(want: Widths, room: number): Widths {
  const total = want.start + want.end;
  if (total === 0 || total <= room) return want;
  const floor = { start: want.start && MIN_WIDTH, end: want.end && MIN_WIDTH };
  const start = Math.max(floor.start, Math.min(Math.round((want.start * room) / total), room - floor.end));
  return { start, end: want.end && Math.max(floor.end, room - start) };
}

/**
 * The widths drawn: those asked for, held where a resize left them, then fitted to the room. In a window no wider than
 * the one the resize was made in, the held widths cap those asked for. In a wider one, each panel grows from its held
 * width toward the width asked for, sharing the extra room by how far each has to go, so a 1px wider window moves
 * nothing by more than a pixel.
 */
function draw({ sides, held }: Layout, room: number): Widths {
  const want = (side: WorkbenchSide) => (sides[side].collapsed ? 0 : clamp(sides[side].width, MIN_WIDTH, MAX_WIDTH));
  const wanted = { start: want('start'), end: want('end') };
  if (!held) return fit(wanted, room);
  const from = (side: WorkbenchSide) => (wanted[side] ? Math.min(wanted[side], held.widths[side] ?? Infinity) : 0);
  const base = { start: from('start'), end: from('end') };
  if (room <= held.room) return fit(base, room);
  const gap = (side: WorkbenchSide) => wanted[side] - base[side];
  const total = gap('start') + gap('end');
  const extra = room - held.room;
  if (extra >= total) return fit(wanted, room);
  const start = base.start + Math.round((gap('start') * extra) / total);
  return fit({ start, end: base.end + Math.round((gap('end') * extra) / total) }, room);
}

const widest = (drawn: Widths, side: WorkbenchSide, room: number) => clamp(room - drawn[otherSide(side)], MIN_WIDTH, MAX_WIDTH);

/** A click that follows a link in this tab: its `target` is unset or `_self`, it doesn't download, and no modifier key is held. */
function followsHere(event: React.MouseEvent) {
  const link = (event.target as Element).closest('a');
  return !!link && (!link.target || link.target === '_self') && !link.hasAttribute('download')
    && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
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
  const grab = React.useRef<{ pointer: number; x: number; width: number; sign: number } | null>(null);
  // The keys and drags are physical: the panel drawn on the left grows rightward. The page's direction is read as each
  // key or drag starts, so a page that changes it later is followed.
  const onLeft = (el: Element) => (side === 'start') !== (getComputedStyle(el).direction === 'rtl');
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
        // A key held with Alt, Control or Command is a shortcut, such as a browser's Back, and isn't for the divider.
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const [grow, shrink] = onLeft(event.currentTarget) ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
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
        grab.current = { pointer: event.pointerId, x: event.clientX, width: value, sign: onLeft(event.currentTarget) ? 1 : -1 };
        onDragging(true);
      }}
      onPointerMove={(event) => {
        if (grab.current?.pointer !== event.pointerId) return;
        const moved = event.clientX - grab.current.x;
        const width = grab.current.width + grab.current.sign * moved;
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
 * The start panel is on the left, or on the right in a right-to-left page, and the dividers' arrow keys and drags follow
 * where each panel is drawn. The server's markup shows main alone on a narrow screen, as the first render after it does.
 */
export function WorkbenchShell(props: WorkbenchShellProps) {
  const { start, end, mainLabel = 'Content', mainId = 'main', focusOnMount = true } = props;
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
  // An `open` prop wins over the shell's own collapsed state, here and wherever a layout is drawn.
  const opened = { start: start.open, end: end.open };
  const effective = (l: Layout): Layout => {
    const side = (name: WorkbenchSide) => (opened[name] === undefined ? l.sides[name] : { ...l.sides[name], collapsed: !opened[name] });
    return { ...l, sides: { start: side('start'), end: side('end') } };
  };
  // Kept as one object while nothing changes, as the storage effect below runs when it does.
  const sides = React.useMemo(() => effective(layout).sides, [layout.sides, opened.start, opened.end]);
  const [room, setRoom] = React.useState(Infinity);
  const [dragging, setDragging] = React.useState(false);
  // False in the server's markup, whose narrow-screen CSS then hides the side panels, as the first render here does.
  const [mounted, setMounted] = React.useState(false);
  const [innerActive, setInnerActive] = React.useState<WorkbenchRegion>('main');
  const active = props.panel ?? innerActive;
  const setActive = (region: WorkbenchRegion) => {
    if (region === active) return;
    if (props.panel === undefined) setInnerActive(region);
    props.onPanelChange?.(region);
  };

  const root = React.useRef<HTMLDivElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const nav = React.useRef<HTMLElement>(null);
  const content = React.useRef<HTMLElement>(null);
  const aside = React.useRef<HTMLElement>(null);

  // After the first render, which has to match a server's, and before the first paint.
  React.useLayoutEffect(() => {
    if (props.storageKey) setLayout((now) => restore(props.storageKey!, now.sides));
  }, [props.storageKey]);

  React.useLayoutEffect(() => {
    const el = root.current!;
    const measure = () => setRoom(el.clientWidth - MIN_MAIN);
    measure();
    setMounted(true);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // In the commit that mounts it, so a route change never paints a frame with focus on `<body>`.
  React.useLayoutEffect(() => {
    // Only when this document already has focus: never pull focus into an embedded frame or a background tab.
    if (focusOnMount && document.hasFocus()) focusLanding(heading.current);
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
      localStorage.setItem(props.storageKey, JSON.stringify(layout.held ? { ...sides, held: layout.held } : sides));
    } catch { /* unavailable: the layout lasts for this visit */ }
  }, [props.storageKey, sides, layout.held, dragging]);

  // A panel its parent opens or collapses on its own lets go of the held widths, as a toggle does. One it opens or
  // collapses because the toggle or divider asked already has its layout, held widths included.
  const was = React.useRef(opened);
  React.useLayoutEffect(() => {
    const own = (side: WorkbenchSide) =>
      was.current[side] !== opened[side] && opened[side] !== undefined && opened[side] === layout.sides[side].collapsed;
    if (own('start') || own('end')) setLayout((now) => ({ ...now, held: null }));
    was.current = opened;
  }, [opened.start, opened.end]);
  // What a resize has already asked a collapsed panel's parent, so a drag asks once and each key press asks again.
  const asked = React.useRef<Partial<Record<WorkbenchSide, boolean>>>({});
  React.useLayoutEffect(() => { if (!dragging) asked.current = {}; });

  const drawn = draw(effective(layout), room);
  const change = (next: (now: Layout) => Layout) => {
    touched.current = true;
    setLayout(next);
  };
  // Worked out from `now`, so resizes batched into one render build on each other. In a squeezed window the width asked
  // for moves by the step taken, so it survives a wider window. Both panels are then held as drawn, or `fit()` would
  // rebalance the pair against this divider.
  // A resize opens a collapsed panel, as a drag or an arrow key away from the edge does.
  const resize = (side: WorkbenchSide, target: number) => {
    if (sides[side].collapsed && !asked.current[side]) {
      asked.current[side] = true;
      panels[side].onOpenChange?.(true);
    }
    change((now) => {
      const before = draw(effective(now), room);
      const width = Math.round(clamp(target, MIN_WIDTH, widest(before, side, room)));
      const asked = effective(now).sides[side];
      const squeeze = asked.collapsed ? 0 : clamp(asked.width, MIN_WIDTH, MAX_WIDTH) - before[side];
      const other = otherSide(side);
      return {
        sides: { ...now.sides, [side]: { width: width === MIN_WIDTH ? MIN_WIDTH : clamp(width + squeeze, MIN_WIDTH, MAX_WIDTH), collapsed: false } },
        held: { room, widths: before[other] ? { [side]: width, [other]: before[other] } : { [side]: width } },
      };
    });
  };
  const toggle = (side: WorkbenchSide) => {
    const open = sides[side].collapsed;
    // A collapse or restore lets go of the held widths: they were drawn beside the other panel as it was.
    change((now) => ({ held: null, sides: { ...now.sides, [side]: { ...now.sides[side], collapsed: !open } } }));
    panels[side].onOpenChange?.(open);
  };

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
      data-mounted={mounted || undefined}
      onBlur={(event) => { lost.current = !event.relatedTarget && !event.target.getClientRects().length; }}
    >
      <header className="ld-wb-bar">
        <div className="ld-wb-row">
          {toggleButton('start')}
          <div className="ld-wb-brand">{props.brand}</div>
          <h1 ref={heading} tabIndex={-1} className="ld-wb-title">{props.title}</h1>
          {/* After the `<h1>`, which takes focus on load, so the next Tab reaches it. It draws at the window's corner. */}
          <a className="ld-skip" href={`#${mainId}`} onClick={() => setActive('main')}>Skip to content</a>
          {props.actions ? <div className="ld-wb-actions">{props.actions}</div> : null}
          {toggleButton('end')}
        </div>
        <div className="ld-wb-switch">
          <SegmentedControl
            block
            label="Panel"
            options={[{ value: 'start', label: start.label }, { value: 'main', label: mainLabel }, { value: 'end', label: end.label }]}
            // The server's markup shows main alone on a narrow screen, so its switcher says so until the script runs.
            value={mounted ? active : 'main'}
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
          id={mainId}
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
