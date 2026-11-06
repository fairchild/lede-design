import * as React from 'react';
import { useLocation, useNavigate, useNavigationType, useParams } from 'react-router';
import { PageHeader } from '@lede/blocks/page-header';
import { DataTable } from '@lede/blocks/data-table';
import { useServerRows, type ServerRows } from '@lede/blocks/use-server-rows';
import { formatCount } from '@lede/blocks/selection-bar';
import { isSelected, removeFromSelection, type Paging, type Selection, type SortItem, type TableView } from '@lede/blocks/use-data-table';
import type { RowAction } from '@lede/list';
import { EmptyState } from '@lede/blocks/empty-state';
import { Button } from '@lede/button';
import { createWorkServer, DEMO_TODAY, dueDate, type ArchiveFailure, type WorkItem } from '@/data/work-items';
import { workColumns, formatMoney, StatusChip } from '@/work-columns';
import { dispatch, getDemo, useDemo, workItems, workSelection } from '@/demo-store';
import { restoreFocus } from '@/focus-restoration';

/** One fake server for the demo app, built from what the tab has archived, so archived items stay archived. */
export const server = createWorkServer({ latency: 350, countLatency: 1200, items: workItems(getDemo()) });
/** Archives on the server and keeps the result in the demo store, so a reload keeps it too. */
async function archiveOnServer(match: (id: string) => boolean) {
  const result = await server.archive(match);
  dispatch({ type: 'work/archived', ids: result.archived });
  return result;
}
const select = (selection: Selection) => dispatch({ type: 'work/select', selection });
const noun = { one: 'work item', other: 'work items' };
const pick = (ids: string[]): Selection => ({ kind: 'ids', ids: new Set(ids) });
/** One item by its ID, several by their count. */
const named = (ids: string[]) => (ids.length === 1 ? ids[0] : formatCount(ids.length, noun, 'en-US'));
const label = (s: Selection) => (s.kind === 'ids' ? named([...s.ids]) : 'the selected work items');
const kept = (locked: string[]) => (locked.length ? ` ${formatCount(locked.length, { one: 'locked item was', other: 'locked items were' }, 'en-US')} kept.` : '');

/** A failed archive, takeaway first. It stays until the items are archived or the message is dismissed. */
interface Failure {
  headline: string;
  items: ArchiveFailure[];
  /** What Try again sends. */
  retry: Selection;
  /** Keys the alert: each failure adds a new one to the page, so it's announced even when its words repeat. */
  tries: number;
}
const DEFAULT_SORT: SortItem = { columnId: 'due', direction: 'ascending' };
const SORTABLE = new Set(workColumns.filter((c) => c.sortable).map((c) => c.id));
/** `?sort=amount` sorts up and `?sort=-amount` down; `?page=3` is the third page. Anything else reads as the default. */
function readList(search: string): { sort: SortItem; page: number } {
  const params = new URLSearchParams(search);
  const by = params.get('sort') ?? '';
  const columnId = by.replace(/^-/, '');
  const page = Number(params.get('page'));
  return {
    sort: SORTABLE.has(columnId) ? { columnId, direction: by.startsWith('-') ? 'descending' : 'ascending' } : DEFAULT_SORT,
    page: Number.isSafeInteger(page) && page > 1 ? page - 1 : 0,
  };
}
/** The URL's search for a sort and page, leaving out the defaults: `/app/work` is the first page, soonest due first. */
function listSearch(sort: SortItem, page: number) {
  const params = new URLSearchParams();
  if (sort.columnId !== DEFAULT_SORT.columnId || sort.direction !== DEFAULT_SORT.direction) {
    params.set('sort', `${sort.direction === 'descending' ? '-' : ''}${sort.columnId}`);
  }
  if (page > 0) params.set('page', String(page + 1));
  const search = params.toString();
  return search ? `?${search}` : '';
}
/** The list as the reader last left it, for the item page's Work link. */
let lastList = '';
/** The rows Work last showed, in order, so an item archived from its own page comes back to the row that took its place. */
let lastRows: string[] = [];
/** Where the reader left each of Work's history entries, by key, for Back to return to once the rows are in. */
const scrolls = new Map<string, number>();

const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

/** The takeaway the table doesn't state, whatever its sort or page: what's late and what's stuck, as of the demo's today. */
function workSummary() {
  const open = server.where((w) => w.status !== 'Done');
  const overdue = open.filter((w) => w.due < DEMO_TODAY).length;
  const blocked = open.filter((w) => w.status === 'Blocked').length;
  return `${overdue ? `${overdue} overdue` : 'Nothing overdue'} · ${blocked ? `${blocked} blocked` : 'nothing blocked'}`;
}

/**
 * Daybook's work list: server-side rows, 50 a page, sorted and paged by the (fake) server. The sort and page are in the
 * URL, so a reload, Back and a shared link show the same rows; the selection and the archives are in the demo store.
 */
export function WorkPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const list = readList(location.search);
  const { columnId, direction } = list.sort;
  const view = React.useMemo<TableView>(() => ({ sort: [{ columnId, direction }] }), [columnId, direction]);
  const demo = useDemo();
  const selection = React.useMemo(() => workSelection(demo), [demo]);
  const rows = useServerRows({ view, fetchRows: server.fetchRows, fetchCount: server.fetchCount, pageSize: 50, mode: 'pages' });
  const { reload } = rows;
  const { paging, onViewChange } = useListInUrl(view.sort[0], list.page, rows);
  const arrived = rows.state.rows === 'current';
  useScrollOnBack(arrived);
  // An item archived from its own page comes back here with its ID, to be named once: the entry then drops it, so
  // returning to this entry later doesn't say it again.
  const [archivedHere] = React.useState((location.state as { archived?: string } | null)?.archived);
  const [gone] = React.useState(() => (archivedHere ? lastRows.indexOf(archivedHere) : -1));
  // Taken by the first arrival of rows, so a later sort or page change neither lands nor says it again.
  const toName = React.useRef(archivedHere);
  const [notice, setNotice] = React.useState('');
  React.useLayoutEffect(() => { if (arrived) lastRows = rows.rows.map((r) => r.id); }, [arrived, rows.rows]);
  // Until the rows are in, the heading holds focus. Then an item archived from its own page hands it to the row that took
  // the item's place, in the commit that renders them. Back and the back link return to the row the item was opened
  // from (`restoreFocus`), and focus the person moved meanwhile stays where it went.
  React.useLayoutEffect(() => {
    if (!arrived || !toName.current || gone < 0 || document.activeElement !== heading.current) return;
    const id = rows.rows[Math.min(gone, rows.rows.length - 1)]?.id;
    const row = id ? document.querySelector(`main [data-row-id="${CSS.escape(id)}"]`) : null;
    const target = row?.querySelector<HTMLElement>('[data-row-link], .ld-row-target') ?? document.querySelector<HTMLElement>('main .ld-dt-summary');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  }, [arrived]);
  // Back between two of Work's entries can swap the rows without the heading holding focus, so the return lands in the
  // commit that renders them.
  React.useLayoutEffect(() => { if (arrived) restoreFocus(); }, [arrived, rows.rows]);
  // Named once focus has landed. The status region mounted empty, because screen readers announce a change to a region
  // already on the page.
  React.useEffect(() => {
    if (!arrived || !toName.current) return;
    setNotice(`Archived ${toName.current}.`);
    toName.current = undefined;
  }, [arrived]);
  const hasState = location.state != null;
  React.useEffect(() => {
    if (hasState) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [hasState, location.pathname, location.search, navigate]);
  const [failure, setFailure] = React.useState<Failure | null>(null);
  // What's in flight. React renders before the next click arrives, so the second of a double click finds it here.
  const [working, setWorking] = React.useState<Selection[]>([]);
  const isWorking = (id: string) => working.some((s) => isSelected(s, id));
  const heading = React.useRef<HTMLHeadingElement>(null);
  const card = React.useRef<HTMLDivElement>(null);
  // Set when an action ends: the focused control can leave with its row, the bar or the message.
  const acted = React.useRef(false);
  // Archives the store hears of once their rows leave the page, or as the page goes. An answer that comes after the page
  // went reaches the store at once.
  const leaving = React.useRef<{ ids: string[]; update: () => void }[]>([]);
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; for (const l of leaving.current.splice(0)) l.update(); };
  }, []);
  React.useLayoutEffect(() => {
    const shown = new Set(rows.rows.map((r) => r.id));
    const left = leaving.current.filter((l) => rows.state.failure || !l.ids.some((id) => shown.has(id)));
    leaving.current = leaving.current.filter((l) => !left.includes(l));
    for (const l of left) l.update();
  }, [rows.rows, rows.state.failure]);

  const archive = React.useCallback(async (target: Selection) => {
    const unsent = (id: string) => isSelected(target, id) && !isWorking(id);
    if (!server.count(unsent)) return;
    setWorking((w) => [...w, target]);
    setNotice(`Archiving ${label(target)}…`);
    try {
      const { archived, locked, failed } = await server.archive(unsent);
      if (archived.length) reload();
      // Only what was sent changes, so a selection changed in flight stays. Archived rows leave it, and so do locked ones
      // from a bulk archive: failed rows stay, so the bar and Try again act on those alone. "All matching" can't name what
      // it keeps, so after a bulk archive it becomes the failed rows it still covers.
      const update = () => {
        dispatch({ type: 'work/archived', ids: archived });
        const s = workSelection(getDemo());
        select(target.kind === 'all-matching' && s.kind === 'all-matching'
          ? pick(failed.map((f) => f.id).filter((id) => isSelected(s, id)))
          : removeFromSelection(s, [...archived, ...locked]));
      };
      // The store takes archived items out of the selection, so it hears of them once their rows leave: the bar leaves
      // with them, in one commit, and focus goes from its button to the reader's place. The outcome is said then, after
      // that move.
      const done = archived.length ? `Archived ${named(archived)}.` : '';
      const said = `${done}${kept(locked)}`.trim();
      if (failed.length) setNotice('');
      const settle = () => { update(); if (!failed.length) setNotice(said); };
      if (archived.length && mounted.current) leaving.current.push({ ids: archived, update: settle }); else settle();
      setFailure((prev) => {
        const sent = new Set([...archived, ...locked, ...failed.map((f) => f.id)]);
        const items = [...(prev?.items.filter((f) => !sent.has(f.id)) ?? []), ...failed];
        if (!items.length) return null;
        const ids = items.map((f) => f.id);
        const again = prev?.items.some((f) => failed.some((x) => x.id === f.id));
        const couldnt = `${again ? 'Still couldn’t' : 'Couldn’t'} archive ${named(ids)}.`;
        const headline = failed.length ? `${done} ${couldnt}${kept(locked)}`.trim() : couldnt;
        return { headline, items, retry: pick(ids), tries: (prev?.tries ?? 0) + 1 };
      });
    } catch (e) {
      // The request itself failed, so nothing is known about its items: the selection stays, and Try again sends it again.
      setNotice('');
      setFailure((prev) => ({
        headline: `Couldn’t archive ${label(target)}. ${(e as Error).message} Try again.`,
        items: prev?.items ?? [],
        retry: target,
        tries: (prev?.tries ?? 0) + 1,
      }));
    } finally {
      setWorking((w) => w.filter((s) => s !== target));
      acted.current = true;
    }
  }, [working, reload]);

  // Stable, so the memoized cards don't re-render whenever the server hook updates.
  const actions = React.useCallback((r: WorkItem): RowAction[] => [
    r.locked
      ? { label: 'Archive', tone: 'neutral', disabled: true, disabledReason: 'Locked items can’t be archived' }
      : r.archiving
        ? { label: 'Archiving…', tone: 'neutral', disabled: true }
        : { label: 'Archive', tone: 'neutral', onSelect: () => { void archive(pick([r.id])); } },
  ], [archive]);
  // DataTable has no row state, so a row in flight says so in its data.
  const shown = React.useMemo(
    () => rows.rows.map((r) => (!r.locked && isWorking(r.id) ? { ...r, archiving: true } : r)),
    [rows.rows, working],
  );
  // A failure leaves focus alone: the row and the bar stay, and the alert is announced. A row that leaves hands focus
  // to the reader's place in the table. When the failure's own controls leave, the heading takes focus in the commit
  // that took them away, before a frame can paint. A layout effect is the one React runs inside that commit. With
  // React 19.2, a passive effect here runs inside it too, after Dismiss and after Try again's reply (observed), so no
  // focus row fails on `useEffect` today. The layout effect keeps the move from resting on that scheduling.
  React.useLayoutEffect(() => {
    if (!acted.current) return;
    acted.current = false;
    if (document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, [rows.rows, failure, selection]);
  // The message floats, so nothing moves. While it's up, the table's controls scroll to below it, which keeps tabbed
  // focus in sight, and if it covers a failed row, the topmost one moves just clear of it.
  React.useLayoutEffect(() => {
    const box = card.current?.getBoundingClientRect();
    if (!failure || !box) return undefined;
    const root = document.documentElement;
    root.style.setProperty('--docs-float-bottom', `${box.bottom}px`);
    const covered = [...document.querySelectorAll<HTMLElement>('[data-row-id]')].find((row) => {
      const at = row.getBoundingClientRect();
      return isSelected(failure.retry, row.dataset.rowId!) && at.top < box.bottom && at.bottom > box.top;
    });
    covered?.scrollIntoView({ block: 'nearest' });
    return () => { root.style.removeProperty('--docs-float-bottom'); };
  }, [failure, rows.rows]);
  const href = React.useCallback((r: WorkItem) => `/app/work/${r.id}`, []);
  const total = rows.total;
  const retrying = !!failure && working.includes(failure.retry);
  // In the order they're on screen, whatever order they failed in.
  const place = (f: ArchiveFailure) => { const i = rows.rows.findIndex((r) => r.id === f.id); return i < 0 ? rows.rows.length : i; };
  const listed = [...(failure?.items ?? [])].sort((a, b) => place(a) - place(b));
  return (
    <div className="ld-flow">
      <div className="docs-float">
        {failure ? (
          <div ref={card} className="ld-dt-error">
            <div key={failure.tries} className="docs-failure" role="alert">
              <p className="ld-dt-error-text"><strong>{failure.headline}</strong></p>
              <ul>
                {listed.map((f) => (
                  <li key={f.id}>{listed.length > 1 ? `${f.id}, ` : ''}{f.title}: {f.reason} {f.next}</li>
                ))}
              </ul>
            </div>
            <div className="docs-failure-actions">
              <Button variant="tinted" className="ld-dt-btn" aria-disabled={retrying || undefined} onClick={() => { void archive(failure.retry); }}>
                {retrying ? 'Trying again…' : 'Try again'}
              </Button>
              <Button variant="plain" className="ld-dt-btn" onClick={() => { acted.current = true; setFailure(null); }}>Dismiss</Button>
            </div>
          </div>
        ) : null}
      </div>
      <PageHeader title="Work" headingRef={heading} summary={total == null ? 'Loading your work items…' : workSummary()} />
      <p className="docs-notice" role="status">{notice}</p>
      <DataTable
        aria-label="Work items"
        noun={noun}
        locale="en-US"
        columns={workColumns}
        getRowId={(r) => r.id}
        rowHeader="id"
        processing="server"
        view={view}
        onViewChange={onViewChange}
        selectionMode="multiple"
        selection={selection}
        onSelectionChange={select}
        bulkActions={[{ label: 'Archive', onSelect: (s) => { void archive(s); } }]}
        rowHref={href}
        rowActions={actions}
        narrow="cards"
        emptyState={<EmptyState title="No work items" description="Everything is archived. New work lands here." />}
        {...rows}
        paging={paging}
        rows={shown}
      />
    </div>
  );
}

/**
 * Keeps the URL and the list's page in step. The URL leads when it changes (a link, Back, a reload). When the list moves
 * by itself (a page past the end, or one that archiving emptied), the URL follows once that page's rows are in.
 */
function useListInUrl(sort: SortItem, page: number, rows: ServerRows<WorkItem>) {
  const navigate = useNavigate();
  const { search } = useLocation();
  // A click renders at once, so a second click on Next finds the page the first one moved to. An effect can't flush.
  const write = React.useCallback(
    (s: string, flushSync = true) => navigate({ search: s }, { replace: true, preventScrollReset: true, flushSync }),
    [navigate],
  );
  const p = rows.paging;
  const want = listSearch(sort, page);
  // The sort and page last asked of the list. A new sort starts it on the first page.
  const [asked, setAsked] = React.useState(() => listSearch(sort, 0));
  React.useLayoutEffect(() => {
    if (want === asked || p.kind !== 'pages') return;
    setAsked(want);
    p.onPageChange(page);
  }, [want, asked, p, page]);
  const showing = listSearch(sort, p.kind === 'pages' ? p.page : 0);
  const settled = want === asked && rows.state.rows === 'current' && !rows.state.fetching;
  React.useEffect(() => { if (settled && showing !== search) write(showing, false); }, [settled, showing, search, write]);
  React.useEffect(() => { lastList = search; }, [search]);
  const paging = React.useMemo<Paging>(() => (p.kind === 'pages' ? { ...p, onPageChange: (to) => write(listSearch(sort, to)) } : p), [p, sort, write]);
  const onViewChange = React.useCallback((v: TableView) => write(listSearch(v.sort[0] ?? DEFAULT_SORT, 0)), [write]);
  return { paging, onViewChange };
}

/** Back returns to where the reader left this entry once the rows are in: until then the page is too short to hold it. */
function useScrollOnBack(arrived: boolean) {
  const { key } = useLocation();
  const pop = useNavigationType() === 'POP';
  // Saved once the reader has left this entry. React Router's `history.state.key` (not public API) tells that apart from
  // StrictMode's rehearsal unmount in development, which stays on the entry.
  React.useLayoutEffect(() => () => {
    if (((window.history.state as { key?: string } | null)?.key ?? 'default') !== key) scrolls.set(key, window.scrollY);
  }, [key]);
  // Used once: rows that arrive later, for a new sort or page, leave the scroll where the reader has it.
  const y = React.useRef(pop ? scrolls.get(key) : undefined);
  React.useEffect(() => {
    if (y.current === undefined || !arrived) return;
    window.scrollTo(0, y.current);
    y.current = undefined;
  }, [arrived]);
}

const DAY = 86_400_000;
/** The item's takeaway: how it stands against its due date, and who has it. Read against the demo's today. */
function itemTakeaway(item: WorkItem) {
  const days = Math.round((Date.parse(item.due) - Date.parse(DEMO_TODAY)) / DAY);
  const when = item.status === 'Done' ? 'Done'
    : days < 0 ? `${formatCount(-days, { one: 'day', other: 'days' }, 'en-US')} overdue`
    : days === 0 ? 'Due today'
    : days === 1 ? 'Due tomorrow'
    : `Due in ${formatCount(days, { one: 'day', other: 'days' }, 'en-US')}`;
  return `${item.status === 'Blocked' ? `Blocked, ${when.toLowerCase()}` : when} · ${item.assignee.name}`;
}

interface WorkItemViewProps {
  id: string;
  item: WorkItem | undefined;
  back: { href: string; label: string };
  mayBeArchived?: boolean;
  /** The page's actions, beside its title. */
  actions?: React.ReactNode;
  /** What an action has to say, above the facts. */
  children?: React.ReactNode;
}

/** One work item's page body. The caller finds the item and says where Back leads, so the demo app and the docs can each use it. */
export function WorkItemView({ id, item, back, mayBeArchived, actions, children }: WorkItemViewProps) {
  if (!item) {
    return (
      <div className="ld-flow">
        <PageHeader title="Not found" summary={`There is no work item ${id}.${mayBeArchived ? ' It may have been archived.' : ''}`} back={back} />
      </div>
    );
  }
  return (
    <div className="ld-flow ld-flow-narrow">
      <PageHeader title={item.title} summary={itemTakeaway(item)} back={back} actions={actions} />
      {children}
      <dl className="docs-facts">
        <div><dt>ID</dt><dd>{item.id}</dd></div>
        <div><dt>Status</dt><dd><StatusChip status={item.status} /></dd></div>
        <div><dt>Assignee</dt><dd>{item.assignee.name}</dd></div>
        <div><dt>Due</dt><dd><time dateTime={item.due}>{dateFmt.format(dueDate(item))}</time></dd></div>
        <div><dt>Amount</dt><dd>{formatMoney(item.amount)}</dd></div>
        {item.locked ? <div><dt>Locked</dt><dd>Can’t be archived</dd></div> : null}
      </dl>
    </div>
  );
}

/** One work item, on its own URL, with the Archive the list's row menu has. Archived, it goes back to the list. */
export function WorkItemPage() {
  const { id = '' } = useParams();
  // Keyed by ID, so moving to another item starts it fresh.
  return <WorkItemScreen key={id} id={id} />;
}

function WorkItemScreen({ id }: { id: string }) {
  const navigate = useNavigate();
  const item = server.get(id);
  const back = { href: `/app/work${lastList}`, label: 'Work' };
  // `tries` keys the alert, so a failure that repeats word for word is announced again.
  const [state, setState] = React.useState<{ working?: boolean; failure?: string; tries: number }>({ tries: 0 });
  // An archive finishes even after the reader leaves the item; only a reader still here goes back to the list.
  const here = React.useRef(true);
  React.useEffect(() => {
    here.current = true;
    return () => { here.current = false; };
  }, []);
  const archive = async () => {
    setState((s) => ({ ...s, working: true }));
    try {
      const { archived, failed } = await archiveOnServer((x) => x === id);
      if (!here.current) return;
      if (archived.length) navigate(back.href, { state: { archived: id } });
      else setState((s) => ({ failure: failed.length ? `${failed[0].reason} ${failed[0].next}` : undefined, tries: s.tries + 1 }));
    } catch (e) {
      if (here.current) setState((s) => ({ failure: `${(e as Error).message} Try again.`, tries: s.tries + 1 }));
    }
  };
  const action = item && !item.locked ? (
    <Button variant="gray" aria-disabled={state.working || undefined} onClick={() => { if (!state.working) void archive(); }}>
      {state.working ? 'Archiving…' : state.failure ? 'Try again' : 'Archive'}
    </Button>
  ) : undefined;
  return (
    <WorkItemView id={id} item={item} back={back} mayBeArchived actions={action}>
      {state.failure ? <p key={state.tries} role="alert" className="ld-dt-error-text"><strong>Couldn’t archive {id}.</strong> {state.failure}</p> : null}
    </WorkItemView>
  );
}
