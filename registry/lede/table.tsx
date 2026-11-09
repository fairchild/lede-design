import * as React from 'react';
import { cn } from './cn';
import { useLinkComponent } from './link';

/** Exactly one way to name a table. An unlabeled table does not type-check. */
export type TableLabel =
  | { caption: React.ReactNode; 'aria-label'?: never; 'aria-labelledby'?: never }
  | { 'aria-label': string; caption?: never; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; caption?: never; 'aria-label'?: never };

/** Matches `aria-sort`. */
export type SortDirection = 'ascending' | 'descending';
/** Column width in px. `preferred` sets the `<col>`, and `min` is the narrowest it gets: past that, the table scrolls. */
export interface ColumnWidth { min?: number; preferred?: number; max?: number; }
type Align = 'start' | 'end' | 'center';

/**
 * A table that collapses to its caption (progressive disclosure). The caption becomes a button; `summary` is the
 * takeaway shown below the title, so a collapsed table still says what it holds. Open by default.
 *
 * The caption and the summary go inside that button, so both hold phrasing content with nothing interactive: text,
 * `<abbr>`, `<em>` or `<span lang>`, but no link, control, `[tabindex]` or block element. Development builds warn when
 * the rendered button holds one. Pass `open` from the first render or never, as with any controlled prop.
 */
export interface TableCollapsible {
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Only a captioned table can collapse: the caption is what stays, and what you press. */
type CollapsibleLabel =
  | { caption: React.ReactNode; collapsible: TableCollapsible | true; 'aria-label'?: never; 'aria-labelledby'?: never }
  | (TableLabel & { collapsible?: false });

export type TableRootProps = CollapsibleLabel & {
  children: React.ReactNode;
  /** Keep the leading column(s) marked `sticky` in view while the table scrolls sideways. */
  stickyFirstColumn?: boolean;
  /** Content is loading or refreshing (`aria-busy`). */
  busy?: boolean;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
};

/**
 * A real `<table>` in a box. When the table is wider than its box, the box scrolls and becomes a named, focusable
 * region so people using a keyboard can scroll it. Otherwise it only clips and adds no tab stop, and the header sticks
 * to the page. Truncated cells get their full text as a hover title, measured when the pointer arrives.
 *
 * The box takes the width its container gives it: it is an inline-size container, so column widths can be CSS. Put
 * it where a block fills the width. A shrink-to-fit parent (`inline-block`, `float`, `fit-content`, `flex: none`)
 * gives it no width of its own. A sticky first column takes its width from Table.Columns, or is measured after layout.
 */
// Bundlers replace `process.env.NODE_ENV` at build time. It's declared here so apps without Node's types type-check.
declare const process: { env: { NODE_ENV?: string } };

/** What a collapsible caption's toggle button can't hold: anything interactive, and block content. */
const NOT_IN_A_BUTTON = 'a, button, input, select, textarea, details, [tabindex], div, p, ul, ol, table, h1, h2, h3, h4, h5, h6';

function Root(props: TableRootProps) {
  const { children, stickyFirstColumn, busy, className, ref } = props;
  const captionId = React.useId();
  const collapsible = 'caption' in props && props.caption != null && props.collapsible
    ? (props.collapsible === true ? {} : props.collapsible)
    : undefined;
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  // Development only: a table that switches between controlled and uncontrolled keeps whichever state it had, so a
  // controlled close that stops passing `open` reopens the table. Warn once, as Disclosure does.
  const controlled = React.useRef(collapsible?.open !== undefined);
  const warned = React.useRef(false);
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production' || warned.current) return;
    if (controlled.current === (collapsible?.open !== undefined)) return;
    warned.current = true;
    console.error(`Table: \`collapsible.open\` switched from ${controlled.current ? 'controlled to uncontrolled' : 'uncontrolled to controlled'}. Pass \`open\` from the first render or never.`);
  });
  // Development only: the caption and summary render inside the toggle button, where interactive or block content is
  // invalid and fails axe's nested-interactive. The type can't tell `<abbr>` from `<a>`, so the rendered DOM is read.
  const nestedWarned = React.useRef(false);
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production' || nestedWarned.current) return;
    const found = toggleRef.current?.querySelector(NOT_IN_A_BUTTON);
    if (!found) return;
    nestedWarned.current = true;
    console.error(`Table: the collapsible caption “${toggleRef.current!.textContent}” holds <${found.localName}>, which can't sit inside its toggle button. Use text and phrasing elements such as <abbr>, <em> or <span lang>.`);
  });
  const [innerOpen, setInnerOpen] = React.useState(collapsible?.defaultOpen ?? true);
  const open = collapsible ? collapsible.open ?? innerOpen : true;
  const toggle = () => {
    const next = !open;
    if (collapsible?.open === undefined) setInnerOpen(next);
    collapsible?.onOpenChange?.(next);
  };
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  // Wider than its box: the box scrolls sideways (and, with a max height, down) and becomes a named, focusable region
  // so people using a keyboard can scroll it. Otherwise it is not a scroll container at all, so the header sticks to
  // the page.
  const [overflowing, setOverflowing] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    const table = el?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !table) return undefined;
    // The one read: the table's own layout, which the first paint needs anyway. Nothing is written back to the
    // DOM here (a write would dirty 500 rows' styles and force a second layout).
    const measure = () => setOverflowing(table.offsetWidth > el.clientWidth + 1);
    measure();
    // Sticky columns whose width CSS can't know (no Table.Columns, or an auto-width column): measured after layout,
    // from the observer, so focus stays clear of them. Table.Columns' value, set on the table, takes precedence.
    const stuck = () => {
      if (!stickyFirstColumn || table.style.getPropertyValue('--ld-table-stuck-w')) { el.style.removeProperty('--ld-table-stuck-w'); return; }
      let w = 0;
      el.querySelectorAll<HTMLElement>('thead .ld-table-sticky').forEach((c) => { w += c.offsetWidth; });
      if (el.style.getPropertyValue('--ld-table-stuck-w') !== `${w}px`) el.style.setProperty('--ld-table-stuck-w', `${w}px`);
    };
    const ro = new ResizeObserver(() => { measure(); stuck(); });
    ro.observe(el);
    ro.observe(table);
    return () => ro.disconnect();
  }, [stickyFirstColumn]);
  const setRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = el;
    },
    [ref],
  );
  const name =
    'caption' in props && props.caption != null
      ? { 'aria-labelledby': captionId }
      : props['aria-labelledby']
        ? { 'aria-labelledby': props['aria-labelledby'] }
        : { 'aria-label': props['aria-label'] };
  return (
    <div
      ref={setRef}
      className={cn('ld-table-scroll', stickyFirstColumn && 'ld-table-sticky-first', className)}
      data-overflow={overflowing || undefined}
      {...(overflowing ? { role: 'region', tabIndex: 0, ...name } : {})}
      onMouseMove={showFullText}
      onMouseLeave={clearFullText}
    >
      <table
        className="ld-table"
        aria-busy={busy || undefined}
        data-collapsed={open ? undefined : ''}
        {...('caption' in props && props.caption != null ? {} : name)}
      >
        {'caption' in props && props.caption != null ? (
          <caption id={captionId} className={cn('ld-table-caption', collapsible && 'ld-table-caption-toggle')}>
            {collapsible ? (
              // A real button in the caption: the whole caption is its hit target, and its name (title and summary)
              // is also the table's name, so a collapsed table still says what it holds.
              <button ref={toggleRef} type="button" className="ld-table-toggle" aria-expanded={open} onClick={toggle}>
                <span className="ld-table-toggle-text">
                  <span className="ld-table-toggle-title">{props.caption}</span>
                  {collapsible.summary != null ? <span className="ld-table-toggle-summary">{collapsible.summary}</span> : null}
                </span>
                <svg className="ld-table-toggle-chevron" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5 6.5 7l-5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : props.caption}
          </caption>
        ) : null}
        {children}
      </table>
    </div>
  );
}

/**
 * Full text of a clipped cell as a hover title. In a linked row the pointer is over the link's `::after`, so the cell
 * is found by position and the title goes on the row, whose title the browser shows for the link too.
 * At most one lookup per frame.
 */
const hover = new WeakMap<Element, { x: number; y: number; frame: number }>();
function showFullText(e: React.MouseEvent) {
  const root = e.currentTarget;
  const h = hover.get(root) ?? { x: 0, y: 0, frame: 0 };
  h.x = e.clientX; // the latest position in the frame wins
  h.y = e.clientY;
  hover.set(root, h);
  if (h.frame) return;
  h.frame = requestAnimationFrame(() => {
    h.frame = 0;
    const { x, y } = h;
    const row = document.elementFromPoint(x, y)?.closest('tr');
    if (!row) return;
    const cell = [...row.cells].find((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    const t = cell?.querySelector<HTMLElement>('.ld-table-trunc');
    const full = t && t.scrollWidth > t.clientWidth ? t.textContent ?? '' : '';
    if (full) row.title = full;
    else row.removeAttribute('title');
    root.querySelectorAll('tr[title]').forEach((r) => { if (r !== row) r.removeAttribute('title'); });
  });
}
function clearFullText(e: React.MouseEvent) {
  const h = hover.get(e.currentTarget);
  if (h?.frame) { cancelAnimationFrame(h.frame); h.frame = 0; }
  e.currentTarget.querySelectorAll('tr[title]').forEach((r) => r.removeAttribute('title'));
}

/** Width a column without a `width` keeps before the table scrolls. */
const AUTO_MIN = 96;

/**
 * `<colgroup>` for `table-layout: fixed`, in CSS alone: nothing is measured. Each column starts at its `min` and grows
 * toward `preferred` in proportion as the box has room, as a `calc()` on the box's width (`100cqi`: the scroll box is
 * an inline-size container). Columns without a width share what is left. Below the sum of the minimums, the table
 * keeps that width and its box scrolls. Widths go through the CSSOM, which a strict `style-src-attr` policy allows, and
 * are only written, so they cost no extra layout.
 * An entry is a `ColumnWidth`, a px number (fixed), a CSS length string (control columns), or `undefined`.
 */
function columnWidths(widths: ReadonlyArray<ColumnWidth | number | string | undefined>) {
  type Spec = { css: string } | { min: number; preferred: number } | { auto: true };
  const specs = widths.map((w): Spec =>
    typeof w === 'string' ? { css: w }
    : typeof w === 'number' ? { css: `${w}px` }
    : w ? { min: w.min ?? w.preferred ?? AUTO_MIN, preferred: Math.max(w.min ?? 0, Math.min(w.preferred ?? w.min ?? AUTO_MIN, w.max ?? Infinity)) }
    : { auto: true },
  );
  const base: string[] = [];
  let px = 0;
  let want = 0;
  for (const sp of specs) {
    if ('css' in sp) base.push(sp.css);
    else if ('auto' in sp) px += AUTO_MIN;
    else { px += sp.min; want += sp.preferred - sp.min; }
  }
  const sum = `(${[`${px}px`, ...base].join(' + ')})`;
  const cols = specs.map((sp) => {
    if ('css' in sp) return sp.css;
    if ('auto' in sp) return '';
    if (sp.preferred === sp.min || want === 0) return `${sp.min}px`;
    const k = (sp.preferred - sp.min) / want;
    return `clamp(${sp.min}px, calc(${sp.min}px + (100cqi - ${sum}) * ${+k.toFixed(6)}), ${sp.preferred}px)`;
  });
  return { cols, minWidth: `calc${sum}` };
}

/**
 * `sticky`: how many leading columns stick while the table scrolls sideways. Their summed width is written as
 * `--ld-table-stuck-w`, so anything scrolled into view stays clear of them (WCAG 2.4.11) without measuring.
 */
function Columns({ widths, sticky = 0 }: { widths: ReadonlyArray<ColumnWidth | number | string | undefined>; sticky?: number }) {
  const ref = React.useRef<HTMLTableColElement>(null);
  const key = JSON.stringify(widths);
  React.useLayoutEffect(() => {
    const group = ref.current;
    const table = group?.closest('table');
    if (!group || !table) return;
    const { cols, minWidth } = columnWidths(widths);
    Array.from(group.children as HTMLCollectionOf<HTMLTableColElement>).forEach((col, i) => { col.style.width = cols[i] ?? ''; });
    table.style.minWidth = minWidth;
    const stuck = cols.slice(0, sticky);
    // An auto-width sticky column has no width to add up: Table.Root measures them instead.
    if (sticky > 0 && stuck.every(Boolean)) table.style.setProperty('--ld-table-stuck-w', `calc(${stuck.join(' + ')})`);
    else table.style.removeProperty('--ld-table-stuck-w');
    // `widths` is represented by `key`.
  }, [key, sticky]);
  return <colgroup ref={ref}>{widths.map((_, i) => <col key={i} />)}</colgroup>;
}

function Caption({ className, ...rest }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('ld-table-caption', className)} {...rest} />;
}
function Head({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('ld-table-head', className)} {...rest} />;
}
function Body({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('ld-table-body', className)} {...rest} />;
}

export interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Styling only. The row's checkbox carries the selection for assistive tech, since table rows take no `aria-selected`. */
  selected?: boolean;
  /** The row holds a stretched Table.RowLink. */
  linked?: boolean;
}
function Row({ selected, linked, className, ...rest }: RowProps) {
  return <tr className={cn('ld-table-row', linked && 'ld-table-row-linked', className)} data-selected={selected || undefined} {...rest} />;
}

interface CellBase {
  align?: Align;
  /** One line with an ellipsis; the full text stays in the DOM, shows on hover and wraps while the cell has focus. */
  truncate?: boolean;
  /** Stays in view while the table scrolls sideways, with Table.Root's `stickyFirstColumn`. */
  sticky?: boolean;
}
const cellClass = (p: CellBase, base: string, className?: string) =>
  cn(base, p.align === 'end' && 'ld-table-end', p.align === 'center' && 'ld-table-center', p.sticky && 'ld-table-sticky', className);
const inner = (truncate: boolean | undefined, children: React.ReactNode) =>
  truncate ? <span className="ld-table-trunc">{children}</span> : children;

export interface HeaderCellProps extends CellBase, Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'align' | 'scope'> {
  /** The column's current sort. `aria-sort` is written only on the sorted column. */
  sort?: SortDirection | null;
}
function HeaderCell({ sort, align, truncate, sticky, className, children, ...rest }: HeaderCellProps) {
  return (
    <th
      scope="col"
      className={cellClass({ align, sticky }, 'ld-table-th', className)}
      aria-sort={sort ?? undefined}
      data-sort-direction={sort ?? undefined}
      {...rest}
    >
      {inner(truncate, children)}
    </th>
  );
}

export interface CellProps extends CellBase, Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'align'> {}
/** `<th scope="row">`: the cell that names its row. Exactly one per row. */
function RowHeader({ align, truncate, sticky, className, children, ...rest }: CellProps) {
  return (
    <th scope="row" className={cellClass({ align, sticky }, 'ld-table-rowheader', className)} {...(rest as React.ThHTMLAttributes<HTMLTableCellElement>)}>
      {inner(truncate, children)}
    </th>
  );
}
function Cell({ align, truncate, sticky, className, children, ...rest }: CellProps) {
  return (
    <td className={cellClass({ align, sticky }, 'ld-table-td', className)} {...rest}>
      {inner(truncate, children)}
    </td>
  );
}

export interface SortButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** This column's sort, or `null` when another column, or none, is sorted. */
  direction: SortDirection | null;
}
/**
 * The `<button>` inside a sortable header. Its description carries the direction too, for screen readers that
 * ignore `aria-sort` changes (TalkBack). Pair it with a live announcement of the new sort.
 */
function SortButton({ direction, className, children, ...rest }: SortButtonProps) {
  const id = React.useId();
  return (
    <>
      <button type="button" className={cn('ld-table-sort', className)} aria-describedby={direction ? id : undefined} {...rest}>
        <span className="ld-table-sort-label">{children}</span>
        <svg className="ld-table-sort-icon" viewBox="0 0 12 16" fill="none" aria-hidden="true">
          <path className="ld-table-sort-up" d="M3 6.5 6 3.5l3 3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          <path className="ld-table-sort-down" d="M3 9.5 6 12.5l3-3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {direction ? <span id={id} hidden>{`Sorted ${direction}`}</span> : null}
    </>
  );
}

export interface RowLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
}
/**
 * A real link in the row-header cell, stretched over its `<tr>` (`position: relative`) with `::after`. Other controls
 * in the row sit above it. There is no click handler on the row: middle-click, the context menu and links lists all
 * work.
 */
function RowLink({ className, ...rest }: RowLinkProps) {
  const Link = useLinkComponent();
  return <Link className={cn('ld-table-link', className)} data-row-link="" {...rest} />;
}

export const Table = { Root, Columns, Caption, Head, Body, Row, HeaderCell, RowHeader, Cell, SortButton, RowLink };
