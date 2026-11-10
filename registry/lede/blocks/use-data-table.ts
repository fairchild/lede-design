import * as React from 'react';
import { createSortedRowModel, rowSortingFeature, tableFeatures, useTable } from '@tanstack/react-table';
import { announce } from '@react-aria/live-announcer';
import type { ColumnWidth, SortDirection } from '../table';
import type { Noun } from './selection-bar';

// ---------------------------------------------------------------------------------------------------------------
// Public types. Lede's own: TanStack types never cross this boundary, so a TanStack major is absorbed in here.
// ---------------------------------------------------------------------------------------------------------------

export type { SortDirection };
export type SortItem = { columnId: string; direction: SortDirection };

/** Everything a saved view stores. Later versions add optional keys; none is ever renamed or removed. */
export type TableView = {
  /** Zero or one item: the table sorts by one column. */
  sort: SortItem[];
  /**
   * What the rows are narrowed to, such as a search term or a status: your own keys and plain JSON values, which the
   * table doesn't interpret and a view can carry into a URL. A new filter, compared by its JSON, clears the selection,
   * so an action never reaches rows that aren't shown. A selection whose content changes in the same render as the
   * filter is kept, so a saved view can be restored. In server mode the filter is part of the view the fetchers are
   * given and of each page's cache key, so put every filter here: one closed over in `fetchRows` starts no new visit
   * and keeps the old filter's cached pages. In client mode it does nothing to the rows: filter `rows` yourself. The
   * same filter written another way (key order, `{}` for none) counts as new and refetches.
   */
  filter?: TableFilter;
};
/** A filter's values: plain JSON, so a view serializes. */
export type FilterValue = string | number | boolean | null | readonly (string | number | boolean | null)[];
export type TableFilter = { readonly [key: string]: FilterValue | undefined };
/** What changed in the view. Later versions add members, so keep a default branch when you switch on `type`. */
export type ViewChange = { type: 'sort'; sort: SortItem[] };

/**
 * Clearing a row's checkbox after "Select all N" adds it to `except`. When rows are deleted on the server, update a
 * controlled selection with `removeFromSelection`: a deleted row leaves `ids` and `except` alike. An uncontrolled
 * selection does this itself: a row that leaves `rows` while the view, the page and `state.rows` stay the same was
 * deleted, and it leaves the selection. A row that leaves with a new page or view stays selected.
 */
export type Selection =
  | { kind: 'ids'; ids: ReadonlySet<string> }
  | { kind: 'all-matching'; except: ReadonlySet<string> };

/**
 * What the table is showing and doing, as independent parts: whose rows, whether more are coming, what failed and
 * when the rows were fetched. Every field is optional: `{}` is a table showing its own, settled rows.
 * - `rows`: whose rows are on screen. `'current'`, the default, are this view's. `'previous'` are the last view's, kept
 *   while this one loads so the layout doesn't jump. `'none'` means nothing is on screen yet: until rows or a failure
 *   arrive, the table shows its loading skeleton, never its empty state.
 * - `fetching`: rows are on the way. With current rows the table shows "Updating…" and stays usable. Otherwise it is
 *   `aria-busy`. useServerRows reports it from the first render, before its first fetch starts.
 * - `since`: when the rows on screen were fetched. Shown when refreshing them failed.
 * - `failure`: the last request failed. `scope` says what failed: `'load'` (this view's or page's rows: an alert, and
 *   previous rows are hidden so they never pass as this view's), `'refresh'` (rows on screen could not be refreshed:
 *   a quiet notice with their age), or `'more'` (the next page: an alert, and Load more retries).
 */
export interface TableState {
  rows?: 'current' | 'previous' | 'none';
  fetching?: boolean;
  since?: Date;
  failure?: { message?: string; retry: () => void; scope: 'load' | 'refresh' | 'more' };
}

/** A count, or a lower bound while the exact figure is computed ("50 of 1,000+"). */
export type Total = number | { atLeast: number };

export function isSelected(selection: Selection, id: string): boolean {
  return selection.kind === 'ids' ? selection.ids.has(id) : !selection.except.has(id);
}

/**
 * The selection after rows were deleted on the server. A deleted row is no longer a member of anything: it leaves
 * an explicit selection, and it leaves an `all-matching` selection's `except` too. Adding it to `except` instead would
 * count it twice once the server's new total arrives (the total already excludes it).
 */
export function removeFromSelection(selection: Selection, deleted: Iterable<string>): Selection {
  const gone = new Set(deleted);
  if (selection.kind === 'ids') {
    if (![...gone].some((id) => selection.ids.has(id))) return selection;
    return { kind: 'ids', ids: new Set([...selection.ids].filter((id) => !gone.has(id))) };
  }
  if (![...gone].some((id) => selection.except.has(id))) return selection;
  return { kind: 'all-matching', except: new Set([...selection.except].filter((id) => !gone.has(id))) };
}

export type Column<Row> = {
  /** Stable: views key on it. */
  id: string;
  /** Plain-text name, used for announcements, card labels and checkbox names. */
  label: string;
  /** Richer header content. Defaults to `label`. */
  header?: React.ReactNode;
  /** Defaults to the formatted `value`. */
  cell?: (row: Row) => React.ReactNode;
  /** One accessor for client sort and card text. */
  value?: (row: Row) => string | number | Date | null;
  /** Client sort override, ascending order. */
  compare?: (a: Row, b: Row) => number;
  /**
   * Offers a sort on this column. In client mode the table sorts by `compare`, else by `value`, so the column needs one
   * of them. In server mode the server sorts: the table reports the new view through `onViewChange` and needs neither.
   */
  sortable?: boolean;
  /** `'end'` also turns on tabular figures. */
  align?: 'start' | 'end' | 'center';
  width?: ColumnWidth;
  /** One line with an ellipsis; the full text on hover and focus. */
  truncate?: boolean;
  /**
   * Card layout slot. Omit to leave the column out of cards. `'title'` leads the card (the row header does when no
   * column takes it) while checkboxes and menus stay named by the row header, so a title that repeats across rows still
   * leaves each row a unique name. When a `'title'` column leads, give the row header a numbered slot, so the card
   * shows the name its checkbox and menu carry. 1, 2 and 3 make the line under the title: each field keeps to one line,
   * and one wider than the card wraps inside itself. `'status'` sits beside the text, where a long status narrows it,
   * or under the text in a card narrower than 440px.
   */
  card?: 'title' | 'status' | 1 | 2 | 3;
};

/**
 * Define columns once, at module scope, or in `useMemo` when they depend on props. Rows are memoized against the
 * array: the same array means a sort or a selection re-renders no row, or only the row that changed.
 */
export function defineColumns<Row>(columns: Column<Row>[]): Column<Row>[] {
  return columns;
}

// Bundlers replace `process.env.NODE_ENV` at build time. It's declared here so apps without Node's types type-check.
declare const process: { env: { NODE_ENV?: string } };

/**
 * Development only: warn once when a memo input of the table gets a new identity on several renders in a row, which
 * silently re-renders every row. The usual cause is an inline array or function in the caller's render.
 */
export function useStableInput(value: unknown, name: string, fix: string) {
  const seen = React.useRef<{ value: unknown; changes: number; warned: boolean }>({ value, changes: 0, warned: false });
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const s = seen.current;
    if (value === s.value) { s.changes = 0; return; }
    s.value = value;
    s.changes += 1;
    if (s.changes >= 3 && !s.warned) {
      s.warned = true;
      console.warn(`DataTable: \`${name}\` is a new ${typeof value === 'function' ? 'function' : 'array'} on every render, so every row re-renders. ${fix}`);
    }
  });
}

export type Paging =
  | { kind: 'load-more'; hasMore: boolean; onLoadMore: () => void }
  | { kind: 'pages'; page: number; pageCount: number; onPageChange: (page: number) => void };

/** The data props shared by `useDataTable` and `DataTable`. */
export interface DataTableOptions<Row> {
  /**
   * Keep this array stable: `defineColumns` at module scope, or `useMemo`. Rows are memoized against it, so a new array
   * on every render re-renders every row and rebuilds the column model. Development builds warn when it does.
   */
  columns: Column<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  /** The column whose cells are `<th scope="row">`. */
  rowHeader: string;
  noun: Noun;
  /** Controlled view. */
  view?: TableView;
  /** Uncontrolled starting view. */
  defaultView?: TableView;
  onViewChange?: (view: TableView, change: ViewChange) => void;
  /** `'client'` sorts `rows`, and `'server'` shows them as given and reports view changes. Default `'client'`. */
  processing?: 'client' | 'server';
  selectionMode?: 'none' | 'multiple';
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  total?: Total;
  /**
   * Paging, rendered by DataTable. The hook reads its page, so rows that leave with a page change stay selected: pass it
   * to `useDataTable` too when you render your own pager.
   */
  paging?: Paging;
  /**
   * What the table is showing and doing (see `TableState`). While `rows` is `'previous'`, the rows on screen are the
   * last view's, so selection is inert: checking them, the page or "Select all" does nothing until this view's rows
   * arrive.
   */
  state?: TableState;
  /** A BCP 47 tag, such as `'en-US'`, for formatting and client-mode sorting. Default: the browser's locale. */
  locale?: string;
}

export interface HeaderModel<Row> {
  column: Column<Row>;
  sortable: boolean;
  /** This column's sort, or `null`. */
  sort: SortDirection | null;
  isRowHeader: boolean;
}
export interface RowModel<Row> {
  id: string;
  original: Row;
  /** Position in display order. */
  index: number;
}
export interface SelectionModel {
  enabled: boolean;
  value: Selection;
  /** For SelectionBar. */
  count: Total;
  isSelected: (id: string) => boolean;
  /** `range` (Shift) selects every row between the last toggled row and this one. Stable identity. */
  toggle: (id: string, selected: boolean, options?: { range?: boolean }) => void;
  /** The header checkbox: rows on this page. */
  page: 'none' | 'some' | 'all';
  togglePage: () => void;
  /** Every page row is selected and more rows match: offer "Select all N". */
  canSelectAllMatching: boolean;
  /** The rows on screen are the last view's (`state.rows` is `'previous'`): render the checkboxes disabled. */
  inert: boolean;
  selectAllMatching: () => void;
  clear: () => void;
}
export interface DataTableModel<Row> {
  view: TableView;
  headers: HeaderModel<Row>[];
  /** Visible rows, in display order. */
  rows: RowModel<Row>[];
  rowHeader: Column<Row>;
  /** Sort by a column. Without a direction it toggles (ascending first). Announces the new sort politely. */
  sortBy: (columnId: string, direction?: SortDirection) => void;
  selection: SelectionModel;
  /** A column's value as display text: the row header's names checkboxes and menus. */
  text: (row: Row, columnId?: string) => string;
}

// ---------------------------------------------------------------------------------------------------------------

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const EMPTY_VIEW: TableView = { sort: [] };
const NO_IDS: Selection = { kind: 'ids', ids: new Set() };
type LocaleIntl = { collator: Intl.Collator; date: Intl.DateTimeFormat; number: Intl.NumberFormat };
const intlByLocale = new Map<string | undefined, LocaleIntl>();
/** A locale's collator and formatters, built once and shared by every table that uses it. */
function intl(locale: string | undefined): LocaleIntl {
  let f = intlByLocale.get(locale);
  if (!f) {
    f = {
      collator: new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }),
      date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
      number: new Intl.NumberFormat(locale),
    };
    intlByLocale.set(locale, f);
  }
  return f;
}

/** Default display text for a value, in `locale` (default: the browser's). */
export function formatValue(v: string | number | Date | null | undefined, locale?: string): string {
  if (v == null) return '';
  if (v instanceof Date) return intl(locale).date.format(v);
  if (typeof v === 'number') return intl(locale).number.format(v);
  return v;
}
const sortKey = (v: string | number | Date | null | undefined) => (v == null ? undefined : v instanceof Date ? v.getTime() : v);
const lowerBound = (t: Total | undefined) => (t == null ? undefined : typeof t === 'number' ? t : t.atLeast);
const members = (s: Selection) => (s.kind === 'ids' ? s.ids : s.except);
function sameSelection(a: Selection, b: Selection | undefined): boolean {
  if (a === b) return true;
  if (!b || a.kind !== b.kind) return false;
  const x = members(a), y = members(b);
  return x.size === y.size && [...x].every((id) => y.has(id));
}

export function useDataTable<Row>(options: DataTableOptions<Row>): DataTableModel<Row> {
  const { columns, rows, getRowId, rowHeader, processing = 'client', selectionMode = 'none', total, locale } = options;
  useStableInput(columns, 'columns', 'Define them with defineColumns() at module scope, or in useMemo.');

  // View: controlled or not.
  const [innerView, setInnerView] = React.useState<TableView>(options.defaultView ?? EMPTY_VIEW);
  const view = options.view ?? innerView;

  // TanStack column definitions, rebuilt only when the columns, the locale or the processing change. The server sorts
  // in server mode, so a column needs no accessor there to be sortable.
  const { collator } = intl(locale);
  const canSort = React.useCallback(
    (c: Column<Row>) => !!c.sortable && (processing === 'server' || !!(c.value || c.compare)),
    [processing],
  );
  const defs = React.useMemo(
    () =>
      columns.map((c) => ({
        id: c.id,
        accessorFn: (r: Row) => sortKey(c.value?.(r)),
        enableSorting: canSort(c),
        // Missing values sort last, except for compare-only columns: their accessor is always `undefined`, and TanStack
        // would then skip the comparator entirely.
        sortUndefined: c.compare ? (false as const) : ('last' as const),
        sortFn: c.compare
          ? (a: { original: Row }, b: { original: Row }) => c.compare!(a.original, b.original)
          : (a: { getValue: (id: string) => unknown }, b: { getValue: (id: string) => unknown }, id: string) => {
              const x = a.getValue(id) as string | number;
              const y = b.getValue(id) as string | number;
              return typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
            },
      })),
    [columns, collator, canSort],
  );
  // TanStack sorts again when the sorting state or the rows change, but not the comparator. A new collator gives the
  // sorting state a new identity, so a locale change re-sorts the rows on screen.
  const sorting = React.useMemo(
    () => view.sort.map((s) => ({ id: s.columnId, desc: s.direction === 'descending' })),
    [view.sort, collator],
  );
  const getId = React.useRef(getRowId);
  getId.current = getRowId; // read by TanStack while it builds the row model, during render
  const table = useTable(
    {
      features,
      // The defs are structurally TanStack column defs; the cast keeps the generic Row out of TanStack's inference.
      columns: defs as never,
      // Row is any caller type; TanStack wants an object type. Rows pass through untouched.
      data: rows as unknown as Array<Record<string, unknown>>,
      getRowId: (r: Record<string, unknown>) => getId.current(r as unknown as Row),
      state: { sorting },
      onSortingChange: () => undefined, // sorting is driven by `view`
      manualSorting: processing === 'server',
      enableMultiSort: false,
      enableSortingRemoval: false,
    },
    (s) => s.sorting,
  );
  const tsRows = table.getRowModel().rows;
  const visible = React.useMemo<RowModel<Row>[]>(
    () => tsRows.map((r, index) => ({ id: r.id, original: r.original as unknown as Row, index })),
    [tsRows],
  );

  const byId = React.useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const headerColumn = byId.get(rowHeader);
  if (!headerColumn) throw new Error(`useDataTable: rowHeader "${rowHeader}" is not a column id`);
  const text = React.useCallback(
    (row: Row, columnId?: string) => {
      const c = columnId ? byId.get(columnId) : headerColumn;
      const v = c?.value?.(row);
      return v == null && c === headerColumn ? getId.current(row) : formatValue(v, locale);
    },
    [byId, headerColumn, locale],
  );

  // Latest values for event handlers, written after commit (never during render).
  const viewRef = React.useRef(view);
  const onViewChangeRef = React.useRef(options.onViewChange);
  React.useLayoutEffect(() => {
    viewRef.current = view;
    onViewChangeRef.current = options.onViewChange;
  });
  const sortBy = React.useCallback(
    (columnId: string, direction?: SortDirection) => {
      const col = byId.get(columnId);
      if (!col) return;
      const current = viewRef.current.sort.find((s) => s.columnId === columnId)?.direction;
      const next: SortDirection = direction ?? (current === 'ascending' ? 'descending' : 'ascending');
      const sort: SortItem[] = [{ columnId, direction: next }];
      const nextView: TableView = { ...viewRef.current, sort };
      if (!options.view) setInnerView(nextView);
      onViewChangeRef.current?.(nextView, { type: 'sort', sort });
      // VoiceOver on macOS and TalkBack don't announce `aria-sort` changes, and this does. It clears after a second,
      // so the same sort twice is announced twice.
      announce(`Sorted by ${col.label}, ${next}`, 'polite', 1000);
    },
    [byId, options.view],
  );
  const headers = React.useMemo<HeaderModel<Row>[]>(
    () =>
      columns.map((c) => ({
        column: c,
        sortable: canSort(c),
        sort: view.sort.find((s) => s.columnId === c.id)?.direction ?? null,
        isRowHeader: c.id === rowHeader,
      })),
    [columns, view.sort, rowHeader, canSort],
  );

  // Selection: Lede's own model (`ids`, or `all-matching` with `except`). TanStack's `Record<id, true>` can't express
  // "all matching except these", and Shift ranges come from the native checkbox's click.
  const [innerSel, setInnerSel] = React.useState<Selection>(NO_IDS);
  const selection = options.selection ?? innerSel;
  // While the rows on screen are the last view's, checking one would select a row this view may not have: nothing
  // selects.
  const inert = options.state?.rows === 'previous';
  const latest = React.useRef({ selection, visible, controlled: !!options.selection, onChange: options.onSelectionChange, inert });
  React.useLayoutEffect(() => {
    latest.current = { selection, visible, controlled: !!options.selection, onChange: options.onSelectionChange, inert };
  });
  const anchor = React.useRef<string | null>(null);
  const commit = React.useCallback((next: Selection) => {
    if (!latest.current.controlled) setInnerSel(next);
    latest.current.onChange?.(next);
  }, []);
  // A selection belongs to the filter it was made under: its count is figured against the total in view, and an action
  // goes to its rows. So a new filter clears it, checked rows included, and no action reaches rows that aren't shown.
  // A selection that changed in the same render as the filter came with it (a saved view being restored), so it stays.
  // Changed by content: an app that builds its selection during render passes a new object every time.
  const filterKey = JSON.stringify(view.filter ?? null);
  const lastFilter = React.useRef(filterKey);
  const lastSelectionProp = React.useRef(options.selection);
  React.useLayoutEffect(() => {
    const setWithIt = options.selection !== undefined && !sameSelection(options.selection, lastSelectionProp.current);
    lastSelectionProp.current = options.selection;
    if (lastFilter.current === filterKey) return;
    lastFilter.current = filterKey;
    anchor.current = null;
    if (setWithIt) return;
    const sel = latest.current.selection;
    if (sel.kind === 'ids' && sel.ids.size === 0) return;
    commit(NO_IDS);
  });
  // A row that leaves `rows` while the view, the page and `state.rows` stay the same was deleted: it leaves an
  // uncontrolled selection, so the bar's count and the next action skip it. A row that leaves with a new page or view
  // is elsewhere and stays selected, as do rows that change while the last view's are on screen. A controlled
  // selection is the caller's: `removeFromSelection` does the same there.
  const shows = options.state?.rows ?? 'current';
  const place = JSON.stringify([view.sort, view.filter ?? null, options.paging?.kind === 'pages' ? options.paging.page : null]);
  const lastRows = React.useRef<{ ids: ReadonlySet<string>; place: string; current: boolean } | null>(null);
  React.useLayoutEffect(() => {
    const ids = new Set(visible.map((r) => r.id));
    const was = lastRows.current;
    lastRows.current = { ids, place, current: shows === 'current' };
    if (!was || !was.current || shows !== 'current' || was.place !== place || latest.current.controlled) return;
    const gone = [...was.ids].filter((id) => !ids.has(id));
    if (gone.length === 0) return;
    const next = removeFromSelection(latest.current.selection, gone);
    if (next !== latest.current.selection) commit(next);
  }, [visible, place, shows, commit]);
  const setMany = React.useCallback(
    (ids: readonly string[], on: boolean) => {
      if (latest.current.inert) return;
      const sel = latest.current.selection;
      if (sel.kind === 'ids') {
        const next = new Set(sel.ids);
        for (const id of ids) if (on) next.add(id); else next.delete(id);
        commit({ kind: 'ids', ids: next });
      } else {
        const next = new Set(sel.except);
        for (const id of ids) if (on) next.delete(id); else next.add(id);
        commit({ kind: 'all-matching', except: next });
      }
    },
    [commit],
  );
  const toggle = React.useCallback(
    (id: string, on: boolean, opts?: { range?: boolean }) => {
      if (latest.current.inert) return; // before the anchor: an ignored toggle mustn't move a later Shift range's start
      const order = latest.current.visible;
      const from = opts?.range && anchor.current != null ? order.findIndex((r) => r.id === anchor.current) : -1;
      const to = from >= 0 ? order.findIndex((r) => r.id === id) : -1;
      anchor.current = id;
      if (from >= 0 && to >= 0) {
        const [a, b] = from < to ? [from, to] : [to, from];
        setMany(order.slice(a, b + 1).map((r) => r.id), on);
      } else setMany([id], on);
    },
    [setMany],
  );
  const isRowSelected = React.useCallback((id: string) => isSelected(selection, id), [selection]);
  let onPage = 0;
  for (const r of visible) if (isRowSelected(r.id)) onPage++;
  const page = onPage === 0 ? 'none' : onPage === visible.length ? 'all' : 'some';
  const bound = lowerBound(total);
  const count: Total =
    selection.kind === 'ids'
      ? selection.ids.size
      : total == null
        ? Math.max(0, visible.length - selection.except.size)
        : typeof total === 'number'
          ? Math.max(0, total - selection.except.size)
          : { atLeast: Math.max(0, total.atLeast - selection.except.size) };

  const selectionModel: SelectionModel = {
    enabled: selectionMode === 'multiple',
    value: selection,
    count,
    isSelected: isRowSelected,
    toggle,
    page,
    togglePage: () => setMany(visible.map((r) => r.id), page !== 'all'),
    canSelectAllMatching: !inert && selection.kind === 'ids' && page === 'all' && bound != null && bound > visible.length,
    selectAllMatching: () => { if (!latest.current.inert) commit({ kind: 'all-matching', except: new Set() }); },
    inert,
    clear: () => { anchor.current = null; commit({ kind: 'ids', ids: new Set() }); },
  };

  return { view, headers, rows: visible, rowHeader: headerColumn, sortBy, selection: selectionModel, text };
}
