// A page's numeric total below the rows the store holds through that page. Rows the server sent prove more than a
// number beside them, so such a total is a lower bound of those rows: the rest of the list stays reachable, the count
// never reads lower than the rows shown, and a page that has rows is never thrown back for being "past the end".
import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import { ServerRowsStore, type ServerRowsConfig, type ServerRowsRequest } from '../registry/lede/blocks/server-rows-store';

test.skip(({ isMobile }) => isMobile, 'Pure logic: one project is enough.');

type Row = { id: number };
const rows = (from: number, n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: from + i }));
type P = { req: ServerRowsRequest; resolve: (v: unknown) => void; done?: boolean };
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(extra: Partial<ServerRowsConfig<Row>> = {}) {
  const reqs: P[] = [];
  const fetchRows = ((req: ServerRowsRequest) => new Promise((resolve, reject) => {
    const p: P = { req, resolve: (v) => { p.done = true; resolve(v); } };
    reqs.push(p);
    req.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })) as never;
  const store = new ServerRowsStore<Row>({ view: { sort: [] }, pageSize: 2, fetchRows, ...extra });
  store.start();
  const open = () => reqs.filter((r) => !r.done && !r.req.signal.aborted);
  return {
    store, reqs, open, snap: () => store.getSnapshot(),
    async answer(value: unknown) {
      const o = open();
      assert.equal(o.length, 1, `${o.length} open requests`);
      o[0].resolve(value);
      await flush(); await flush();
    },
  };
}

const lowerBound = (t: unknown) => (typeof t === 'number' ? t : (t as { atLeast: number } | undefined)?.atLeast);

test('load-more: a full page with total 0 keeps the rest of the list reachable', async () => {
  const t = setup({ mode: 'load-more' });
  await t.answer({ rows: rows(0, 2), total: 0 });
  const s = t.snap();
  assert.equal(s.rows.length, 2);
  assert.deepEqual(s.paging, { kind: 'load-more', hasMore: true });
  assert.ok((lowerBound(s.total) ?? 0) >= 2, `total ${JSON.stringify(s.total)} is below the 2 rows shown`);
  t.store.loadMore();
  await flush();
  assert.equal(t.open().length, 1, 'Load more asks for the next page');
  assert.equal(t.open()[0].req.offset, 2);
  t.store.stop();
});

test('load-more: a short page with total 0 ends the list at its rows, not at 0', async () => {
  const t = setup({ mode: 'load-more' });
  await t.answer({ rows: rows(0, 1), total: 0 });
  const s = t.snap();
  assert.equal(s.total, 1);
  assert.deepEqual(s.paging, { kind: 'load-more', hasMore: false });
  t.store.stop();
});

test('pages: a full first page with total 0 keeps Next', async () => {
  const t = setup({ mode: 'pages' });
  await t.answer({ rows: rows(0, 2), total: 0 });
  const s = t.snap();
  assert.equal(s.rows.length, 2);
  assert.ok(s.paging.kind === 'pages' && s.paging.pageCount >= 2, `paging ${JSON.stringify(s.paging)}`);
  assert.ok((lowerBound(s.total) ?? 0) >= 2, `total ${JSON.stringify(s.total)} is below the 2 rows shown`);
  t.store.stop();
});

test('pages: page 2 with rows that says total 2 stays on page 2', async () => {
  const t = setup({ mode: 'pages' });
  await t.answer({ rows: rows(0, 2), total: 9 });
  t.store.setPage(1);
  await flush();
  await t.answer({ rows: rows(2, 2), total: 2 });
  const s = t.snap();
  assert.deepEqual(s.rows.map((r) => r.id), [2, 3]);
  assert.ok(s.paging.kind === 'pages' && s.paging.page === 1, `paging ${JSON.stringify(s.paging)}`);
  assert.ok((lowerBound(s.total) ?? 0) >= 4, `total ${JSON.stringify(s.total)} is below the 4 rows through page 2`);
  t.store.stop();
});

test('a total at or above the rows held is still exact', async () => {
  const t = setup({ mode: 'pages' });
  await t.answer({ rows: rows(0, 2), total: 2 });
  assert.equal(t.snap().total, 2);
  assert.deepEqual(t.snap().paging, { kind: 'pages', page: 0, pageCount: 1 });
  t.store.stop();
});

// From a review: an empty page has no rows of its own to win with, so the 0 beside it still set the count:
// past a list whose length is a multiple of the page size ("4 of 0"), and on a deep link past the end.
const ids = (s: { rows: readonly Row[] }) => s.rows.map((r) => r.id);

/** Answers each request from a list of `length` rows, with `total` on every page, until none is open. */
async function serve(t: ReturnType<typeof setup>, length: number, total: unknown) {
  for (let i = 0; i < 40 && t.open().length; i++) {
    const { offset, limit } = t.open()[0].req;
    await t.answer({ rows: rows(offset, Math.max(0, Math.min(limit, length - offset))), total });
  }
  assert.equal(t.open().length, 0, 'requests still open');
}

/** How far the count ever read below the rows shown, from now on: 0 if it never did. */
function shortfall(t: ReturnType<typeof setup>) {
  let most = 0;
  t.store.subscribe(() => { const s = t.snap(); if (s.total != null) most = Math.max(most, s.rows.length - lowerBound(s.total)!); });
  return () => most;
}

test('load-more: the empty page past a full last page with total 0 ends the list at its rows, not at 0', async () => {
  const t = setup({ mode: 'load-more' });
  await t.answer({ rows: rows(0, 2), total: 0 });
  t.store.loadMore();
  await t.answer({ rows: rows(2, 2), total: 0 });
  t.store.loadMore();
  assert.equal(t.open()[0].req.offset, 4);
  await t.answer({ rows: [], total: 0 });
  const s = t.snap();
  assert.deepEqual(ids(s), [0, 1, 2, 3]);
  assert.equal(s.total, 4);
  assert.deepEqual(s.paging, { kind: 'load-more', hasMore: false });
  t.store.stop();
});

// Pages are asked for by offset, so a cursor beside the empty page changes nothing.
for (const [first, cursor] of [[0, undefined], [9, undefined], [0, null]] as const) {
  const named = `first total ${first}${cursor === null ? ', with cursors' : ''}`;
  test(`pages: Next to an empty page after a full one (${named}) goes back with the count at the rows held`, async () => {
    const t = setup({ mode: 'pages' });
    await t.answer({ rows: rows(0, 2), total: first, nextCursor: cursor === null ? 'c1' : undefined });
    const below = shortfall(t);
    t.store.setPage(1);
    await t.answer({ rows: [], total: 0, nextCursor: cursor });
    const s = t.snap();
    assert.equal(t.open().length, 0);
    assert.deepEqual(ids(s), [0, 1]);
    assert.equal(s.total, 2);
    assert.deepEqual(s.paging, { kind: 'pages', page: 0, pageCount: 1 });
    assert.equal(below(), 0, 'the count read below the rows shown');
    t.store.stop();
  });
}

// The walk back can find the empty page past the end before the full page before it, or after: either way they meet.
for (const length of [2, 4, 5, 6]) {
  test(`pages: a deep link past a list of ${length} rows with total 0 finds the end and counts the rows`, async () => {
    const t = setup({ mode: 'pages' });
    await t.answer({ rows: rows(0, 2), total: 0 });
    const below = shortfall(t);
    t.store.setPage(50);
    await serve(t, length, 0);
    const s = t.snap();
    const last = Math.ceil(length / 2) - 1;
    assert.deepEqual(ids(s), rows(last * 2, length - last * 2).map((r) => r.id));
    assert.equal(s.total, length);
    assert.deepEqual(s.paging, { kind: 'pages', page: last, pageCount: last + 1 });
    assert.ok(t.reqs.length <= 9, `${t.reqs.length} row requests: the end is found by halving`);
    assert.equal(below(), 0, 'the count read below the rows shown');
    t.store.stop();
  });
}

// A deep link leaves the pages array sparse and as long as the page asked for, so anything that walks it by index
// rather than by key costs seconds: finding the end, and a reload after it.
test('pages: a deep link a hundred million pages past the end finds it in a few requests and little time', async () => {
  const t = setup({ mode: 'pages' });
  await t.answer({ rows: rows(0, 2) });
  const cpu = process.cpuUsage();
  t.store.setPage(100_000_000);
  await serve(t, 5, undefined);
  const walked = t.reqs.length;
  t.store.reload();
  await serve(t, 5, undefined);
  const { user, system } = process.cpuUsage(cpu);
  const ms = (user + system) / 1000;
  assert.deepEqual(t.snap().paging, { kind: 'pages', page: 2, pageCount: 3 });
  assert.equal(t.snap().total, 5);
  assert.ok(walked <= 32, `${walked} row requests: the end is found by halving`);
  assert.ok(ms < 1000, `${Math.round(ms)} ms of CPU time`);
  t.store.stop();
});

test('pages: an empty page from before a reload doesn\'t end the list when the full page before it comes back', async () => {
  const t = setup({ mode: 'pages' });
  await t.answer({ rows: rows(0, 2), total: 0 });
  t.store.setPage(1);
  await t.answer({ rows: [], total: 0 });
  assert.equal(t.snap().total, 2);
  t.store.reload();
  await t.answer({ rows: rows(0, 2), total: 0 });
  assert.deepEqual(t.snap().paging, { kind: 'pages', page: 0, pageCount: 2 }, 'rows added since may be on page 1');
  t.store.setPage(1);
  await t.answer({ rows: rows(2, 2), total: 0 });
  assert.deepEqual(ids(t.snap()), [2, 3]);
  t.store.stop();
});

// After a bulk delete, pages held from before prove nothing once they're fetched again (a reload) or older than
// staleAfter, whatever total they came with, so the table goes to the last page in one step instead of walking back
// through them.
const BEFORE_AND_AFTER = [['a true total', 1000, 3], ['a lower bound, then a true total', { atLeast: 1000 }, 3], ['total 0', 0, 0]] as const;
for (const [named, before, after] of BEFORE_AND_AFTER) {
  for (const how of ['a reload', 'the pages held aging'] as const) {
    test(`pages: after a bulk delete, with ${named}, ${how} goes to the last page in one step`, async () => {
      let clock = 0;
      const t = setup({ mode: 'pages', pageSize: 50, now: () => clock });
      for (let p = 0; p < 20; p++) {
        if (p > 0) t.store.setPage(p);
        await serve(t, 1000, before);
      }
      assert.equal((t.snap().paging as { page: number }).page, 19);
      const shown = new Set<number>();
      t.store.subscribe(() => { const s = t.snap(); if (s.state.rows === 'current' && s.rows.length && s.rows[0].id >= 3) shown.add(s.rows[0].id); });
      const asked = t.reqs.length;
      if (how === 'a reload') t.store.reload();
      else { clock = 40_000; t.store.setPage(18); }
      await serve(t, 3, after);
      const s = t.snap();
      assert.deepEqual(ids(s), [0, 1, 2]);
      assert.equal(s.total, 3);
      assert.deepEqual(s.paging, { kind: 'pages', page: 0, pageCount: 1 });
      assert.equal(t.reqs.length - asked, 2, 'the page asked for, then the last page');
      // The page asked for shows from the cache while it's fetched again; no page of deleted rows behind it comes on screen.
      assert.deepEqual([...shown], [how === 'a reload' ? 950 : 900], 'pages of deleted rows came on screen');
      t.store.stop();
    });
  }
}

// Pages still fresh aren't left out by age, but once an empty page finds the count too high, the count is checked
// again, and pages fetched before that no longer count: the next empty page's true total stands.
test('pages: with fresh pages held, a true total on empty pages after a bulk delete lands on the count', async () => {
  let clock = 0;
  const t = setup({ mode: 'pages', pageSize: 50, now: () => clock });
  for (let p = 0; p <= 10; p++) {
    if (p > 0) t.store.setPage(p);
    await serve(t, 1000, 1000);
  }
  clock = 5_000;
  t.store.setPage(15);
  await serve(t, 3, 3);
  assert.equal(t.snap().total, 3);
  assert.equal((t.snap().paging as { page: number }).page, 0);
  t.store.stop();
});

// A server that sends a true count: an empty page past the end clamps to the last page by it, in one step. (With an
// exact count already known, a deep link clamps before the page is asked for, so none of these knows one yet.)
for (const [held, first] of [['nothing held', undefined], ['a lower bound held', { atLeast: 2 }], ['no total held', null]] as const) {
  test(`pages: a deep link to an empty page with a true total of 3 goes to the last page in one step, ${held}`, async () => {
    const t = setup({ mode: 'pages' });
    if (first !== undefined) await t.answer({ rows: rows(0, 2), total: first });
    t.store.setPage(50);
    assert.equal(t.open()[0].req.offset, 100);
    await t.answer({ rows: [], total: 3 });
    assert.equal(t.open().length, 1);
    assert.equal(t.open()[0].req.offset, 2, 'the next request is the last page');
    await t.answer({ rows: rows(2, 1), total: 3 });
    const s = t.snap();
    assert.deepEqual(ids(s), [2]);
    assert.equal(s.total, 3);
    assert.deepEqual(s.paging, { kind: 'pages', page: 1, pageCount: 2 });
    t.store.stop();
  });
}
