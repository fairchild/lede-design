import * as React from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { DataTable } from '@lede/blocks/data-table';
import { useServerRows, type ServerRowsRequest, type ServerRowsResponse } from '@lede/blocks/use-server-rows';
import { isSelected, useDataTable, type Column, type DataTableModel, type Selection, type TableState, type TableView } from '@lede/blocks/use-data-table';
import { SegmentedControl } from '@lede/segmented-control';
import { Button } from '@lede/button';
import type { RowAction } from '@lede/list';

/**
 * Test fixtures for edge cases the docs and demo don't exercise: a cursor-only server, a page size that changes at
 * runtime, a column sorted only by `compare`, card fields wider than their line, tables in other locales, an
 * uncontrolled selection whose rows are archived and a server table's first frames. Not linked from the navigation;
 * tests/data-table.spec.ts drives it.
 */
type Item = { id: string; n: number; rank: number };
const ITEMS: Item[] = Array.from({ length: 10 }, (_, n) => ({ id: `i${n}`, n, rank: [3, 1, 2, 9, 7, 8, 6, 4, 5, 0][n] }));
const noun = { one: 'item', other: 'items' };
const columns: Column<Item>[] = [
  { id: 'n', label: 'Number', value: (r) => r.n },
  // Sortable through `compare` alone: no `value`, a custom cell.
  { id: 'rank', label: 'Rank', cell: (r) => `#${r.rank}`, compare: (a, b) => a.rank - b.rank, sortable: true },
];
const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

/** A cursor-only server: the cursor is the next index; the offset is ignored, as a keyset API would. */
async function cursorRows(req: ServerRowsRequest): Promise<ServerRowsResponse<Item>> {
  await delay(40, req.signal);
  const start = req.cursor ? Number(req.cursor) : 0;
  const rows = ITEMS.slice(start, start + req.limit);
  const next = start + rows.length;
  return { rows, nextCursor: next < 6 ? String(next) : null };
}
/** An offset-only server. */
async function offsetRows(req: ServerRowsRequest): Promise<ServerRowsResponse<Item>> {
  await delay(40, req.signal);
  return { rows: ITEMS.slice(req.offset, req.offset + req.limit), total: ITEMS.length };
}

function CursorFixture() {
  const [view, setView] = React.useState<TableView>({ sort: [] });
  const rows = useServerRows({ view, fetchRows: cursorRows, pageSize: 2 });
  return (
    <section aria-labelledby="fx-cursor" className="docs-section">
      <h2 id="fx-cursor" className="text-title-3">Cursor paging</h2>
      <Button variant="gray" onClick={rows.reload}>Reload cursor fixture</Button>
      <DataTable aria-label="Cursor fixture" noun={noun} columns={columns} getRowId={(r) => r.id} rowHeader="n" processing="server" view={view} onViewChange={setView} {...rows} />
    </section>
  );
}

function PageSizeFixture() {
  const [view, setView] = React.useState<TableView>({ sort: [] });
  const [size, setSize] = React.useState('2');
  const rows = useServerRows({ view, fetchRows: offsetRows, pageSize: Number(size) });
  return (
    <section aria-labelledby="fx-size" className="docs-section">
      <h2 id="fx-size" className="text-title-3">Page size</h2>
      <SegmentedControl label="Page size" options={['2', '3']} value={size} onValueChange={setSize} />
      <DataTable aria-label="Page size fixture" noun={noun} columns={columns} getRowId={(r) => r.id} rowHeader="n" processing="server" view={view} onViewChange={setView} {...rows} />
    </section>
  );
}

/** Client mode pages too: the caller slices its own rows, and they render in the same commit as the press. */
function ClientPagesFixture() {
  const [page, setPage] = React.useState(0);
  return (
    <section aria-labelledby="fx-client-pages" className="docs-section">
      <h2 id="fx-client-pages" className="text-title-3">Client pages</h2>
      <DataTable
        aria-label="Client pages fixture"
        noun={noun}
        columns={columns}
        rows={ITEMS.slice(page * 3, page * 3 + 3)}
        getRowId={(r) => r.id}
        rowHeader="n"
        total={ITEMS.length}
        paging={{ kind: 'pages', page, pageCount: 4, onPageChange: setPage }}
      />
    </section>
  );
}

function ClientMoreFixture() {
  const [shown, setShown] = React.useState(3);
  return (
    <section aria-labelledby="fx-client-more" className="docs-section">
      <h2 id="fx-client-more" className="text-title-3">Client load more</h2>
      <DataTable
        aria-label="Client load more fixture"
        noun={noun}
        columns={columns}
        rows={ITEMS.slice(0, shown)}
        getRowId={(r) => r.id}
        rowHeader="n"
        total={ITEMS.length}
        paging={{ kind: 'load-more', hasMore: shown < ITEMS.length, onLoadMore: () => setShown((n) => n + 3) }}
      />
    </section>
  );
}

/** A server that says there may be more and then has none: Load more adds no rows and leaves. */
function NothingMoreFixture() {
  const [ended, setEnded] = React.useState(false);
  return (
    <section aria-labelledby="fx-nothing-more" className="docs-section">
      <h2 id="fx-nothing-more" className="text-title-3">Nothing more</h2>
      <DataTable
        aria-label="Nothing more fixture"
        noun={noun}
        columns={columns}
        rows={ITEMS.slice(0, 2)}
        getRowId={(r) => r.id}
        rowHeader="n"
        paging={{ kind: 'load-more', hasMore: !ended, onLoadMore: () => setEnded(true) }}
      />
    </section>
  );
}

const rankRows = ITEMS.slice(0, 3);
function CompareFixture() {
  return (
    <section aria-labelledby="fx-compare" className="docs-section">
      <h2 id="fx-compare" className="text-title-3">Compare-only column</h2>
      <DataTable
        aria-label="Compare fixture"
        noun={noun}
        columns={columns}
        rows={rankRows}
        getRowId={(r) => r.id}
        rowHeader="n"
        defaultView={{ sort: [{ columnId: 'rank', direction: 'ascending' }] }}
      />
    </section>
  );
}

/**
 * A server that holds every answer until "Answer waiting requests" is pressed, so a test can act inside the window
 * where a new filter's rows are on their way and the last view's rows are still on screen.
 */
type Num = { id: string; n: number };
const NUMS: Num[] = Array.from({ length: 30 }, (_, n) => ({ id: `n${n}`, n }));
const numColumns: Column<Num>[] = [{ id: 'n', label: 'Number', value: (r) => r.n }];
function heldServer() {
  const queue: Array<() => void> = [];
  const listeners = new Set<() => void>();
  const emit = () => { for (const fn of listeners) fn(); };
  return {
    waiting: () => queue.length,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    fetchRows: (req: ServerRowsRequest) => new Promise<ServerRowsResponse<Num>>((resolve, reject) => {
      const list = req.view.filter?.even ? NUMS.filter((r) => r.n % 2 === 0) : NUMS;
      const answer = () => resolve({ rows: list.slice(req.offset, req.offset + req.limit), total: list.length });
      queue.push(answer);
      emit();
      req.signal.addEventListener('abort', () => {
        const i = queue.indexOf(answer);
        if (i >= 0) queue.splice(i, 1);
        reject(new DOMException('Aborted', 'AbortError'));
        emit();
      }, { once: true });
    }),
    release: () => { for (const answer of queue.splice(0)) answer(); emit(); },
  };
}

/** A selection as plain JSON, the way a URL or a store holds one. */
type PlainSelection = { kind: Selection['kind']; ids: string[] };
const toPlain = (s: Selection): PlainSelection => ({ kind: s.kind, ids: [...(s.kind === 'ids' ? s.ids : s.except)] });
const fromPlain = (p: PlainSelection): Selection =>
  p.kind === 'ids' ? { kind: 'ids', ids: new Set(p.ids) } : { kind: 'all-matching', except: new Set(p.ids) };

function HeldFilterFixture() {
  const [server] = React.useState(heldServer);
  const waiting = React.useSyncExternalStore(server.subscribe, server.waiting, server.waiting);
  const [filter, setFilter] = React.useState('All');
  // "Built in render" passes a new Selection object on every render, built from plain JSON.
  const [kept, setKept] = React.useState('In state');
  const [held, setHeld] = React.useState<Selection>({ kind: 'ids', ids: new Set() });
  const [plain, setPlain] = React.useState<PlainSelection>({ kind: 'ids', ids: [] });
  const built = kept === 'Built in render';
  const selection = built ? fromPlain(plain) : held;
  const setSelection = (s: Selection) => (built ? setPlain(toPlain(s)) : setHeld(s));
  const view = React.useMemo<TableView>(() => ({ sort: [], filter: filter === 'Even' ? { even: true } : undefined }), [filter]);
  const rows = useServerRows({ view, fetchRows: server.fetchRows, pageSize: 5 });
  // Restoring a saved view sets its filter and its selection together, in one handler.
  const restore = () => { setFilter('Even'); setSelection({ kind: 'ids', ids: new Set(['n2', 'n4']) }); };
  return (
    <section aria-labelledby="fx-held" className="docs-section">
      <h2 id="fx-held" className="text-title-3">A filter whose rows are held</h2>
      <SegmentedControl label="Filter" options={['All', 'Even']} value={filter} onValueChange={setFilter} />
      <SegmentedControl label="Selection kept" options={['In state', 'Built in render']} value={kept} onValueChange={setKept} />
      <Button variant="gray" onClick={server.release}>Answer waiting requests</Button>
      <span>{`${waiting} waiting`}</span>
      <Button variant="gray" onClick={restore}>Restore a saved view</Button>
      <DataTable
        aria-label="Held filter fixture"
        noun={noun}
        columns={numColumns}
        getRowId={(r) => r.id}
        rowHeader="n"
        processing="server"
        view={view}
        onViewChange={() => undefined}
        selectionMode="multiple"
        selection={selection}
        onSelectionChange={setSelection}
        bulkActions={[{ label: 'Archive', onSelect: () => undefined }]}
        {...rows}
      />
    </section>
  );
}

/** Selectable cards in a narrow pane whose fields are wider than the line: each must wrap inside itself, cut off nowhere. */
type Person = { id: string; name: string; email: string; role: string; status: string };
const LONG_PEOPLE: Person[] = [
  { id: 'P-1', name: 'Alexandria Catherine Montgomery-Vandenberg', email: 'alexandria.montgomery-vandenberg@accounts.northwind.example', role: 'Director of international supplier partnerships', status: 'Active' },
  { id: 'P-2', name: 'Ana Ruiz', email: 'ana@northwind.example', role: 'Designer', status: 'Away' },
];
const personColumns: Column<Person>[] = [
  { id: 'id', label: 'ID', value: (r) => r.id, card: 1 },
  { id: 'name', label: 'Name', value: (r) => r.name, card: 'title' },
  { id: 'email', label: 'Email', value: (r) => r.email, card: 2 },
  { id: 'role', label: 'Role', value: (r) => r.role, card: 3 },
  { id: 'status', label: 'Status', value: (r) => r.status, card: 'status' },
];
function LongFieldsFixture() {
  return (
    <section aria-labelledby="fx-long" className="docs-section">
      <h2 id="fx-long" className="text-title-3">Long card fields</h2>
      <div className="docs-narrow">
        <DataTable
          caption="Long card fields"
          noun={{ one: 'person', other: 'people' }}
          columns={personColumns}
          rows={LONG_PEOPLE}
          getRowId={(r) => r.id}
          rowHeader="id"
          selectionMode="multiple"
          narrow="cards"
        />
      </div>
    </section>
  );
}

/**
 * `locale` reaching the numbers, dates and client sort: in de-DE a thousand is "1.000", and in Estonian z sorts
 * before t, so "zoo" comes before "tee". en-US differs on both. The Estonian table's locale switches on the mounted
 * table, with the same rows, so a test can see it re-sort. The German cards show a number field and a date status,
 * which cards format apart from table cells.
 */
type Word = { id: string; word: string; n: number; seen: Date };
const WORDS: Word[] = [{ id: 'w1', word: 'tee', n: 1234.5, seen: new Date(2026, 9, 5) }, { id: 'w2', word: 'zoo', n: 2, seen: new Date(2026, 9, 6) }];
const wordNoun = { one: 'word', other: 'words' };
const wordColumns: Column<Word>[] = [
  { id: 'word', label: 'Word', value: (r) => r.word, sortable: true },
  { id: 'n', label: 'Number', value: (r) => r.n, align: 'end' },
];
const wordCardColumns: Column<Word>[] = [
  { id: 'word', label: 'Word', value: (r) => r.word },
  { id: 'n', label: 'Number', value: (r) => r.n, card: 1 },
  { id: 'seen', label: 'Seen', value: (r) => r.seen, card: 'status' },
];
const BY_WORD: TableView = { sort: [{ columnId: 'word', direction: 'ascending' }] };
const MANY_PAGES = { kind: 'pages' as const, page: 0, pageCount: 1200, onPageChange: () => undefined };
function LocaleFixture() {
  const [sortLocale, setSortLocale] = React.useState('et');
  return (
    <section aria-labelledby="fx-locale" className="docs-section">
      <h2 id="fx-locale" className="text-title-3">Locales</h2>
      <DataTable
        aria-label="German fixture"
        locale="de-DE"
        noun={wordNoun}
        columns={wordColumns}
        rows={WORDS}
        getRowId={(r) => r.id}
        rowHeader="word"
        selectionMode="multiple"
        total={1234}
        paging={MANY_PAGES}
      />
      <SegmentedControl label="Estonian fixture locale" options={['et', 'en-US']} value={sortLocale} onValueChange={setSortLocale} />
      <DataTable aria-label="Estonian fixture" locale={sortLocale} noun={wordNoun} columns={wordColumns} rows={WORDS} getRowId={(r) => r.id} rowHeader="word" defaultView={BY_WORD} />
      <div className="docs-narrow">
        <DataTable aria-label="German cards" locale="de-DE" noun={wordNoun} columns={wordCardColumns} rows={WORDS} getRowId={(r) => r.id} rowHeader="word" narrow="cards" />
      </div>
    </section>
  );
}

/**
 * Rows that leave while focus is in them: a row's own Delete removes it at once, and the bulk Delete clears the
 * selection, so the bar leaves, a moment before its rows do.
 */
function RemovalFixture() {
  const [rows, setRows] = React.useState(() => NUMS.slice(0, 4));
  const [selection, setSelection] = React.useState<Selection>({ kind: 'ids', ids: new Set() });
  const actions = React.useCallback((r: Num): RowAction[] => [
    { label: 'Delete', tone: 'critical', onSelect: () => setRows((all) => all.filter((x) => x.id !== r.id)) },
    // Ends with the row still there, as a failed archive does, and renders the table again a moment later.
    { label: 'Refresh', onSelect: () => { setTimeout(() => setRows((all) => [...all]), 100); } },
  ], []);
  const bulkDelete = (s: Selection) => {
    setSelection({ kind: 'ids', ids: new Set() });
    setTimeout(() => setRows((all) => all.filter((x) => !isSelected(s, x.id))), 100);
  };
  return (
    <section aria-labelledby="fx-removal" className="docs-section">
      <h2 id="fx-removal" className="text-title-3">Removal</h2>
      <DataTable
        aria-label="Removal fixture"
        noun={noun}
        columns={numColumns}
        rows={rows}
        getRowId={(r) => r.id}
        rowHeader="n"
        rowHref={(r) => `#${r.id}`}
        rowActions={actions}
        selectionMode="multiple"
        selection={selection}
        onSelectionChange={setSelection}
        bulkActions={[{ label: 'Delete', onSelect: bulkDelete }]}
      />
    </section>
  );
}

/**
 * An uncontrolled selection with a bulk Archive that removes its rows, in client pages of 3. Each Archive press is
 * listed with the ids it received, so a test can see a second press send nothing already archived.
 */
/** Its own noun, so its pager's landmark name differs from the client pages fixture's. */
const entryNoun = { one: 'entry', other: 'entries' };
function UncontrolledFixture() {
  const [rows, setRows] = React.useState(() => NUMS.slice(0, 7));
  const [page, setPage] = React.useState(0);
  const [sent, setSent] = React.useState<string[]>([]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 3));
  const at = Math.min(page, pageCount - 1);
  const archive = (s: Selection) => {
    setSent((all) => [...all, rows.filter((r) => isSelected(s, r.id)).map((r) => r.id).join(',')]);
    setRows((all) => all.filter((r) => !isSelected(s, r.id)));
  };
  return (
    <section aria-labelledby="fx-uncontrolled" className="docs-section">
      <h2 id="fx-uncontrolled" className="text-title-3">Uncontrolled selection</h2>
      <ol aria-label="Archive presses">{sent.map((ids, i) => <li key={i}>{ids || 'nothing'}</li>)}</ol>
      <DataTable
        aria-label="Uncontrolled fixture"
        noun={entryNoun}
        columns={numColumns}
        rows={rows.slice(at * 3, at * 3 + 3)}
        getRowId={(r) => r.id}
        rowHeader="n"
        rowHref={(r) => `#${r.id}`}
        total={rows.length}
        paging={{ kind: 'pages', page: at, pageCount, onPageChange: setPage }}
        selectionMode="multiple"
        bulkActions={[{ label: 'Archive', onSelect: archive }]}
      />
    </section>
  );
}

/**
 * A server table mounted on demand, so a test watches its first frames. Its Label column is sortable with neither
 * `value` nor `compare`: the server sorts.
 */
const labelColumns: Column<Item>[] = [
  { id: 'n', label: 'Number', value: (r) => r.n },
  { id: 'label', label: 'Label', cell: (r) => `Item ${r.n}`, sortable: true },
];
function ServerTable() {
  const [view, setView] = React.useState<TableView>({ sort: [] });
  const rows = useServerRows({ view, fetchRows: offsetRows, pageSize: 3 });
  return <DataTable aria-label="Mounted server fixture" noun={noun} columns={labelColumns} getRowId={(r) => r.id} rowHeader="n" processing="server" view={view} onViewChange={setView} {...rows} />;
}
function MountedServerFixture() {
  const [shown, setShown] = React.useState(false);
  return (
    <section aria-labelledby="fx-mounted" className="docs-section">
      <h2 id="fx-mounted" className="text-title-3">A server table mounted later</h2>
      <Button variant="gray" onClick={() => setShown(true)}>Show the server table</Button>
      {shown ? <ServerTable /> : null}
    </section>
  );
}

/**
 * The hook alone, driven from a test through `window.ledeHookProbe`: its selection model, and a setter for
 * `state.rows`. For the headless contract the rendered table doesn't reach (its checkboxes are disabled).
 */
type ProbeWindow = { ledeHookProbe?: { model: DataTableModel<Num>; setRows: (rows: TableState['rows']) => void } };
const probeRows = NUMS.slice(0, 6);
function HookProbe() {
  const [rows, setRows] = React.useState<TableState['rows']>('current');
  const model = useDataTable({
    columns: numColumns, rows: probeRows, getRowId: (r) => r.id, rowHeader: 'n', noun,
    selectionMode: 'multiple', state: { rows },
  });
  React.useEffect(() => { (window as unknown as ProbeWindow).ledeHookProbe = { model, setRows }; });
  const value = model.selection.value;
  return (
    <p data-testid="hook-probe" data-inert={String(model.selection.inert)}>
      {value.kind === 'ids' ? [...value.ids].sort().join(',') : 'all'}
    </p>
  );
}

export function DataTableFixtures() {
  return (
    <div className="ld-flow">
      <PageHeader title="Data table fixtures" summary="Edge cases for the automated tests." />
      <CursorFixture />
      <ClientPagesFixture />
      <ClientMoreFixture />
      <NothingMoreFixture />
      <PageSizeFixture />
      <CompareFixture />
      <HeldFilterFixture />
      <LongFieldsFixture />
      <LocaleFixture />
      <RemovalFixture />
      <UncontrolledFixture />
      <MountedServerFixture />
      <HookProbe />
    </div>
  );
}
