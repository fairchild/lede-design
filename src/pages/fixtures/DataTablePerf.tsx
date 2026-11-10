import * as React from 'react';
import { DataTable } from '@lede/blocks/data-table';
import type { TableView } from '@lede/blocks/use-data-table';
import { allWorkItems, applyView, type WorkItem } from '@/data/work-items';
import { workColumns } from '@/work-columns';

/**
 * Performance budget fixture (not linked from the navigation). The same 500 rows render as a plain React <table>
 * (the floor: the same cells, a checkbox, a link and a button per row, nothing else) or as DataTable. The test
 * compares the two in the same browser, so the budget is a ratio and holds on any machine.
 */
const ROWS: readonly WorkItem[] = allWorkItems
  .concat(allWorkItems.map((w) => ({ ...w, id: `WI-${Number(w.id.slice(3)) + 1000}` })))
  .slice(0, 500);
const noun = { one: 'work item', other: 'work items' };
const TITLE_SORT: TableView = { sort: [{ columnId: 'title', direction: 'ascending' }] };
const NO_SORT: TableView = { sort: [] };
const href = (r: WorkItem) => `/app/work/${r.id}`;
const actions = () => [{ label: 'Archive' }];

/** The floor: Lede's table markup and CSS written by hand, with plain React state and no Lede components. */
function PlainTable({ view }: { view: TableView }) {
  const rows = React.useMemo(() => applyView(ROWS, view), [view]);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const check = (label: string, checked: boolean, onChange?: (on: boolean) => void) => (
    <span className="ld-checkbox">
      <input type="checkbox" className="ld-checkbox-input" aria-label={label} checked={checked} onChange={(e) => onChange?.(e.currentTarget.checked)} />
      <span className="ld-checkbox-box" aria-hidden="true" />
    </span>
  );
  return (
    <div className="ld-table-scroll">
      <table className="ld-table" aria-label="Plain table">
        <colgroup>
          <col style={{ width: 'var(--ld-table-control-w)' }} />
          {workColumns.map((c) => <col key={c.id} />)}
          <col style={{ width: 'var(--ld-table-control-w)' }} />
        </colgroup>
        <thead className="ld-table-head">
          <tr className="ld-table-row">
            <th scope="col" className="ld-table-th ld-table-check">{check('Select all', false)}</th>
            {workColumns.map((c) => (
              <th key={c.id} scope="col" className={`ld-table-th${c.align === 'end' ? ' ld-table-end' : ''}`}>
                <button type="button" className="ld-table-sort"><span className="ld-table-sort-label">{c.label}</span></button>
              </th>
            ))}
            <th scope="col" className="ld-table-th ld-table-actions"><span className="ld-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="ld-table-body">
          {rows.map((r) => (
            <tr key={r.id} className="ld-table-row" data-row-id={r.id} data-selected={selected.has(r.id) || undefined}>
              <td className="ld-table-td ld-table-check">
                {check(`Select ${r.id}`, selected.has(r.id), (on) =>
                  setSelected((s) => { const n = new Set(s); if (on) n.add(r.id); else n.delete(r.id); return n; }))}
              </td>
              {workColumns.map((c) =>
                c.id === 'id' ? (
                  <th key={c.id} scope="row" className="ld-table-rowheader"><a className="ld-table-link" href={href(r)}>{r.id}</a></th>
                ) : (
                  <td key={c.id} className={`ld-table-td${c.align === 'end' ? ' ld-table-end' : ''}`}>
                    {c.truncate ? <span className="ld-table-trunc">{c.cell ? c.cell(r) : String(c.value?.(r) ?? '')}</span> : c.cell ? c.cell(r) : String(c.value?.(r) ?? '')}
                  </td>
                ),
              )}
              <td className="ld-table-td ld-table-actions">
                <button type="button" className="ld-table-more" aria-label={`More actions for ${r.id}`}>•••</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DataTablePerf() {
  const [impl, setImpl] = React.useState<'none' | 'plain' | 'lede'>('none');
  const [view, setView] = React.useState<TableView>(NO_SORT);
  return (
    <div className="ld-flow">
      <h1 className="text-title-1">DataTable performance fixture</h1>
      <div className="ld-dt-pager">
        <button type="button" onClick={() => { setView(NO_SORT); setImpl('plain'); }}>Plain table</button>
        <button type="button" onClick={() => { setView(NO_SORT); setImpl('lede'); }}>DataTable</button>
        <button type="button" onClick={() => setView((v) => (v === TITLE_SORT ? NO_SORT : TITLE_SORT))}>Sort by title</button>
        <button type="button" onClick={() => setImpl('none')}>Clear</button>
      </div>
      {impl === 'plain' ? <PlainTable view={view} /> : null}
      {impl === 'lede' ? (
        <DataTable
          aria-label="DataTable"
          noun={noun}
          columns={workColumns}
          rows={ROWS}
          getRowId={getId}
          rowHeader="id"
          view={view}
          onViewChange={setView}
          selectionMode="multiple"
          rowHref={href}
          rowActions={actions}
        />
      ) : null}
    </div>
  );
}
const getId = (r: WorkItem) => r.id;
