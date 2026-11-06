import * as React from 'react';
import type { Paging, TableState, Total } from './use-data-table';
import { ServerRowsStore, type ServerRowsConfig } from '@fairchild/table-core';

export type { ServerRowsRequest, ServerRowsResponse, ServerCountRequest } from '@fairchild/table-core';
export { pageKey } from '@fairchild/table-core';

export type UseServerRowsOptions<Row> = Omit<ServerRowsConfig<Row>, 'now'>;

/** Spread into DataTable with `processing="server"`: `rows`, `state`, `total` and `paging`. */
export interface ServerRows<Row> {
  rows: readonly Row[];
  state: TableState;
  total?: Total;
  paging: Paging;
  /** Drop every cached page and fetch what is on screen again, such as after a change on the server. */
  reload: () => void;
}

/**
 * The server-side row model: pages fetched on demand and cached per view and page size. Duplicate requests are
 * merged, requests that go out of date are aborted, load-more pages chain their cursors and `{ atLeast }` totals are
 * followed by an exact count, asked for again when the rows are refetched or the count ages. While a new view loads,
 * the previous rows stay on screen (`rows: 'previous'`), so the layout doesn't jump. The work is done by
 * `ServerRowsStore` from `@fairchild/table-core`, which has no React; this hook connects it.
 */
export function useServerRows<Row>(options: UseServerRowsOptions<Row>): ServerRows<Row> {
  const [store] = React.useState(() => new ServerRowsStore<Row>(options));
  // Options reach the store after render, as an effect: the fetchers may change on every render, and a new view or
  // page size moves to its own cache entry. Layout effect, so the first paint after a sort already says "Updating…".
  React.useLayoutEffect(() => { store.update(options); });
  React.useEffect(() => { store.start(); return store.stop; }, [store]);
  const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const p = snap.paging;
  const paging = React.useMemo<Paging>(
    () => p.kind === 'pages'
      ? { kind: 'pages', page: p.page, pageCount: p.pageCount, onPageChange: store.setPage }
      : { kind: 'load-more', hasMore: p.hasMore, onLoadMore: store.loadMore },
    [store, p],
  );
  return { rows: snap.rows, state: snap.state, total: snap.total, paging, reload: store.reload };
}
