import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Table, type TableLabel } from '../table';
import { Checkbox } from '../checkbox';
import { RowActionItems, type RowAction } from '../list';
import { Button } from '../button';
import { cn } from '../cn';
import { ThemeScope } from '../theme-provider';
import { DataRow, SKELETON_ROWS } from './data-table-row';
import { Cards } from './data-table-cards';
import { Pager } from './data-table-pager';
import { SelectionBar, formatCount, type SelectionAction } from './selection-bar';
import {
  useDataTable, formatValue, useStableInput,
  type DataTableOptions, type Selection, type TableState, type Total, type Paging,
} from './use-data-table';

/** A bulk action in SelectionBar. It receives the selection, so uncontrolled tables can act on it too. */
export type BulkAction = Omit<SelectionAction, 'onSelect'> & { onSelect: (selection: Selection) => void };

export type DataTableProps<Row> = TableLabel &
  DataTableOptions<Row> & {
    bulkActions?: BulkAction[];
    /** Each row's link. Rendered in the row-header cell and stretched over the row. */
    rowHref?: (row: Row) => string;
    /**
     * A visible ••• menu per row, read when it renders, so it reflects current state. Disabled actions stay listed
     * with their reason. Keep it stable with `useCallback`: the card layout's memoized rows take it as an input.
     */
    rowActions?: (row: Row) => RowAction[];
    /** Opt-in touch swipe to reveal the row actions in the card layout. The menu is always there too. */
    swipeActions?: boolean;
    /** Shown when there are no rows. Default: "No {noun.other}". */
    emptyState?: React.ReactNode;
    total?: Total;
    paging?: Paging;
    /** Below `narrowBelow`: `'cards'` renders a list of cards, and `'scroll'` keeps the table with a sticky first column. Default `'scroll'`. */
    narrow?: 'cards' | 'scroll';
    /** Container width in px below which `narrow` applies. Default 560: about where five columns stop fitting. */
    narrowBelow?: number;
    stickyFirstColumn?: boolean;
    className?: string;
  };

/** Default width in px below which `narrow` applies, measured on the table's own box. */
const NARROW_BELOW = 560;
const NO_STATE: TableState = {};

/**
 * Lede's data table: a real `<table>` with sortable headers, row links, selection with "Select all N", row actions,
 * loading, empty, error and stale states, paging and a card layout for narrow containers. Data stays with the caller:
 * with `processing="server"` the rows are shown as given, and view changes are reported for the caller to fetch.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const model = useDataTable(props);
  const { noun, columns, rowHeader, rowActions, rowHref, paging, locale } = props;
  useStableInput(rowActions, 'rowActions', 'Wrap it in useCallback, or define it at module scope.');
  const state = props.state ?? NO_STATE;
  const total = props.total;
  const root = React.useRef<HTMLDivElement>(null);

  // Layout by container width. The row with focus keeps it across a switch.
  const [narrow, setNarrow] = React.useState(false);
  const narrowRef = React.useRef(false);
  const pendingFocus = React.useRef<string | null>(null);
  const narrowModeRef = React.useRef(props.narrow);
  const narrowBelow = props.narrowBelow ?? NARROW_BELOW;
  React.useLayoutEffect(() => {
    // A runtime change of `narrow` must not use a focus target recorded long ago.
    if (narrowModeRef.current !== props.narrow) pendingFocus.current = null;
    narrowModeRef.current = props.narrow;
  }, [props.narrow]);
  React.useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const measure = () => {
      const next = el.clientWidth > 0 && el.clientWidth < narrowBelow;
      if (next === narrowRef.current) return;
      narrowRef.current = next;
      // Remember the row with focus before its element is replaced by the other layout. Only cards replace it:
      // with `narrow="scroll"` the table stays, focus stays where it is and nothing is left over for later.
      if (narrowModeRef.current === 'cards') {
        const active = document.activeElement;
        const row = active && el.contains(active) ? active.closest('[data-row-id]') : null;
        pendingFocus.current = row?.getAttribute('data-row-id') ?? null;
      }
      setNarrow(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [narrowBelow]);
  const layout = narrow && props.narrow === 'cards' ? 'cards' : 'table';
  const sticky = !!props.stickyFirstColumn || (narrow && props.narrow !== 'cards');
  React.useLayoutEffect(() => {
    const id = pendingFocus.current;
    pendingFocus.current = null;
    if (!id || !root.current) return;
    rowTarget(root.current.querySelector(`[data-row-id="${CSS.escape(id)}"]`))?.focus();
  }, [layout]);

  const label: TableLabel = 'caption' in props && props.caption != null
    ? { caption: props.caption }
    : props['aria-labelledby'] ? { 'aria-labelledby': props['aria-labelledby'] } : { 'aria-label': props['aria-label'] as string };

  // One menu per table, opened by a Base UI trigger in each row (detached triggers share the menu, its focus
  // handling, dismissal and labeling). The payload is the row id; actions are computed in render from the row's
  // current data and the current `rowActions`, so they never go stale.
  const [menu] = React.useState(() => Menu.createHandle<string>());
  const byId = React.useMemo(() => new Map(model.rows.map((r) => [r.id, r.original])), [model.rows]);
  const sel = model.selection;
  const selectable = sel.enabled;
  const rows = model.rows;
  const summaryRef = React.useRef<HTMLParagraphElement>(null);
  const retry = (fn: () => void) => () => { fn(); summaryRef.current?.focus(); };
  const pager = useLanding(root, summaryRef, paging, state.rows ?? 'current');
  const place = JSON.stringify([model.view, paging?.kind === 'pages' ? paging.page : null]);
  const { onFocus, note, forget } = useKeptPlace(root, summaryRef, rows, place, state.rows === 'previous');
  // Each row action notes its row, so the place is kept when the row leaves while focus is still in the menu.
  const getRowId = React.useRef(props.getRowId);
  React.useLayoutEffect(() => { getRowId.current = props.getRowId; });
  const actionsFor = React.useMemo(() => rowActions && ((row: Row) => rowActions(row).map((a): RowAction => {
    const run = a.onSelect;
    return run ? { ...a, onSelect: () => { note('row', [getRowId.current(row)]); run(); } } : a;
  })), [rowActions, note]);

  // The display follows from the state's parts. `aria-busy` only while the rows on screen aren't this view's;
  // a background refresh of current, usable rows shows "Updating…" but doesn't mark the table busy (some screen
  // readers hold back busy content). Previous rows are never passed off as this view's after its load failed.
  const shows = state.rows ?? 'current';
  const failure = state.failure;
  const refreshFailed = failure?.scope === 'refresh';
  const busy = !!state.fetching && shows !== 'current';
  const updating = !!state.fetching;
  const hidden = !!failure && shows !== 'current';
  const showSkeleton = shows === 'none' && !!state.fetching && !failure;
  // A failed load shows the alert alone. A failed refresh of an empty page still shows the empty state.
  const errorOnly = hidden || (!!failure && failure.scope !== 'refresh' && rows.length === 0);
  const empty = rows.length === 0 && !showSkeleton && !errorOnly;
  // "page" only when the caller pages; loaded rows otherwise.
  const scope = paging?.kind === 'pages' ? 'on this page' : 'shown';

  // The one-line takeaway: count first, then what is happening. Not a live region: sorts are announced on their
  // own, selection by SelectionBar and busy-ness by `aria-busy`, so this doesn't talk over them.
  const shown = hidden ? 0 : rows.length;
  const countText = hidden ? formatCount(0, noun, locale) : total == null || (typeof total === 'number' && total === shown)
    ? formatCount(shown, noun, locale)
    : `${formatValue(shown, locale)} of ${formatCount(total, noun, locale)}`;
  // A failed load has no count to give: the alert says what happened. The line stays as Try again's focus target,
  // empty until a retry is on its way.
  const summary = errorOnly ? (updating ? `Loading ${noun.other}…` : '')
    : showSkeleton ? `Loading ${noun.other}…` : updating ? `${countText} · Updating…` : countText;
  const allMatching = typeof total === 'number' ? formatCount(total, noun, locale) : `matching ${noun.other}`;

  return (
    <div ref={root} className={cn('ld-dt', props.className)} data-layout={layout} onFocus={onFocus}>
      <div className="ld-dt-top">
        <p ref={summaryRef} tabIndex={-1} className="ld-dt-summary">{summary}</p>
        {/* The status region is always here, empty and unpainted until a refresh fails, so its text is announced. */}
        <p className="ld-dt-notice">
          <span role="status">
            {refreshFailed ? (
              <span>
                {state.since
                  ? <>Showing saved data from <time dateTime={state.since.toISOString()}>{state.since.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}</time>.</>
                  : 'Showing saved data.'}
              </span>
            ) : null}
          </span>
          {refreshFailed ? <Button variant="plain" className="ld-dt-btn" onClick={retry(failure.retry)}>Refresh</Button> : null}
        </p>
        {selectable && !hidden && sel.canSelectAllMatching ? (
          <p className="ld-dt-notice">
            <span>{`All ${formatCount(shown, noun, locale)} ${scope} are selected.`}</span>
            <Button variant="plain" className="ld-dt-btn" onClick={sel.selectAllMatching}>{`Select all ${allMatching}`}</Button>
          </p>
        ) : null}
        {selectable && sel.value.kind === 'all-matching' ? (
          <p className="ld-dt-notice">
            <span>{sel.value.except.size === 0 ? `All ${allMatching} are selected.` : `${formatCount(sel.count, noun, locale)} selected.`}</span>
            <Button variant="plain" className="ld-dt-btn" onClick={sel.clear}>Clear selection</Button>
          </p>
        ) : null}
      </div>

      {failure && failure.scope !== 'refresh' ? (
        <div className="ld-dt-error" role="alert">
          <p className="ld-dt-error-text">
            <strong>{failure.scope === 'more' ? `Couldn’t load more ${noun.other}.` : `Couldn’t load ${noun.other}.`}</strong>
            {failure.message ? ` ${failure.message}` : ''}
          </p>
          <Button variant="tinted" className="ld-dt-btn" onClick={retry(failure.retry)}>Try again</Button>
        </div>
      ) : null}

      {errorOnly ? null : empty ? (
        props.emptyState ?? (
          <div className="ld-empty ld-dt-empty">
            <p className="text-title-3 ld-empty-title">{`No ${noun.other}`}</p>
          </div>
        )
      ) : layout === 'cards' ? (
        <Cards
          label={label}
          model={model}
          columns={columns}
          rowHeader={rowHeader}
          noun={noun}
          scope={scope}
          rowHref={rowHref}
          rowActions={actionsFor}
          swipe={!!props.swipeActions}
          skeleton={showSkeleton}
          busy={busy}
          locale={locale}
        />
      ) : (
        <Table.Root {...label} busy={busy} stickyFirstColumn={sticky}>
          <Table.Columns
            sticky={sticky ? (selectable ? 2 : 1) : 0}
            widths={[...(selectable ? ['var(--ld-table-control-w)'] : []), ...columns.map((c) => c.width), ...(rowActions ? ['var(--ld-table-control-w)'] : [])]}
          />
          <Table.Head>
            <Table.Row>
              {selectable ? (
                <Table.HeaderCell className="ld-table-check" sticky={sticky}>
                  <Checkbox
                    aria-label={`Select all ${noun.other} ${scope}`}
                    checked={sel.page === 'all'}
                    indeterminate={sel.page === 'some'}
                    disabled={rows.length === 0 || sel.inert}
                    onChange={sel.togglePage}
                  />
                </Table.HeaderCell>
              ) : null}
              {model.headers.map((h, i) => (
                <Table.HeaderCell key={h.column.id} sort={h.sort} align={h.column.align} sticky={sticky && i === 0}>
                  {h.sortable ? (
                    <Table.SortButton direction={h.sort} onClick={() => model.sortBy(h.column.id)}>
                      {h.column.header ?? h.column.label}
                    </Table.SortButton>
                  ) : (
                    h.column.header ?? h.column.label
                  )}
                </Table.HeaderCell>
              ))}
              {rowActions ? (
                <Table.HeaderCell className="ld-table-actions">
                  <span className="ld-sr-only">Actions</span>
                </Table.HeaderCell>
              ) : null}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {showSkeleton
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i} className="ld-table-row ld-table-skeleton" aria-hidden="true">
                    {selectable ? <td className="ld-table-check" /> : null}
                    {columns.map((c) => <td key={c.id} className="ld-table-td"><span className="ld-skel" /></td>)}
                    {rowActions ? <td className="ld-table-actions" /> : null}
                  </tr>
                ))
              : rows.map((r) => (
                  <DataRow
                    key={r.id}
                    id={r.id}
                    original={r.original}
                    columns={columns}
                    rowHeader={rowHeader}
                    text={model.text}
                    selected={selectable ? sel.isSelected(r.id) : undefined}
                    inert={sel.inert}
                    toggle={sel.toggle}
                    href={rowHref?.(r.original)}
                    menu={rowActions ? menu : undefined}
                    sticky={sticky}
                    locale={locale}
                  />
                ))}
          </Table.Body>
        </Table.Root>
      )}

      {rowActions && layout === 'table' ? (
        <Menu.Root handle={menu}>
          {({ payload }: { payload: string | undefined }) => {
            const row = payload !== undefined ? byId.get(payload) : undefined;
            return (
              <Menu.Portal>
                <ThemeScope>
                  <Menu.Positioner className="ld-menu-positioner" sideOffset={6} align="end">
                    <Menu.Popup className="ld-menu">{row !== undefined ? <RowActionItems actions={actionsFor!(row)} /> : null}</Menu.Popup>
                  </Menu.Positioner>
                </ThemeScope>
              </Menu.Portal>
            );
          }}
        </Menu.Root>
      ) : null}

      {pager && !hidden && (rows.length > 0 || (pager.kind === 'pages' && pager.pageCount > 1)) ? (
        <Pager paging={pager} noun={noun} busy={updating} locale={locale} />
      ) : null}

      {selectable ? (
        <SelectionBar
          count={sel.count}
          noun={noun}
          locale={locale}
          // Done returns focus to where it came into the bar from. When that control has gone, as a checkbox does when
          // the table becomes cards, focus that left with the bar goes to the summary line in the same task, before a
          // frame can show <body>. Focus that was never in the bar stays where it was.
          onClear={() => {
            const held = document.activeElement !== document.body;
            forget();
            sel.clear();
            queueMicrotask(() => { if (held && document.activeElement === document.body) summaryRef.current?.focus(); });
          }}
          actions={(props.bulkActions ?? []).map((a) => ({ ...a, onSelect: () => { note('bulk', rows.map((r) => r.id).filter(sel.isSelected)); a.onSelect(sel.value); } }))}
        />
      ) : null}
    </div>
  );
}

/** Where focus goes in a row: its link, else its first control, else its row header. */
function rowTarget(row: Element | null | undefined): HTMLElement | null {
  if (!row) return null;
  return row.querySelector<HTMLElement>('[data-row-link], .ld-row-target') ?? row.querySelector<HTMLElement>('input, button, a[href], th[tabindex="-1"]');
}

/**
 * A removal keeps the reader's place. When the row that has focus leaves, focus moves to the row that took its place,
 * which is the one after it, else to the last row, else to the summary line, in the commit that takes the row away.
 * A row action lands the same way when its row leaves while focus is still in the row's menu. A bulk action lands from
 * the first of its rows that left once the bar has left too: a bar that stays holds rows that failed, and focus stays
 * on its button. When the bar leaves before its rows, focus waits on the first selected row and moves on when that
 * row leaves.
 */
function useKeptPlace(
  root: React.RefObject<HTMLElement | null>,
  summary: React.RefObject<HTMLElement | null>,
  rows: readonly { id: string }[],
  place: string,
  loading: boolean,
) {
  const focused = React.useRef<string | null>(null);
  const was = React.useRef({ place, loading });
  const shown = React.useRef<string[]>([]);
  const acted = React.useRef<{ kind: 'row' | 'bulk'; from: Element | null; picked: string[]; order: string[] } | null>(null);
  React.useLayoutEffect(() => {
    const ids = rows.map((r) => r.id);
    const order = shown.current;
    shown.current = ids;
    // Rows that leave because the page or view changed, such as by Back, aren't a removal: that move is the caller's.
    const turned = was.current.place !== place || was.current.loading;
    was.current = { place, loading };
    const el = root.current;
    if (!el) return;
    const here = new Set(ids);
    const find = (id: string) => rowTarget(el.querySelector(`[data-row-id="${CSS.escape(id)}"]`));
    // The row now where `id` was in `order`: as many rows down as stayed above it, or the last row.
    const after = (order: string[], id: string) => ids[Math.min(order.slice(0, order.indexOf(id)).filter((o) => here.has(o)).length, ids.length - 1)];
    const land = (id: string | undefined) => {
      const target = (id && find(id)) || summary.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest' });
    };
    const active = document.activeElement;
    const action = acted.current;
    if (action) {
      if (active !== action.from && active !== document.body) { acted.current = null; return; }
      // A bar that stays, holding rows that failed, keeps focus on its button. Only a bar that leaves before its rows
      // waits on one: a row action whose row stayed has ended, so focus that later falls to <body> isn't its to place.
      const left = !action.from?.isConnected;
      const gone = action.order.findIndex((id) => action.picked.includes(id) && !here.has(id));
      if (gone >= 0 && (left || action.kind === 'row')) { acted.current = null; land(after(action.order, action.order[gone])); }
      else if (left && action.kind === 'bulk' && active === document.body) { acted.current = null; land(action.picked.find((id) => here.has(id))); }
      return;
    }
    const id = focused.current;
    if (!id || here.has(id) || turned || active !== document.body || !document.hasFocus()) return;
    focused.current = null;
    land(after(order, id));
  });
  // The row focus was last in. Focus that leaves it for another control isn't on `<body>` when the row goes.
  const onFocus = (e: React.FocusEvent) => {
    focused.current = (e.target as Element).closest('[data-row-id]')?.getAttribute('data-row-id') ?? null;
  };
  // Stable, so the memoized card rows don't re-render: the rows on screen are read when an action fires.
  const note = React.useCallback((kind: 'row' | 'bulk', picked: string[]) => {
    acted.current = { kind, from: document.activeElement, picked, order: shown.current };
  }, []);
  // Clearing the selection ends a bulk action whose rows failed: the bar returns focus where it came from.
  const forget = React.useCallback(() => { acted.current = null; }, []);
  return { onFocus, note, forget };
}

type Aim = { kind: 'page'; to: number } | { kind: 'more'; before: ReadonlySet<string> };
type Landing = Aim & { from: Element | null };

/**
 * Paging lands on the new page: Next and Previous on the summary line above it, Load more on the first new row, or on
 * the summary line when none came and Load more left. The
 * move waits until the page's rows are this view's, then happens in the commit that renders them. Focus the person
 * moved elsewhere in the meantime stays there. The returned paging is the caller's, with each press noted.
 */
function useLanding(
  root: React.RefObject<HTMLElement | null>,
  summary: React.RefObject<HTMLElement | null>,
  paging: Paging | undefined,
  shows: NonNullable<TableState['rows']>,
): Paging | undefined {
  const landing = React.useRef<Landing | null>(null);
  React.useLayoutEffect(() => {
    const want = landing.current;
    if (!want || !root.current) return;
    const active = document.activeElement;
    // The control pressed, or `<body>` once it left with the old rows. Anywhere else, the person moved focus.
    if (active !== want.from && active !== document.body) { landing.current = null; return; }
    if (shows !== 'current') return;
    let target: HTMLElement | null;
    if (want.kind === 'page') {
      if (paging?.kind !== 'pages' || paging.page !== want.to) return;
      target = summary.current;
    } else {
      const row = [...root.current.querySelectorAll('[data-row-id]')].find((r) => !want.before.has(r.getAttribute('data-row-id')!));
      // No new rows, and Load more left with the news that there are no more: the summary says what's here.
      if (!row && want.from?.isConnected) return;
      target = (row && rowTarget(row)) ?? summary.current;
    }
    landing.current = null;
    target?.focus();
  });
  return React.useMemo<Paging | undefined>(() => {
    if (!paging) return paging;
    const note = (aim: Aim) => { landing.current = { ...aim, from: document.activeElement }; };
    return paging.kind === 'pages'
      ? { ...paging, onPageChange: (to) => { note({ kind: 'page', to }); paging.onPageChange(to); } }
      : {
          ...paging,
          onLoadMore: () => {
            const ids = [...(root.current?.querySelectorAll('[data-row-id]') ?? [])].map((r) => r.getAttribute('data-row-id')!);
            note({ kind: 'more', before: new Set(ids) });
            paging.onLoadMore();
          },
        };
  }, [paging, root]);
}
