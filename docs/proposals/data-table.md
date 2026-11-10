# Data table for Lede: proposal

Status: agreed design for version 1, Oct 31, 2026; built Nov 1, 2026. The
[amendment](#amendment-1-as-built-nov-1-2026) records where the build changed the API and why. Example data is neutral:
work items with an ID, title, status, assignee, due date and amount. Every outside fact links to a
public source.

Settled since the first draft: Lede will expand its densities (a separate change), counts shown by
the table are exact (a server may send `{atLeast}` while it computes the exact figure), and
TanStack Table v9 is the foundation.

## Amendment 1: as built, Nov 1, 2026

The build kept the proposal's shape: a real `<table>`, TanStack behind Lede's own
types, Lede's selection model, one menu per table. Review and testing changed the API in the places below. Each
change answers a case that review or testing found.

### API changes

1. **`TableState` has independent parts, not five kinds.** Review after review of the server mode corrected what
   one of `ready | loading | refreshing | error | stale` meant, because the real state is three
   independent facts: whose rows are on screen (`rows: 'current' | 'previous' | 'none'`), whether rows
   are on the way (`fetching`), and what failed (`failure.scope`: `'load'` for this view's rows, `'refresh'`
   for rows already on screen, `'more'` for the next page). A failed Load more with good rows on screen,
   for example, had to borrow `error`. Every display decision now follows from the parts:
   - skeleton: nothing on screen, fetching, no failure;
   - `aria-busy`: fetching while the rows on screen aren't this view's;
   - "Updating…": fetching;
   - an alert for `'load'` and `'more'`; previous rows are hidden after a failed `'load'`, never passed
     off as the new view's;
   - a quiet "Showing saved data from {since}" notice with Refresh for `'refresh'`.
2. **`bulkActions` takes `BulkAction`, whose `onSelect` receives the `Selection`.** Without it, a table
   with uncontrolled selection could not act on what is selected. A handler that ignores it type-checks.
3. **`defineColumns()`**, and a development-only warning when `columns` or `rowActions` gets a new identity
   on every render. Rows are memoized against them, so an inline array silently re-rendered every row.
   The warning is stripped from production builds.
4. **`narrowBelow`** (default 560 px of the table's own width) replaces a fixed breakpoint. `narrow`
   defaults to `'scroll'` (open question 7): every column stays available, and cards are one prop away.
5. **`Table.Columns`** (the `<colgroup>`, with a `sticky` count) and **`Table.RowLink`** are two more parts.
6. **`useServerRows`** keeps its call shape and gains `staleAfter` and `reload()`. Its work is done by a
   React-free `ServerRowsStore` with an injectable clock, tested request by request without a browser.
   Its rules, each from a review finding:
   - pages are cached by `pageKey(view, pageSize)`: the page size is part of a page's identity;
   - load-more pages chain: page p is requested with page p − 1's cursor, only after it arrives;
   - a chain being revalidated (staleness or `reload()`) is rebuilt aside and swapped in whole, so old and
     new pages are never shown mixed, and a list that came back shorter drops the rows past its end;
   - a *visit* (mount, new view or page size, page change, reload) aborts the last visit's page requests
     and starts clean: nothing is retried by itself within a visit, and a failure doesn't outlive it;
   - pages mode asks by offset only.
7. **`SelectionBar`** takes `noun: {one, other}` and `count: number | {atLeast}` (open question 4).
   `ListRow` gains a leading `control` slot, `swipe`, `actionsVisible`, `actionsLabel` and `rowKey`.

### Behavior decisions

- **The header sticks to the page** while the table fits: its box clips but isn't a scroll container.
  Only a table wider than its box gets its own scroll box (with a max height, and named as a focusable
  region). Focus is kept clear of the sticky header and columns with `scroll-margin` from tokens, so it
  works whichever box scrolls.
- **Column widths are CSS.** Each column grows from `min` toward `preferred` as a `calc()` on the box's
  width (`100cqi`), written once and never measured. Percentages in `calc()` on `<col>` fall back to
  auto in Chromium; container units don't.
- **Every row mounts a real Base UI `Menu.Trigger`**, about a third of a 500-row mount. Mounting them
  after the first paint was tried and reverted: swapping the button under a real mouse press or touch tap
  lost the click, and on touch the focus. Speed stays inside the primitives' contracts.
- **A performance budget runs in CI** (test-plan item 7): DataTable against the same 500 rows written by
  hand, as a ratio, so it holds on any machine. Mount is 1.55–1.9× that floor (the triggers are most of the
  difference), sort about 0.85×: rows are memoized, so a sort moves them without re-rendering.
- **Kept, by decision:**
  - truncated text in cells without a control shows in full on hover, and to screen readers; keyboard
    users see it in full only in cells that take focus, until version 2's grid gives every cell focus;
  - a sticky row-header cell needs a hidden twin link to cover the rest of the row (a positioned cell
    confines the link's `::after`);
  - swipe actions apply to the card layout only; wide tables have the visible menu;
  - TanStack stays: version 1 uses only its sorting, but version 2's column order, visibility, sizing,
    pinning, multi-sort and filters are what it is for;
  - open question 5: whether to disable server actions on stale data is left to the caller, who knows
    which actions are safe.

## Summary

- **Foundation:** TanStack Table v9 (MIT) for table state, behind Lede's own types, with Lede
  markup on a real `<table>`. Base UI supplies the menu (the checkbox is native; see the amendment), and React Aria supplies
  only small utilities: the live announcer now, focus helpers in version 2. TanStack Virtual (MIT)
  joins in version 2.
- **Not React Aria's `Table` component as the foundation.** It is the most accessible ready-made
  table, but it always renders an ARIA grid. In our measurement it was about 10× slower than a
  plain table at 500 rows, and at 10,000 it crashed the tab. Version 1 asks for table semantics,
  not a grid.
- **Not AG Grid Community, and not MUI X's free tier.** Both own their DOM and styling. Their
  server-side and grouping features are paid, and the free MUI grid is capped at 100-row pages.
- **The API comes in three layers,** matching Lede's own:
  1. `Table` parts, styled semantic markup;
  2. a `useDataTable` hook, the state;
  3. the `DataTable` block, the ready-made composition most screens use.
- **One serialisable `view` object** holds sort now. Filters, column order, visibility, widths,
  pins, density and grouping join it later as new optional keys. Selection and paging stay outside
  it, because a saved view should not save them.
- **Version 1 is about 600–900 lines** across the parts, hook and block, plus tests. Version 2
  registers more TanStack features, adds keys to `view` and opts into the grid keyboard model
  through a new prop. No version 1 call site changes.

## Foundation options

Sizes are minified and gzipped, measured with esbuild with React external. "Ours" means we write
it.

|                                        | React Aria Table (Apache-2.0)                                                               | TanStack Table v9 + Virtual (MIT)                          | shadcn data-table pattern                  | AG Grid Community (MIT)                                                                    | MUI X DataGrid free (MIT)                                | Plain `<table>`, all ours               |
| -------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------- |
| **Maintenance**                        | Adobe, very active                                                                          | TanStack, very active; v9 stable Aug 2026                  | Copy-in recipe, still shows the v8 API     | Company; majors every 6 months                                                             | Company; v9 April 2026                                   | Us                                      |
| **Size**                               | 64 KB for `Table` + `Checkbox`                                                              | 14 KB for core + sort + selection; 35 KB for every feature | Same as TanStack, plus shadcn table markup | About 377 KB whole package; less when modular                                              | About 124 KB plus Material UI and Emotion                | 0 KB                                    |
| **Semantics**                          | Always `role="grid"`/`treegrid`                                                             | Ours: `<table>` in v1, grid in v2                          | `<table>`                                  | `role="grid"`                                                                              | `role="grid"`                                            | Ours                                    |
| **Keyboard**                           | Full grid model built in                                                                    | Ours                                                       | Tab order only                             | Full grid model                                                                            | Full grid model                                          | Ours                                    |
| **Screen-reader evidence**             | Strong: announces sort and selection itself, and works around TalkBack ignoring `aria-sort` | Depends on our markup                                      | Native table                               | Vendor-tested with JAWS and VoiceOver; lists gaps (row count not announced in server mode) | Vendor claims                                            | Native table                            |
| **Virtualization**                     | Yes, but slowest in published benchmarks                                                    | TanStack Virtual (rows and columns)                        | No                                         | Yes                                                                                        | Paid tiers beyond one page                               | Ours                                    |
| **Server-side rows**                   | Ours (async loading helpers)                                                                | Ours (`manual*` options)                                   | Ours                                       | Infinite model free; server-side row model paid                                            | Paging free; lazy loading Pro; server grouping Premium   | Ours                                    |
| **Inline editing**                     | Ours, inside cells                                                                          | Ours (state helpers)                                       | Ours                                       | Built in                                                                                   | Built in                                                 | Ours                                    |
| **Server rendering**                   | Yes                                                                                         | Yes (headless)                                             | Yes                                        | Client only                                                                                | Yes                                                      | Yes                                     |
| **Styling we own**                     | All of it (unstyled, data attributes)                                                       | All of it                                                  | All of it                                  | Theme parameters (accepts `var(--token)`), its own DOM                                     | Material theme and Emotion                               | All of it                               |
| **Fit with Base UI, Tailwind, tokens** | Good, though it brings its own checkbox and focus model                                     | Excellent                                                  | Excellent                                  | Fair                                                                                       | Poor                                                     | Excellent                               |
| **Speed at 500 rows** (measured)       | Mount about 1.5 s, select about 1.2 s                                                       | Mount about 0.12 s, select about 0.02 s                    | Same as TanStack                           | Not measured                                                                               | Not measured                                             | Mount about 0.11 s, select under 0.01 s |
| **License traps**                      | None                                                                                        | None                                                       | None                                       | Server-side row model, grouping, clipboard and Excel are Enterprise                        | Most server and data-shaping features are Pro or Premium | None                                    |

A combination (TanStack for state, React Aria for keyboard and accessibility) works only through
React Aria's lower-level hooks. They go through the same collection layer as its `Table`
component, so they bring the same cost. We take smaller pieces instead:

- `@react-aria/live-announcer` for polite announcements;
- `@react-aria/focus` utilities in version 2, if they earn their place;
- the keyboard grid model itself, which is about 200–300 lines following the APG pattern (see
  Version 2).

### Why TanStack in version 1, when a plain table would do

A plain table could do version 1's sort and selection in fewer lines, and it would cost no bytes.
We choose TanStack anyway, for these reasons:

- Each version 2 feature already exists as a TanStack feature with serialisable state: column
  order, visibility, sizing, pinning, multi-sort, filters, grouping, expanding, cell selection and
  pagination. Version 2 registers features instead of writing them.
- Version 1 pays 14 KB for that.
- Its v9 state lives in TanStack Store, with `Subscribe` for per-row updates, which version 2's
  per-cell edits need.

The guarantee of a non-breaking version 2 comes from Lede's own types, not from the library.
TanStack went from v8 to v9 with breaking changes. Callers never see TanStack types, so a future
major is absorbed inside the hook.

## Our measurement

There was no published benchmark at the row counts of the draft, the first version of this proposal, so we
measured. The harness:

- **Variants:** a plain React `<table>` with memoized rows, TanStack Table v9.3.1 rendering the
  same markup and React Aria Components 1.22.1 `Table` with its documented defaults.
- **Data:** 8 columns (checkbox, ID link, title, status, assignee, due date, amount, actions
  button).
- **Runtime:** React 19.2.8 production build in Playwright Chromium. Each timing is from a fresh
  page and includes style and layout.
- **Machine:** a 4-core server container that runs a fixed JavaScript loop about 3–4× slower than
  a current laptop. "1×" is therefore roughly a mid-range tablet; "2×" adds Chrome's CPU throttle
  on top.
- **Reporting:** median of 5 runs (3 at 2×). Times are in milliseconds.

Fixed table layout; milliseconds, median.

|   Rows | CPU | Variant            |       Mount | Sort (toggle) | Select one row |
| -----: | --- | ------------------ | ----------: | ------------: | -------------: |
|    500 | 1×  | Plain `<table>`    |         111 |            89 |              2 |
|    500 | 1×  | TanStack Table v9  |         124 |           108 |             16 |
|    500 | 1×  | React Aria `Table` |       1,500 |         1,109 |          1,204 |
|    500 | 2×  | Plain `<table>`    |         300 |           267 |              7 |
|    500 | 2×  | TanStack Table v9  |         323 |           289 |             38 |
|    500 | 2×  | React Aria `Table` |       3,881 |         2,969 |          2,788 |
| 10,000 | 1×  | Plain `<table>`    |       2,036 |         2,960 |             13 |
| 10,000 | 1×  | TanStack Table v9  |       2,025 |         2,762 |            201 |
| 10,000 | 1×  | React Aria `Table` | tab crashed |               |                |

With automatic table layout at 500 rows (1×), the plain table took 118 ms to mount and 120 to sort,
and TanStack 163 and 120. At 10,000 rows the two layouts were mixed. React Aria crashed the tab at
10,000 rows under both layouts. The rendered page held about 6,000 DOM nodes per 500 rows. Google's
"good" responsiveness threshold (INP) is 200 ms
([web.dev](https://web.dev/articles/inp)).

**Reading the results:**

- **At 500 rows, the library does not matter; the DOM does.** A plain table and TanStack cost the
  same: about 90–125 ms to mount or sort at 1×, and about 270–320 ms at 2×. The 2× figures are
  past the 200 ms "good" threshold. "Smooth at 500 rows" on a tablet therefore depends on the page
  size. Default to about 50 rows, allow up to 500 and use `table-layout: fixed`, which was cheaper
  at 500 rows (89 against 120 ms to sort).
- **10,000 unvirtualized rows** cost 2–3 s for any option, so virtualization is a version 2
  feature, not an option.
- **React Aria's `Table` is about 10× slower** at 500 rows, and it crashed the tab at 10,000.
- **Limits:**
  - This is one machine and one engine (Chromium). No real Android device was used.
  - Scrolling was not measured.
  - The TanStack variant re-rendered every row on a selection toggle. Memoized rows, as in the
    plain variant, or v9's per-row `Subscribe`, should bring that down to the plain figure; that
    was not measured.

## Version 1 API

### Changes from the draft, and why

| Draft                                      | Proposal                                                                                                          | Why                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sort: {columnId, direction} \| null`      | `view.sort: SortItem[]` (at most one item in v1)                                                                  | Multi-sort in v2 is then a longer array, not a new type                                                                                             |
| `sort`, `defaultSort`, `onSortChange`      | `view`, `defaultView`, `onViewChange(view, change)`                                                               | One controlled object that grows key by key and serializes for saved views. `change` says what changed, so callers can map it to their own commands |
| `selectedIds: Set \| 'all-matching'`       | `{kind: 'ids', ids} \| {kind: 'all-matching', except}`                                                            | Clearing one row after "select all N" needs an exception list; AG Grid (`selectAll` + `toggledNodes`) and React Aria (`'all'`) both learned this   |
| `sortMode: 'client' \| 'server'`           | `processing: 'client' \| 'server'`                                                                                | One switch that later covers filtering and grouping too, so v2 adds no second mode prop                                                             |
| `header: ReactNode`                        | `label: string` plus optional `header: ReactNode`                                                                 | Sort announcements, card field labels, the v2 column menu and the checkbox names all need plain text                                                |
| `sortValue`                                | `value` (and an optional `compare`)                                                                               | One accessor serves client sort, v2 TSV copy and the card summary                                                                                   |
| `isRowHeader` on each column               | `rowHeader: columnId` on the table                                                                                | "Exactly one" becomes a type, not a convention                                                                                                      |
| `priority?: 1 \| 2 \| 3`                   | `card?: 'status' \| 1 \| 2 \| 3`                                                                                  | Cards need the status chip's column as well as the summary order                                                                                    |
| `status` plus `staleSince` plus `onRetry`  | `state: {kind: 'ready' \| 'loading' \| 'refreshing'} \| {kind: 'error', retry} \| {kind: 'stale', since, retry?}` | Impossible combinations cannot be written, and "refreshing" (data shown while reloading) gets a name                                                |
| `totalCount?: number`                      | `total?: number \| {atLeast: number}`                                                                             | A server with capped counts can say "50 of 10,000+" truthfully                                                                                      |
| `aria-label?` and `caption?` both optional | Exactly one of `caption`, `aria-label` or `aria-labelledby`, as a type union                                      | An unlabeled table cannot compile                                                                                                                  |
| (missing)                                  | `noun: {one, other}`                                                                                              | Needed for "3 work items selected" and for SelectionBar. Today SelectionBar adds an "s", which fails for many nouns and languages                   |
| `rowActions` returns `RowAction[]`         | Lede's `RowAction`, plus `disabled` and `disabledReason`                                                         | Actions the viewer may not take stay visible but disabled, with a reason                                                                            |

### Types

```ts
type SortDirection = "ascending" | "descending"; // matches aria-sort
type SortItem = { columnId: string; direction: SortDirection };

/** Everything a saved view stores. Version 2 adds optional keys; none is ever renamed or removed. */
type TableView = {
  sort: SortItem[]; // v1: length 0 or 1
  // v2: filter? (shipped in 0.4.0), columnOrder?, columnVisibility?, columnWidths?, pinning?, density?, grouping?
};
type ViewChange = { type: "sort"; sort: SortItem[] };
// v2 adds: 'filter' | 'columns' | 'resize' | 'pin' | 'group' (callers keep a default branch)

type Selection =
  | { kind: "ids"; ids: ReadonlySet<string> }
  | { kind: "all-matching"; except: ReadonlySet<string> };

// Amended (see Amendment 1): independent parts instead of five kinds. `{}` is settled, current rows.
type TableState = {
  rows?: "current" | "previous" | "none"; // whose rows are on screen; default 'current'
  fetching?: boolean;
  since?: Date; // when the rows on screen were fetched
  failure?: { message?: string; retry: () => void; scope: "load" | "refresh" | "more" };
};

type Column<Row> = {
  id: string; // stable: views key on it
  label: string; // plain text name
  header?: React.ReactNode; // richer header content; defaults to label
  cell?: (row: Row) => React.ReactNode; // defaults to the formatted value
  value?: (row: Row) => string | number | Date | null; // sort, copy, card text
  compare?: (a: Row, b: Row) => number; // client sort override
  sortable?: boolean;
  align?: "start" | "end" | "center"; // 'end' also turns on tabular figures
  width?: { min?: number; preferred?: number; max?: number }; // px; drives <colgroup>
  truncate?: boolean; // one line, full text on hover and focus
  card?: "status" | 1 | 2 | 3; // card layout slot; omit to hide in cards
};

type Paging =
  | { kind: "load-more"; hasMore: boolean; onLoadMore: () => void }
  | { kind: "pages"; page: number; pageCount: number; onPageChange: (page: number) => void };

type Label =
  | { caption: React.ReactNode }
  | { "aria-label": string }
  | { "aria-labelledby": string };

type DataTableProps<Row> = Label & {
  columns: Column<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  rowHeader: string; // the column whose cells are <th scope="row">
  noun: { one: string; other: string };

  view?: TableView; // controlled
  defaultView?: TableView; // uncontrolled
  onViewChange?: (view: TableView, change: ViewChange) => void;
  processing?: "client" | "server"; // default 'client'

  selectionMode?: "none" | "multiple"; // 'single' only if a real case appears
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
  bulkActions?: BulkAction[]; // SelectionBar; amended: onSelect(selection)

  rowHref?: (row: Row) => string; // through LinkProvider
  rowActions?: (row: Row) => RowAction[];
  swipeActions?: boolean; // opt-in touch shortcut; the menu stays

  state?: TableState;
  emptyState?: React.ReactNode;
  total?: number | { atLeast: number };
  paging?: Paging;

  narrow?: "cards" | "scroll"; // below the container breakpoint; default 'scroll'
  narrowBelow?: number; // amended: the breakpoint, px of container width; default 560
  stickyFirstColumn?: boolean;
};
```

### Usage

```tsx
const columns: Column<WorkItem>[] = [
  { id: "id", label: "ID", value: (r) => r.id, sortable: true, width: { min: 88 } },
  {
    id: "title",
    label: "Title",
    value: (r) => r.title,
    sortable: true,
    truncate: true,
    width: { min: 200, preferred: 360 },
  },
  {
    id: "status",
    label: "Status",
    cell: (r) => <StatusChip status={r.status} />,
    value: (r) => r.status,
    card: "status",
  },
  { id: "assignee", label: "Assignee", value: (r) => r.assignee.name, card: 1 },
  { id: "due", label: "Due", value: (r) => r.due, sortable: true, card: 2 },
  {
    id: "amount",
    label: "Amount",
    value: (r) => r.amount,
    cell: (r) => money(r.amount),
    align: "end",
    sortable: true,
    card: 3,
  },
];

<DataTable
  caption="Work items"
  noun={{ one: "work item", other: "work items" }}
  columns={columns}
  rows={page.rows}
  getRowId={(r) => r.id}
  rowHeader="id"
  processing="server"
  view={view}
  onViewChange={(next) => setView(next)} // caller refetches with next.sort
  selectionMode="multiple"
  selection={selection}
  onSelectionChange={setSelection}
  bulkActions={[{ label: "Assign", onSelect: openAssign }]}
  rowHref={(r) => `/items/${r.id}`}
  rowActions={(r) => [{ label: "Archive", tone: "critical", onSelect: () => archive(r) }]}
  state={
    query.isError
      ? { kind: "error", retry: query.refetch }
      : { kind: query.isFetching ? "refreshing" : "ready" }
  }
  total={page.total}
  paging={{ kind: "load-more", hasMore: page.hasMore, onLoadMore: fetchNext }}
  narrow="cards"
/>;
```

### The three layers

- **`Table` parts** (`Table.Root`, `Caption`, `Head`, `Body`, `Row`, `HeaderCell`, `RowHeader`,
  `Cell`, `SortButton`): styled semantic elements with no state. Useful on their own for small
  static tables, and the layer the block and callers both compose.
- **`useDataTable(options)`:** the state. It takes the same options as `DataTable`'s data props and
  returns the visible rows, header and cell props, the selection helpers and the sort handlers. It
  is for screens whose layout the block cannot express. It returns Lede types only.
- **`DataTable`:** parts plus hook plus SelectionBar, EmptyState, skeleton rows and the card
  layout. Most screens use only this.

### Behavior notes

- **Data stays with the caller.**
  - With `processing: 'server'`, the table never reorders or slices rows. It reports `view`
    changes, and the caller fetches.
  - With `'client'`, it sorts `rows` with `value` or `compare`.
  - Paging is always the caller's.
  - Version 2 adds an optional `dataSource` prop, the block loader for virtualized server data,
    beside `rows` rather than instead of it.
- **Row links.** The row header cell holds a real link, which keyboard and screen-reader users use.
  The pattern is the same stretched link ListRow already uses: the link's `::after` covers a
  `position: relative` `<tr>`.
  - WebKit fixed `position: relative` on table rows in 2026, so this now works in every engine.
  - The row's checkbox, cell controls and actions button sit above the overlay (`position:
    relative` with a higher stacking order), so they keep their own clicks.
  - There is no click handler on `<tr>`, as Roselli advises.
  - The known cost: text in the row can't be selected by dragging. Caller-marked cells (for example
    an ID someone copies) can opt out by sitting above the overlay too.
  - Middle-click, the context menu and screen readers' links list all work, because it is a real
    link.

- **Sort.**
  - The header holds a `<button>`, and `aria-sort` sits on the `<th>` of the sorted column only.
    Unsorted columns carry no `aria-sort`, rather than `none`.
  - After a sort, focus stays on the button, and a polite live region says, for example, "Sorted by
    Due, ascending". The region is cleared after about a second, so the same sort twice is announced
    twice.
  - This announcement is needed, not decoration: VoiceOver on macOS and TalkBack don't announce
    `aria-sort` changes.
  - The button's accessible description also carries the direction, which is how React Aria covers
    TalkBack.
- **Selection.**
  - Each checkbox is named "Select {row header text}". Its checked state is the only selection
    signal. `aria-selected` is meaningless on rows of a plain table (MDN) and poorly supported even
    in grids. The selected look comes from a `data-selected` attribute.
  - The header checkbox selects the rows on the page. When every page row is selected and `total`
    is bigger, a button offers "Select all 310 work items".
  - Shift-click selects a range within the loaded rows.
  - SelectionBar announces the count.
- **Truncation.** Cells use one line with an ellipsis. The full text appears in a tooltip on hover
  and on keyboard focus of the cell's control. When a cell has no control, the full text stays
  available to screen readers, because it is clipped visually rather than cut.
- **Widths.**
  - A `<colgroup>` from `width`, with `table-layout: fixed`.
  - React on the client writes styles through the CSSOM, which a strict CSP allows. Server-rendered
    `style=""` attributes are blocked by a strict `style-src-attr`.
  - So when the table is server-rendered under such a policy, widths are applied after hydration,
    and the columns first lay out from their `min` widths through classes (see Risks).
- **Narrow screens.** The choice depends on the table's container width, not the viewport, so a
  table in a narrow pane behaves like one on a phone.
  - **Cards:** a list of ListRow cards (the row header as title, the status chip, then up to three
    `card` fields). They render instead of the table, not beside it hidden. This is the same choice
    Polaris made with its condensed `<ul>`.
    - Restyling one `<table>` into cards with CSS `display` now keeps table semantics in every
      engine, but needs explicit roles and its own screen-reader regression tests.
    - When the layout switches while a row has focus, focus moves to the same row's link in the new
      layout.
  - **Scroll:** the table scrolls sideways with the sticky first column.
- **Density.** Row height and hit targets come from Lede's density (see Open questions: Lede has
  two densities today, and the draft assumes three).
- **Tab order (version 1).** In each row, Tab reaches the checkbox, the row link, any cell
  controls and the actions menu, in that order.
  - At 50 rows a page that is about 200 tab stops, which is why the default page size should stay
    near 50.
  - The version 2 grid model fixes this with one tab stop.

## How version 2 attaches

| Feature                                    | What it adds                                                                                                                                                                                                       | Breaks callers?                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Keyboard grid                              | `interaction?: 'document' \| 'grid'`, default `'document'`. In `'grid'` the table takes `role="grid"`, roving tabindex, arrows, Home/End, Page Up/Down, Ctrl+Home/End and Enter/F2/Escape for cells with controls | No: opt-in prop                                     |
| Column show, hide, reorder, resize, pin    | `view.columnVisibility`, `columnOrder`, `columnWidths`, `pinning`; TanStack features registered inside the hook; a column menu                                                                                     | No: new optional `view` keys and `ViewChange` types |
| Multi-sort, per-column filters, filter bar | `view.sort` longer than one item; `view.filter`; `Column.filter`                                                                                                                                                  | No                                                  |
| Saved views and URLs                       | `TableView` already serializes; add `version` when the first new key lands                                                                                                                                         | No                                                  |
| Virtualized rows                           | `virtualize?: boolean`, or on by default above a row count. TanStack Virtual; `aria-rowcount`/`aria-rowindex`; the focused row kept mounted                                                                        | No                                                  |
| Server blocks                              | `dataSource?: (request) => Promise<{rows, total?, cursor…}>` beside `rows`                                                                                                                                         | No                                                  |
| Inline editing                             | `Column.edit?: {input, validate, save}`; optimistic save, error and undo per cell                                                                                                                                  | No                                                  |
| Grouping, subtotals, totals row            | `view.grouping`; `Column.aggregate`; a `totals` prop                                                                                                                                                               | No                                                  |
| Clipboard                                  | Copy the selected cells as TSV from `value`; paste later                                                                                                                                                           | No                                                  |
| Export hooks                               | `useDataTable` exposes `view` and `selection`; the caller exports on its server                                                                                                                                    | No                                                  |
| Restricted columns                         | Already true: the table renders only the columns it is given. Saved views that name a missing column ignore it silently                                                                                            | No                                                  |

The rule that keeps this true: version 1 never exposes TanStack types, never takes positional
arguments and gives every union a "default" path that callers already handle.

## Accessibility and target test plan

**What the evidence says**

- **A real table, not a grid, for version 1.** Use a table when the content is mostly for reading,
  even with links and buttons in it. Table semantics have robust support; grids carry a steeper
  learning curve and more quirks (Higley). Taking the grid role obliges you to build the whole grid
  keyboard model (Matt King, W3C list). Don't turn a table into a grid just to make rows clickable
  (Roselli, updated Oct 2026).
- **Sort announcements** (Roselli's tests, re-confirmed Oct 2026):
  - announced: NVDA with Firefox, JAWS with Chrome, Narrator with Edge, VoiceOver on iPadOS;
  - not announced: VoiceOver on macOS with Safari, TalkBack with Chrome or Firefox.

  Hence the live region.

- **Selection:**
  - `aria-selected` on a table row is not relevant (MDN), and support is partial even in grids
    (a11ysupport.io, 23 of 54).
  - A labeled checkbox's checked state is what every screen reader reports.
  - JAWS with Chrome has read labeled row-header cells as blank (JAWS issue 783), so test it.
- **Virtualized rows (version 2):**
  - `aria-rowcount` support is partial: 8 of 22 on a11ysupport.io.
  - NVDA with Firefox reported only the rendered rows; VoiceOver on iOS is untested.
  - So version 2 keeps paging available even when virtualized, because paging may serve
    screen-reader users better than endless scroll.
- **Gestures:**
  - Swipe is a path gesture, so SC 2.5.1 requires a single-pointer alternative; the visible actions
    button is that alternative.
  - SC 2.5.8 (AA) asks for 24 px targets or equivalent spacing, with no exception for tables. SC
    2.5.5 (AAA) asks for 44 px.
  - Research on gloved use cites about 20 mm, far above 44 CSS px (about 7–9 mm). The field density
    narrows the gap but does not close it, so field screens should also show fewer controls per row.

**Automated tests (every pull request, in each of the four themes and each density)**

1. Axe on these fixtures, under Playwright: empty, loading, error, stale, 1 row, 50 rows, 500 rows,
   with and without selection and in table and card layouts.
2. **Structure:**
   - exactly one `<th scope="row">` per row, and a `<th scope="col">` per column;
   - a caption or label;
   - `aria-sort` on at most one header;
   - no `role="grid"` in version 1;
   - no interactive element nested inside another.
3. **Keyboard (version 1):**
   - Tab order runs header buttons, then per row the checkbox, link, controls and actions;
   - Enter or Space on a header sorts and keeps focus;
   - Escape closes the actions menu and returns focus to its button.
4. **Announcements:**
   - the live region text after a sort and after a selection change;
   - cleared after about a second.
5. **Targets:**
   - every interactive element's box is measured at least 24 px in compact, 44 in regular and 48 in
     field, or has spacing that meets SC 2.5.8;
   - run at 320 px wide and at 400% zoom (reflow, SC 1.4.10).
6. **Contrast:** status chips, selected rows, focus rings and hover against selected, at 4.5:1 for
   text and 3:1 for marks, with text at 7:1 in the high-contrast themes. This includes forced-colors mode.
7. **Performance:**
   - mount and sort at 500 rows under 4× CPU throttle;
   - recorded, with a budget that fails the build on a 20% regression.

**Manual passes (before each release that changes the table)**

| Screen reader                          | Browser            | Checks                                                                                                                             |
| -------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver, macOS                       | Safari             | Table navigation (Ctrl+Option+arrows), column headers read with cells, sort announced through the live region, selection, row link |
| VoiceOver, iOS and iPadOS              | Safari             | Swipe order, rotor table navigation, cards layout, actions button, 44/48 px targets with a finger                                  |
| TalkBack, Android                      | Chrome             | Same as iOS. Sort direction comes from the live region and the description, since `aria-sort` is not read                          |
| NVDA                                   | Firefox and Chrome | Browse-mode table commands (Ctrl+Alt+arrows), header association, checkbox names                                                   |
| JAWS                                   | Chrome             | Row-header cells not read as blank, no double sort announcement                                                                    |
| Keyboard only, plus 200% and 400% zoom | Any                | Visible focus everywhere, sticky header and column not hiding the focused cell (SC 2.4.11)                                         |

Record each pass in the evidence for that release, with the versions used.

## Phones: how other systems do it

| System                     | Narrow screens                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shopify Polaris IndexTable | A `condensed` prop swaps the `<table>` for a `<ul>`, a second DOM, and drops bulk actions; recommended below 490 px. Polaris React is now unmaintained in favor of web components |
| MUI X                      | `listView`: one column whose cell you render, switched with a media query. Pro only, and no editing in it                                                                          |
| Ant Design                 | Columns hidden by breakpoint (`responsive`), fixed start and end columns, sideways scroll; no cards                                                                                |
| Fluent 2                   | Two components: `Table` (a native `<table>`) and `DataGrid` (always `role="grid"`)                                                                                                 |
| Carbon                     | Keeps the table; overflow menus are always visible on touch                                                                                                                        |
| Primer                     | Density options and row actions in the last column (at most one shown, the rest in a menu); no narrow-screen guidance found                                                        |
| Spectrum 2                 | Text wraps or truncates; no mobile guidance found                                                                                                                                  |
| GOV.UK                     | Show less data, split tables, smaller text until tablet; no sortable variant                                                                                                       |
| Salesforce Lightning       | Its data table is not supported on mobile                                                                                                                                          |

**The pattern:**

- Enterprise systems mostly keep the table, scroll it sideways with a sticky first column and hide
  low-priority columns.
- Cards arrive as a separate mode or component, never as a CSS-only trick.

The proposal follows that. `narrow: 'scroll'` keeps the table in a labeled, focusable scroll
region with the sticky first column, and the sticky cell has an explicit background so content
doesn't show through. `narrow: 'cards'` renders ListRow cards from the `card` slots.

Both are chosen by container width. Selection in cards is a checkbox in the card's leading slot,
and bulk actions stay in SelectionBar.

## Risks

| Risk                                                                                   | Likelihood              | What we do                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Table ships v10 with breaking changes                                         | Medium (v8 to v9 broke) | Callers see only Lede types; a major is absorbed inside `useDataTable`. Pin exact versions                                                                                                                                                                                                                                                                                                     |
| React Aria's `Table` tempts us later for its keyboard model, then disappoints on speed | Medium                  | We measured about 10× the cost at 500 rows and a tab crash at 10,000. Take its patterns (announcements, the TalkBack description, `'all'` selection) and keep its component out                                                                                                                                                                                                                 |
| License traps if we reach for a grid later                                             | Medium                  | Paid features: AG Grid's server-side row model, grouping, clipboard and Excel (Enterprise). MUI X's pinning, reordering, multi-sort, lazy loading (Pro), and grouping, aggregation, cell selection and paste (Premium); its free grid caps pages at 100 rows. Any of these is a purchase decision, recorded before use                                                                          |
| Abandoned packages                                                                     | Known                   | Avoid as foundations: react-table v7 (no React 19), Material React Table (no release in 19 months), Mantine React Table (targets an old Mantine), Glide Data Grid (last stable Feb 2024, React 18 peers)                                                                                                                                                                                        |
| React 19 compatibility                                                                 | Low                     | TanStack Table v9 and Virtual, Base UI 1.9 and React Aria 1.22 all declare React 19                                                                                                                                                                                                                                                                                                             |
| CSP                                                                                    | Low in version 1        | Version 1 is class-only, apart from column widths set through the CSSOM on the client. Server-rendered `style=""` needs `style-src-attr`, so widths wait for hydration under a strict policy. Version 2's virtualiser positions rows with styles, which is fine on the client but needs care if rows are server-rendered. AG Grid needs a `styleNonce`, and MUI and Emotion a per-request nonce |
| Stretched row links block text selection                                               | Certain, accepted       | Cells that people copy from (IDs) can sit above the overlay. The same trade-off as ListRow                                                                                                                                                                                                                                                                                                      |
| Card and table layouts drift apart                                                     | Medium                  | Both come from one column definition, and one test suite runs on both layouts                                                                                                                                                                                                                                                                                                                   |
| 500-row pages feel slow on low-end tablets                                             | Medium                  | Mount and sort cost about 300 ms at 2× throttle. Default to 50 rows a page, keep 500 as the ceiling and virtualize in version 2                                                                                                                                                                                                                                                                |
| Brief vs current Lede densities                                                       | Certain                 | Lede has two densities; open question 1                                                                                                                                                                                                                                                                                                                                                        |

## Open questions

1. **Densities: settled.** Lede will expand its densities (owner, Oct 31). The table reads row
   height and hit size from the density tokens, so it needs no prop of its own.
2. **Single selection.** Is there a real case for single-row selection, or is the row link enough?
   The proposal leaves `'single'` out until one appears.
3. **"Select all N": settled.** Counts are exact (owner, Oct 31). While a server's exact count is
   still arriving, `total` is `{atLeast}` and the offer reads "Select all matching". It shows the
   number once it is known.
4. **SelectionBar's noun.** Should SelectionBar take `{one, other}` (or a formatter) in the same
   change, so the table and the bar agree?
5. **Stale data.** In the "stale" state, should actions that need the server be disabled, or left
   to the caller?
6. **Names shared with React Aria.** Should the API borrow React Aria's names (`sortDescriptor`,
   `selectedKeys` with `'all'`, `onRowAction`) so that its `Table` could be swapped in later? The
   proposal keeps its own `view` and `Selection`. They are built for saved views, and the
   measurement makes a later swap unlikely. It does adopt React Aria's styling attributes
   (`data-selected`, `data-sort-direction`), so styles would carry over.
7. **Cards vs scroll defaults.** Should `narrow` default to `'cards'` (the field case) or
   `'scroll'` (the office case)?

## Sources

Libraries:

- [TanStack Table v9 announcement](https://tanstack.com/blog/announcing-tanstack-table-v9)
- [TanStack Table and React Compiler](https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler)
- [TanStack Virtual benchmarks](https://github.com/TanStack/virtual/tree/main/benchmarks)
- [shadcn data table](https://ui.shadcn.com/docs/components/data-table)
- [React Aria Table](https://react-aria.adobe.com/Table)
- [React Aria Virtualizer](https://react-aria.adobe.com/Virtualizer)
- [React Aria `useTable` source (grid role, sort announcement)](https://unpkg.com/react-aria@3.53.1/dist/private/table/useTable.mjs)
- [React Aria column header source (TalkBack `aria-sort`)](https://unpkg.com/react-aria@3.53.1/dist/private/table/useTableColumnHeader.mjs)
- [React Aria selection announcement source](https://unpkg.com/react-aria@3.53.1/dist/private/grid/useGridSelectionAnnouncement.mjs)
- [Base UI CSP provider](https://base-ui.com/react/utils/csp-provider)
- [AG Grid community vs enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/)
- [AG Grid accessibility](https://www.ag-grid.com/react-data-grid/accessibility/)
- [AG Grid security and CSP](https://www.ag-grid.com/react-data-grid/security/)
- [MUI X server-side data](https://mui.com/x/react-data-grid/server-side-data/)
- [MUI X list view](https://mui.com/x/react-data-grid/list-view/)
- [MUI CSP guide](https://mui.com/guides/content-security-policy)
- [MUI X Pro features (package contents)](https://unpkg.com/@mui/x-data-grid-pro@9.17.0/hooks/features/)
- [MUI X Premium features (package contents)](https://unpkg.com/@mui/x-data-grid-premium@9.17.0/hooks/features/)
- [Glide Data Grid](https://github.com/glideapps/glide-data-grid)
- [Material React Table](https://github.com/KevinVandy/material-react-table)

Accessibility:

- [APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Sarah Higley, Grids part 1](https://sarahmhigley.com/writing/grids-part1/)
- [Adrian Roselli, Don't turn a table into an ARIA grid for a clickable row](https://adrianroselli.com/2023/11/dont-turn-a-table-into-an-aria-grid-just-for-a-clickable-row.html)
- [Adrian Roselli, Sortable table columns](https://adrianroselli.com/2021/04/sortable-table-columns.html)
- [Adrian Roselli, Tables, CSS display and ARIA](https://adrianroselli.com/2018/02/tables-css-display-properties-and-aria.html)
- [Adrian Roselli, Block links](https://adrianroselli.com/2020/02/block-links-cards-clickable-regions-etc.html)
- [Heydon Pickering, Cards](https://inclusive-components.design/cards/)
- [Matt King on the grid role](https://lists.w3.org/Archives/Public/w3c-wai-ig/2020AprJun/0162.html)
- [MDN row role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/row_role)
- [a11ysupport aria-selected](https://a11ysupport.io/tech/aria/aria-selected_attribute)
- [a11ysupport aria-rowcount](https://a11ysupport.io/tests/tech__aria__aria-rowcount)
- [MOJ sortable table](https://design-patterns.service.justice.gov.uk/components/sortable-table/)
- [WCAG 2.5.8 target size (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.5.5 target size (enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- [WCAG 2.5.1 pointer gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)
- [Touch target research summary](https://www.w3.org/WAI/GL/mobile-a11y-tf/wiki/Summary_of_Research_on_Touch/Pointer_Target_Size)
- [MDN style-src (CSSOM writes are allowed)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src)
- [web.dev INP](https://web.dev/articles/inp)

Design systems:

- [Polaris IndexTable (condensed)](https://unpkg.com/@shopify/polaris@9.14.0/src/components/IndexTable/README.md)
- [Ant Design table](https://ant.design/components/table)
- [Fluent DataGrid source](https://unpkg.com/@fluentui/react-table@9.19.23/lib/components/DataGrid/useDataGrid.js)
- [Carbon data table usage](https://carbondesignsystem.com/components/data-table/usage/)
- [Primer DataTable](https://primer.style/product/components/data-table/)
- [Spectrum 2 TableView](https://react-spectrum.adobe.com/beta/s2/TableView.html)
- [GOV.UK table](https://design-system.service.gov.uk/components/table/)
- [Salesforce mobile support](https://developer.salesforce.com/docs/platform/mobile-offline/guide/considerations-base-components-support.html)
