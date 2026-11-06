import { test, expect } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defineColumns, isSelected, removeFromSelection, useDataTable, type SelectionModel, type Selection, type Total } from '../registry/lede/blocks/use-data-table';

test.skip(({ isMobile }) => isMobile, 'Pure logic: one project is enough.');

const ids = (...a: string[]): Selection => ({ kind: 'ids', ids: new Set(a) });
const all = (...except: string[]): Selection => ({ kind: 'all-matching', except: new Set(except) });

type Row = { id: string };
const rows: Row[] = [{ id: 'r0' }, { id: 'r1' }];
const columns = defineColumns<Row>([{ id: 'id', label: 'ID', value: (r) => r.id }]);

/** The selection model `useDataTable` gives for this selection. */
function selectionModel(selection: Selection, total?: Total, onSelectionChange?: (next: Selection) => void) {
  let model: SelectionModel | undefined;
  const Probe = () => {
    model = useDataTable({
      columns, rows, getRowId: (r) => r.id, rowHeader: 'id', noun: { one: 'row', other: 'rows' },
      selectionMode: 'multiple', selection, total, onSelectionChange,
    }).selection;
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return model!;
}
const count = (selection: Selection, total?: Total) => selectionModel(selection, total).count;
/** What a controlled table reports after `act`. */
function after(selection: Selection, act: (model: SelectionModel) => void) {
  let next: Selection | undefined;
  act(selectionModel(selection, undefined, (s) => { next = s; }));
  return next;
}

test('ticking and unticking: ids add and remove; all-matching keeps the exceptions', () => {
  expect(after(ids(), (m) => m.togglePage())).toEqual(ids('r0', 'r1'));
  expect(after(ids('a', 'b'), (m) => m.toggle('a', false))).toEqual(ids('b'));
  expect(after(all(), (m) => m.toggle('a', false))).toEqual(all('a'));
  expect(after(all('a'), (m) => m.toggle('a', true))).toEqual(all());
  expect(isSelected(all('a'), 'a')).toBe(false);
  expect(isSelected(all('a'), 'b')).toBe(true);
});

test('counts: all-matching counts against the total, a lower bound stays a lower bound', () => {
  expect(count(ids('a', 'b'), 310)).toBe(2);
  expect(count(all('a'), 310)).toBe(309);
  expect(count(all('a'), { atLeast: 100 })).toEqual({ atLeast: 99 });
  expect(count(all('a'))).toBe(1); // no total: the rows shown, less the exception
});

test('a deleted row leaves an explicit selection, and the count drops by one', () => {
  const before = ids('a', 'b', 'c');
  const next = removeFromSelection(before, ['b']);
  expect(next).toEqual(ids('a', 'c'));
  expect(count(next, 309)).toBe(2);
  expect(removeFromSelection(before, ['z'])).toBe(before); // nothing to remove: the same object
});

test('a deleted row leaves an all-matching selection without becoming an exception', () => {
  // The review's case: select all 310, archive one. The server's total becomes 309, and all 309 are still selected.
  const before = all();
  const next = removeFromSelection(before, ['b']);
  expect(next).toBe(before);
  expect(count(next, 309)).toBe(309);
  // An unticked row that is then deleted stops being an exception: the new total no longer counts it either.
  const unticked = all('b', 'c');
  const gone = removeFromSelection(unticked, ['b']);
  expect(gone).toEqual(all('c'));
  expect(count(gone, 309)).toBe(308);
});
