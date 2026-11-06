import * as React from 'react';
import type { TableLabel } from '../table';
import { Checkbox } from '../checkbox';
import { ListRow, type RowAction } from '../list';
import type { Noun } from './selection-bar';
import type { Column, DataTableModel } from './use-data-table';
import { SKELETON_ROWS, cellContent } from './data-table-row';

interface CardsProps<Row> {
  label: TableLabel;
  model: DataTableModel<Row>;
  columns: Column<Row>[];
  rowHeader: string;
  noun: Noun;
  scope: string;
  rowHref?: (row: Row) => string;
  rowActions?: (row: Row) => RowAction[];
  swipe: boolean;
  skeleton: boolean;
  busy: boolean;
  locale: string | undefined;
}

/**
 * The narrow layout: ListRow cards (the `card: 'title'` column or the row header as title, the status chip, then up to
 * three `card` fields), with the table header's jobs in a bar above them: select the shown rows, and sort.
 */
export function Cards<Row>(p: CardsProps<Row>) {
  const id = React.useId();
  const { model } = p;
  const sel = model.selection;
  const status = p.columns.find((c) => c.card === 'status');
  const header = p.columns.find((c) => c.id === p.rowHeader)!;
  const lead = p.columns.find((c) => c.card === 'title') ?? header;
  const fields = React.useMemo(
    () =>
      p.columns
        .filter((c): c is Column<Row> & { card: 1 | 2 | 3 } => typeof c.card === 'number' && c.id !== lead.id)
        .sort((a, b) => a.card - b.card)
        .slice(0, 3),
    [p.columns, lead],
  );
  const name =
    'caption' in p.label && p.label.caption != null
      ? { 'aria-labelledby': id }
      : p.label['aria-labelledby'] ? { 'aria-labelledby': p.label['aria-labelledby'] } : { 'aria-label': p.label['aria-label'] };
  const sortable = model.headers.filter((h) => h.sortable);
  const current = model.view.sort[0];
  // Only a sort the select can show; a sort on a non-sortable column reads as "Not sorted".
  const currentValue = current && sortable.some((h) => h.column.id === current.columnId) ? `${current.columnId}:${current.direction}` : '';
  return (
    <div className="ld-dt-cards">
      {'caption' in p.label && p.label.caption != null ? <p id={id} className="ld-table-caption">{p.label.caption}</p> : null}
      {(sel.enabled || sortable.length > 0) && !p.skeleton ? (
        <div className="ld-dt-cardbar">
          {sel.enabled ? (
            <label className="ld-dt-cardbar-check">
              <Checkbox
                checked={sel.page === 'all'}
                indeterminate={sel.page === 'some'}
                disabled={model.rows.length === 0 || sel.inert}
                onChange={sel.togglePage}
              />
              <span>{`Select all ${p.noun.other} ${p.scope}`}</span>
            </label>
          ) : null}
          {sortable.length ? (
            <label className="ld-dt-cardbar-sort">
              <span>Sort</span>
              <select
                className="ld-dt-select"
                value={currentValue}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  const at = v.lastIndexOf(':');
                  if (at > 0) model.sortBy(v.slice(0, at), v.slice(at + 1) as 'ascending' | 'descending');
                }}
              >
                {currentValue ? null : <option value="">Not sorted</option>}
                {sortable.flatMap((h) => [
                  <option key={`${h.column.id}:a`} value={`${h.column.id}:ascending`}>{`${h.column.label}, ascending`}</option>,
                  <option key={`${h.column.id}:d`} value={`${h.column.id}:descending`}>{`${h.column.label}, descending`}</option>,
                ])}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <ul className="ld-list-body" {...name} aria-busy={p.busy || undefined}>
        {p.skeleton
          ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <li key={i} className="ld-row-wrap ld-dt-card-skeleton" aria-hidden="true">
                <div className="ld-row"><span className="ld-skel" /><span className="ld-skel ld-skel-short" /></div>
              </li>
            ))
          : model.rows.map((r) => (
              <Card
                key={r.id}
                id={r.id}
                original={r.original}
                lead={lead}
                status={status}
                fields={fields}
                text={model.text}
                selected={sel.enabled ? sel.isSelected(r.id) : undefined}
                inert={sel.inert}
                toggle={sel.toggle}
                href={p.rowHref?.(r.original)}
                rowActions={p.rowActions}
                swipe={p.swipe}
                locale={p.locale}
              />
            ))}
      </ul>
    </div>
  );
}

interface CardProps<Row> {
  id: string;
  original: Row;
  /** The column the card leads with. The checkbox and menu are named by the row header, through `text`. */
  lead: Column<Row>;
  status: Column<Row> | undefined;
  fields: Array<Column<Row>>;
  text: (row: Row, columnId?: string) => string;
  selected: boolean | undefined;
  inert: boolean;
  toggle: (id: string, on: boolean, o?: { range?: boolean }) => void;
  href: string | undefined;
  rowActions: ((row: Row) => RowAction[]) | undefined;
  swipe: boolean;
  locale: string | undefined;
}

/** One card. Memoized like DataRow. Its swipe buttons need the actions up front, so `rowActions` is a memo input. */
const Card = React.memo(function Card<Row>(p: CardProps<Row>) {
  const row = p.original;
  const rowName = p.text(row);
  return (
    <ListRow
      rowKey={p.id}
      className={p.selected ? 'ld-dt-card-selected' : undefined}
      title={p.lead.cell ? p.lead.cell(row) : p.text(row, p.lead.id)}
      subtitle={
        p.fields.length ? (
          <>
            {p.fields.map((f, i) => (
              <React.Fragment key={f.id}>
                {i > 0 ? ' ' : null}
                {/* Every field but the last ends with its dot, so a line never starts with one. */}
                <span className="ld-dt-card-field">
                  <span className="ld-sr-only">{`${f.label}: `}</span>
                  {p.text(row, f.id)}
                  {i < p.fields.length - 1 ? (
                    <>
                      <span aria-hidden="true">{'\u00a0·'}</span>
                      <span className="ld-sr-only">, </span>
                    </>
                  ) : null}
                </span>
              </React.Fragment>
            ))}
          </>
        ) : undefined
      }
      value={p.status ? cellContent(p.status, row, p.locale) : undefined}
      href={p.href}
      chevron={false}
      control={
        p.selected !== undefined ? (
          <Checkbox
            aria-label={`Select ${rowName}`}
            checked={p.selected}
            disabled={p.inert}
            onChange={(e) => p.toggle(p.id, e.currentTarget.checked, { range: (e.nativeEvent as MouseEvent).shiftKey })}
          />
        ) : undefined
      }
      actions={p.rowActions?.(row)}
      actionsVisible
      actionsLabel={rowName}
      swipe={p.swipe}
    />
  );
}) as <Row>(p: CardProps<Row>) => React.ReactElement;

