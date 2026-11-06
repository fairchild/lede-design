import * as React from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { PageHeader } from '@lede/blocks/page-header';
import { DataTable } from '@lede/blocks/data-table';
import { useServerRows } from '@lede/blocks/use-server-rows';
import type { Selection, TableState, TableView, Total } from '@lede/blocks/use-data-table';
import { Table } from '@lede/table';
import { Button } from '@lede/button';
import { SegmentedControl } from '@lede/segmented-control';
import { TextField } from '@lede/text-field';
import type { RowAction } from '@lede/list';
import { allWorkItems, bigWorkItems, createWorkServer, type WorkItem } from '@/data/work-items';
import { workColumns, formatMoney, StatusChip } from '@/work-columns';
import { isExample, itemHref, type Example } from './DataTableItemPage';
import { CodeExample } from './CodeExample';
import CLIENT_CODE from './samples/data-table.tsx?raw';
import { restoreFocus } from '@/focus-restoration';

/**
 * What the reader left when they opened a row. The examples unmount on the way to the item page, and the server-backed
 * examples' rows arrive after the guide is back, so the page is shorter than it was when the scroll position comes
 * back. When `useServerRows` keeps its rows or height across a remount, the reserved heights go, and
 * probably the re-scroll after mount. The picks and the heading focus stay: they are this page's own state.
 */
const left: { size: string; pick: string; heights: Map<string, number>; scrolls: Map<string, number> } = {
  size: '24',
  pick: 'Ready',
  heights: new Map(),
  scrolls: new Map(),
};

/** For a server-backed example: holds the height it had when the reader left until its rows land, so what is below it stays put. */
function useReserve(id: Example, landed: boolean, failed: boolean) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = React.useState(left.heights.get(id));
  React.useEffect(() => {
    if (!landed) return;
    const frame = requestAnimationFrame(() => setReserve(undefined));
    return () => cancelAnimationFrame(frame);
  }, [landed]);
  React.useLayoutEffect(() => { const el = ref.current!; return () => { left.heights.set(id, el.offsetHeight); }; }, [id]);
  return { ref, style: { minWidth: 0, minHeight: failed ? undefined : reserve, overflowAnchor: reserve ? 'none' : undefined } } satisfies React.ComponentProps<'div'>;
}

const noun = { one: 'work item', other: 'work items' };
const clientHref = itemHref('dt-client');
const serverHref = itemHref('dt-server');
const searchHref = itemHref('dt-search');
const statesHref = itemHref('dt-states');
const narrowHref = itemHref('dt-narrow');
/** Archive can be undone, so it's neutral; only Delete is critical. */
const actions = (r: WorkItem): RowAction[] => [
  { label: 'Assign to me', onSelect: () => undefined },
  r.locked
    ? { label: 'Archive', tone: 'neutral', disabled: true, disabledReason: 'Locked items can’t be archived' }
    : { label: 'Archive', tone: 'neutral', onSelect: () => undefined },
  { label: 'Delete', tone: 'critical', onSelect: () => undefined },
];

function Section({ id, title, summary, children }: { id: string; title: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="docs-section">
      <h2 id={id} tabIndex={-1} className="text-title-3 docs-target">{title}</h2>
      <p className="docs-intro">{summary}</p>
      <div className="docs-demo-col">{children}</div>
    </section>
  );
}
function Code({ label, defaultOpen, children }: { label: string; defaultOpen?: boolean; children: string }) {
  return <CodeExample label={label} language="tsx" code={children.trim()} defaultOpen={defaultOpen} />;
}

const clientRows = allWorkItems.slice(0, 24);
const narrowRows = allWorkItems.slice(0, 8);

const SERVER_CODE = `
import { DataTable } from '@/components/lede/blocks/data-table';
import { useServerRows } from '@/components/lede/blocks/use-server-rows';

const [view, setView] = useState<TableView>({ sort: [] });
const server = useServerRows({
  view,
  pageSize: 50,
  mode: 'load-more', // or 'pages'
  // Called with the view, an offset (and the previous page's cursor), a limit and an AbortSignal.
  // A failed response must reject: check r.ok. An error body with no rows array fails anyway,
  // but one that has rows would be shown as them. Rows win over a total below them: it's read
  // as "at least" the rows so far, so the rest of the list stays reachable.
  fetchRows: ({ view, offset, cursor, limit, signal }) =>
    fetch(\`/api/items?\${query(view, offset, cursor, limit)}\`, { signal }).then(json),
  // Asked at most once per visit: when a page reports { atLeast } without settling the count,
  // again when a count it gave is redone (reload, revalidation, older than staleAfter), when a
  // page fetched meanwhile can't settle it and when an empty page (pages mode) finds it too high.
  fetchCount: ({ view, signal }) => fetch(\`/api/items/count?\${query(view)}\`, { signal }).then(json),
});

function json(r: Response) {
  if (!r.ok) throw new Error(\`The server answered \${r.status}.\`);
  return r.json();
}

<DataTable
  caption="Work items"
  noun={{ one: 'work item', other: 'work items' }}
  columns={columns}
  getRowId={(r) => r.id}
  rowHeader="id"
  processing="server"
  view={view}
  onViewChange={setView}
  {...server} // rows, state, total, paging
/>`;

const STATES_CODE = `
// state is independent parts: whose rows, whether more are coming, what failed; {} is settled rows. useServerRows returns it for you.
type TableState = {
  rows?: 'current' | 'previous' | 'none'; // whose rows are on screen (default 'current')
  fetching?: boolean;                      // rows on the way: "Updating…", or aria-busy if not current
  since?: Date;                            // when the rows on screen were fetched
  failure?: { message?: string; retry: () => void; scope: 'load' | 'refresh' | 'more' };
};

<DataTable state={{ rows: 'none', fetching: true }} … />                     // skeleton
<DataTable state={{ failure: { scope: 'load', message, retry } }} … />       // alert; rows hidden unless current
<DataTable state={{ since, failure: { scope: 'refresh', retry } }} … />      // saved data, with Refresh
<DataTable state={{ failure: { scope: 'more', message, retry } }} … />       // rows stay; Load more retries
`;

const COLLAPSE_CODE = `
<Table.Root
  caption="Quarter totals"
  // The caption becomes a button; summary is what a collapsed table still says.
  // Open by default. Pass defaultOpen, or open with onOpenChange, inside collapsible.
  collapsible={{ summary: '2 quarters · $22,250.00' }}
>
  <Table.Head>…</Table.Head>
  <Table.Body>…</Table.Body>
</Table.Root>`;

const NARROW_CODE = `
// In a pane narrower than narrowBelow (560px by default), rows become cards. A card leads with the
// column marked card: 'title' (the row header when none is) and lists card: 1, 2 and 3 on the line
// below it. A field keeps to one line, and one wider than the card wraps inside itself. card: 'status'
// sits beside the text, where a long status narrows it, or under the text when the card is narrower
// than 440px. Checkboxes and menus are named by the row header, so rows whose titles repeat stay
// distinct; give it a numbered slot so that name shows on the card.
<DataTable
  caption="Work items in a narrow pane"
  columns={columns}
  rows={items}
  getRowId={(r) => r.id}
  rowHeader="id"
  selectionMode="multiple"
  rowActions={rowActions}
  swipeActions // swipe a card for its actions; the ••• menu stays as the visible twin
  narrow="cards" // or "scroll": keep the table, with a sticky first column
/>`;

const PARTS_CODE = `
<Table.Root caption="Quarter totals">
  <Table.Head>
    <Table.Row>
      <Table.HeaderCell>Quarter</Table.HeaderCell>
      <Table.HeaderCell align="end">Amount</Table.HeaderCell>
    </Table.Row>
  </Table.Head>
  <Table.Body>
    <Table.Row>
      <Table.RowHeader>Q3</Table.RowHeader>
      <Table.Cell align="end">$12,400.00</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table.Root>`;

function ClientExample() {
  const [size, setSize] = React.useState(left.size);
  return (
    <>
      <SegmentedControl
        label="Rows in the example"
        options={[{ value: '24', label: '24 rows' }, { value: '500', label: '500 rows' }]}
        value={size}
        onValueChange={(v) => { left.size = v; setSize(v); }}
      />
      <DataTable
        caption="Work items (client mode)"
        noun={noun}
        locale="en-US"
        columns={workColumns}
        rows={size === '500' ? bigWorkItems : clientRows}
        getRowId={(r) => r.id}
        rowHeader="id"
        defaultView={{ sort: [{ columnId: 'due', direction: 'ascending' }] }}
        selectionMode="multiple"
        bulkActions={[{ label: 'Archive', onSelect: () => undefined }]}
        rowHref={clientHref}
        rowActions={actions}
      />
    </>
  );
}

function useLog(server: ReturnType<typeof createWorkServer>) {
  return React.useSyncExternalStore(server.subscribe, server.getLog, server.getLog);
}

function ServerExample() {
  const [server] = React.useState(() => createWorkServer());
  const [view, setView] = React.useState<TableView>({ sort: [] });
  const [selection, setSelection] = React.useState<Selection>({ kind: 'ids', ids: new Set() });
  const rows = useServerRows({ view, fetchRows: server.fetchRows, fetchCount: server.fetchCount, pageSize: 50, mode: 'load-more' });
  const log = useLog(server);
  const reserved = useReserve('dt-server', rows.state.rows === 'current', !!rows.state.failure);
  // Its rows load after the page mounts, so Back to a row here finds it only once they're in.
  React.useEffect(() => { if (rows.state.rows === 'current') restoreFocus(); }, [rows.state.rows]);
  return (
    <>
      <div className="docs-demo">
        <Button variant="gray" onClick={server.failNextRequest}>Fail the next request</Button>
        <Button variant="gray" onClick={rows.reload}>Reload</Button>
      </div>
      <div className="docs-demo-col" {...reserved}>
      <DataTable
        caption="Work items (server mode)"
        noun={noun}
        locale="en-US"
        columns={workColumns}
        getRowId={(r) => r.id}
        rowHeader="id"
        processing="server"
        view={view}
        onViewChange={setView}
        selectionMode="multiple"
        selection={selection}
        onSelectionChange={setSelection}
        bulkActions={[{ label: 'Archive', onSelect: () => undefined }]}
        rowHref={serverHref}
        {...rows}
      />
      <section aria-labelledby="dt-log" className="docs-log">
        <h3 id="dt-log" className="docs-log-title">Requests to the fake server</h3>
        <ol aria-labelledby="dt-log">
          {log.map((e) => (
            <li key={e.id} data-status={e.status}>{`${e.text}: ${e.status}`}</li>
          ))}
        </ol>
      </section>
      </div>
    </>
  );
}

const SEARCH_CODE = `
// The term is part of the view, so it reaches fetchRows and fetchCount, keys the cache and starts again at the
// first page. Closed over in fetchRows instead, a new term would do nothing. In client mode, filter does nothing:
// filter rows yourself.
const [sort, setSort] = useState<SortItem[]>([]);
const [term, setTerm] = useState('');
const q = useDebounced(term.trim(), 250); // one request once typing stops
const view: TableView = { sort, filter: q ? { q } : undefined };
const server = useServerRows({ view, fetchRows, fetchCount, pageSize: 50, mode: 'load-more' });
// A new filter clears the selection, so an action never reaches rows that aren't shown. A selection that changes
// in the same render as the filter (a saved view restored with its checked rows) is kept.
const [selection, setSelection] = useState<Selection>({ kind: 'ids', ids: new Set() });

<TextField type="search" label="Search titles" value={term} onChange={(e) => setTerm(e.target.value)} />
{/* Says how many rows matched, for screen readers: the table's own count isn't announced.
    Only once this search's rows are on screen: until then, total is the last view's. */}
<p role="status" className="ld-sr-only">
  {q && server.state.rows === 'current' && server.total != null ? found(server.total) : ''}
</p>
<DataTable
  caption="Work items"
  processing="server"
  view={view}
  onViewChange={(next) => setSort(next.sort)}
  selectionMode="multiple"
  selection={selection}
  onSelectionChange={setSelection}
  {...server}
  /* columns, noun, getRowId, rowHeader, bulkActions */
/>

// "21 work items found", "50+ work items found"
function found(total: Total) {
  const n = typeof total === 'number' ? total : total.atLeast;
  const more = typeof total === 'number' ? '' : '+';
  return \`\${n.toLocaleString()}\${more} \${n === 1 && !more ? 'work item' : 'work items'} found\`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
`;

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

function SearchExample() {
  const [server] = React.useState(() => createWorkServer());
  const [sort, setSort] = React.useState<TableView['sort']>([]);
  const [term, setTerm] = React.useState('');
  const q = useDebounced(term.trim(), 250);
  const view = React.useMemo<TableView>(() => ({ sort, filter: q ? { q } : undefined }), [sort, q]);
  const rows = useServerRows({ view, fetchRows: server.fetchRows, fetchCount: server.fetchCount, pageSize: 50, mode: 'load-more' });
  const [selection, setSelection] = React.useState<Selection>({ kind: 'ids', ids: new Set() });
  const reserved = useReserve('dt-search', rows.state.rows === 'current', !!rows.state.failure);
  // Its rows load after the page mounts, so Back to a row here finds it only once they're in.
  React.useEffect(() => { if (rows.state.rows === 'current') restoreFocus(); }, [rows.state.rows]);
  return (
    <>
      <div className="docs-demo">
        <TextField type="search" label="Search titles" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {/* Only once this search's rows are on screen: until then `total` is the last view's. */}
      <p id="dt-search-status" role="status" className="ld-sr-only">
        {q && rows.state.rows === 'current' && rows.total != null ? searchCount(rows.total) : ''}
      </p>
      <div className="docs-demo-col" {...reserved}>
      <DataTable
        caption="Work items (search)"
        noun={noun}
        locale="en-US"
        columns={workColumns}
        getRowId={(r) => r.id}
        rowHeader="id"
        processing="server"
        view={view}
        onViewChange={(next) => setSort(next.sort)}
        selectionMode="multiple"
        selection={selection}
        onSelectionChange={setSelection}
        bulkActions={[{ label: 'Archive', onSelect: () => undefined }]}
        rowHref={searchHref}
        {...rows}
      />
      </div>
    </>
  );
}

function searchCount(total: Total) {
  const n = typeof total === 'number' ? total : total.atLeast;
  const more = typeof total === 'number' ? '' : '+';
  return `${n.toLocaleString('en-US')}${more} ${n === 1 && !more ? noun.one : noun.other} found`;
}

const STATES = ['Ready', 'Loading', 'Empty', 'Error', 'Stale'] as const;
const SAVED_AT = new Date(2026, 9, 31, 10, 42);
function StatesExample() {
  const [pick, setKept] = React.useState(left.pick as (typeof STATES)[number]);
  const setPick = (v: typeof pick) => { left.pick = v; setKept(v); };
  const back = () => setPick('Ready');
  // Three independent parts: whose rows are shown, whether more are on the way, and what failed.
  const state: TableState =
    pick === 'Loading' ? { rows: 'none', fetching: true }
    : pick === 'Error' ? { rows: 'none', failure: { scope: 'load', message: 'The server didn’t answer in time.', retry: back } }
    : pick === 'Stale' ? { since: SAVED_AT, failure: { scope: 'refresh', retry: back } }
    : {};
  const rows = pick === 'Ready' || pick === 'Stale' ? clientRows.slice(0, 5) : [];
  return (
    <>
      <SegmentedControl className="docs-seg-compact" label="Table state" options={[...STATES]} value={pick} onValueChange={(v) => setPick(v as typeof pick)} />
      <DataTable
        aria-label="State example"
        noun={noun}
        locale="en-US"
        columns={workColumns}
        rows={rows}
        getRowId={(r) => r.id}
        rowHeader="id"
        state={state}
        total={rows.length}
        rowHref={statesHref}
      />
    </>
  );
}

function NarrowExample() {
  return (
    <div className="docs-narrow">
      <DataTable
        caption="Work items in a narrow pane"
        noun={noun}
        locale="en-US"
        columns={workColumns}
        rows={narrowRows}
        getRowId={(r) => r.id}
        rowHeader="id"
        selectionMode="multiple"
        rowHref={narrowHref}
        rowActions={actions}
        swipeActions
        narrow="cards"
      />
    </div>
  );
}

export function DataTablePage() {
  const { hash, key } = useLocation();
  const y = useNavigationType() === 'POP' ? left.scrolls.get(key) : undefined;
  const target = y === undefined && isExample(hash.slice(1)) ? hash.slice(1) : undefined;
  // Saved once the reader has left this entry. React Router's `history.state.key` (not public API) tells that apart from
  // StrictMode's rehearsal unmount in development, which stays on the entry.
  React.useLayoutEffect(() => () => {
    if (((window.history.state as { key?: string } | null)?.key ?? 'default') !== key) left.scrolls.set(key, window.scrollY);
  }, [key]);
  // Focus moves in the commit, so a link in never paints a frame with focus on `<body>`; the scroll waits for the tables.
  React.useLayoutEffect(() => {
    // Only when this document already has focus, as PageHeader does.
    if (target && document.hasFocus()) document.getElementById(target)?.focus({ preventScroll: true });
  }, [target, key]);
  React.useEffect(() => {
    const heading = target ? document.getElementById(target) : null;
    // The tables measure their own width after the router has scrolled, so the page settles a frame later.
    const frame = requestAnimationFrame(() => {
      if (heading) heading.scrollIntoView();
      else if (y !== undefined) window.scrollTo(0, y);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, y, key]);
  return (
    <div className="ld-flow">
      <PageHeader
        focusOnMount={!target}
        title="Data table"
        back={{ href: '/blocks', label: 'Blocks' }}
        summary={<>A <code>{'<table>'}</code> with sorting, selection, row links, row actions, paging and states. In client mode it sorts the rows you give it, and in server mode it reports the view and you fetch the rows.</>}
      />
      <Section
        id="dt-client"
        title="Client mode"
        summary={<>For a few hundred rows or fewer, already loaded, which the table sorts by each column’s <code>value</code> or <code>compare</code>. Shift-click a checkbox to select a range, or check the header’s box to select the page.</>}
      >
        <ClientExample />
        <Code label="Code for a client-mode table" defaultOpen>{CLIENT_CODE}</Code>
      </Section>
      <Section
        id="dt-server"
        title="Server mode"
        summary={<><code>useServerRows</code> fetches pages for each view, caches them, merges duplicate requests and cancels ones that go out of date. The count reads “50 of 100+” until the exact figure arrives, and sorting twice quickly shows a canceled request in the log.</>}
      >
        <ServerExample />
        <Code label="Code for a server-mode table">{SERVER_CODE}</Code>
      </Section>
      <Section
        id="dt-search"
        title="Search and filters"
        summary={<>A filter is part of the view: put a search term or a status in <code>view.filter</code>, and it reaches <code>fetchRows</code> and <code>fetchCount</code>, keys the cache, survives a sort and starts again at the first page. A view holds plain JSON values, so it can go in a URL.</>}
      >
        <SearchExample />
        <Code label="Code for a search">{SEARCH_CODE}</Code>
      </Section>
      <Section
        id="dt-states"
        title="States"
        summary="Skeleton rows hold the layout while rows load, and an empty table says so. An error offers to try again, and stale rows stay usable under a notice."
      >
        <StatesExample />
        <Code label="Code for each table state">{STATES_CODE}</Code>
      </Section>
      <Section
        id="dt-narrow"
        title="Narrow containers"
        summary={<>The table picks its layout from its own width, so it adapts inside a narrow pane on any screen. Below <code>narrowBelow</code> (560px by default), <code>narrow="cards"</code> shows each row as a card with a title, a status and up to three fields, placed by each column’s <code>card</code> option, and <code>narrow="scroll"</code>, the default, keeps the table with a sticky first column.</>}
      >
        <NarrowExample />
        <Code label="Code for a narrow container">{NARROW_CODE}</Code>
      </Section>
      <Section id="dt-parts" title="Table parts" summary="The styled, stateless Table parts that DataTable is built from. Use them on their own for a small static table.">
        <div className="docs-parts">
          <Table.Root caption="Quarter totals">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Quarter</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell align="end">Amount</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {[['Q2', 'Done', 9850], ['Q3', 'In progress', 12400]].map(([q, s, n]) => (
                <Table.Row key={q}>
                  <Table.RowHeader>{q}</Table.RowHeader>
                  <Table.Cell><StatusChip status={s as WorkItem['status']} /></Table.Cell>
                  <Table.Cell align="end">{formatMoney(n as number)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
        <Code label="Code for a table built from parts">{PARTS_CODE}</Code>
      </Section>
      <Section
        id="dt-collapse"
        title="Collapsing a table"
        summary={<>Give a captioned table <code>collapsible</code>, and its caption becomes a button that hides the header and rows from sight and from screen readers. The <code>summary</code> stays below the caption’s title, so a collapsed table still says what it holds.</>}
      >
        <div className="docs-parts">
          <Table.Root caption="Quarter totals" collapsible={{ summary: `2 quarters · ${formatMoney(22250)}` }}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Quarter</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell align="end">Amount</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {[['Q2', 'Done', 9850], ['Q3', 'In progress', 12400]].map(([q, s, n]) => (
                <Table.Row key={q}>
                  <Table.RowHeader>{q}</Table.RowHeader>
                  <Table.Cell><StatusChip status={s as WorkItem['status']} /></Table.Cell>
                  <Table.Cell align="end">{formatMoney(n as number)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
        <Code label="Code for a collapsible table">{COLLAPSE_CODE}</Code>
      </Section>
    </div>
  );
}
