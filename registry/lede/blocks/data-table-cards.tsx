import * as React from 'react';
import type { TableLabel } from '../table';
import { Checkbox } from '../checkbox';
import { ListRow, type RowAction } from '../list';
import type { Noun } from './selection-bar';
import type { Column, DataTableLabels, DataTableModel } from './use-data-table';
import { SKELETON_ROWS, cellContent } from './data-table-row';

interface CardsProps<Row> {
  label: TableLabel;
  model: DataTableModel<Row>;
  columns: Column<Row>[];
  rowHeader: string;
  noun: Noun;
  scope: string;
  labels: DataTableLabels;
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
  const currentValue = current ? `${current.columnId}:${current.direction}` : '';
  // A sort on a column the select doesn't offer, such as one a saved view or the server chose, still reads as itself.
  const fixed = current && !sortable.some((h) => h.column.id === current.columnId)
    ? model.headers.find((h) => h.column.id === current.columnId)?.column.label ?? current.columnId
    : undefined;
  return (
    <div className="ld-dt-cards">
      {'caption' in p.label && p.label.caption != null ? <p id={id} className="ld-table-caption">{p.label.caption}</p> : null}
      {/* Mounted through the skeleton, as the table's header is, so a sort answered with a skeleton keeps its focus. */}
      {sel.enabled || sortable.length > 0 ? (
        <div className="ld-dt-cardbar">
          {sel.enabled ? (
            <label className="ld-dt-cardbar-check">
              <Checkbox
                checked={sel.page === 'all'}
                indeterminate={sel.page === 'some'}
                disabled={model.rows.length === 0}
                aria-disabled={sel.inert || undefined}
                onChange={sel.togglePage}
              />
              <span>{p.labels.selectAll({ noun: p.noun, scope: p.scope })}</span>
            </label>
          ) : null}
          {sortable.length ? (
            <label className="ld-dt-cardbar-sort">
              <span>{p.labels.sort}</span>
              <select
                className="ld-dt-select"
                value={currentValue}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  const at = v.lastIndexOf(':');
                  if (at > 0) model.sortBy(v.slice(0, at), v.slice(at + 1) as 'ascending' | 'descending');
                }}
              >
                {currentValue ? null : <option value="">{p.labels.notSorted}</option>}
                {fixed != null ? <option value={currentValue} disabled>{p.labels.sortOption({ column: fixed, direction: current!.direction })}</option> : null}
                {sortable.flatMap((h) => [
                  <option key={`${h.column.id}:a`} value={`${h.column.id}:ascending`}>{p.labels.sortOption({ column: h.column.label, direction: 'ascending' })}</option>,
                  <option key={`${h.column.id}:d`} value={`${h.column.id}:descending`}>{p.labels.sortOption({ column: h.column.label, direction: 'descending' })}</option>,
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
                labels={p.labels}
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
  labels: DataTableLabels;
  locale: string | undefined;
}

/** One card. Memoized like DataRow. Its swipe buttons need the actions up front, so `rowActions` is a memo input. */
const Card = React.memo(function Card<Row>(p: CardProps<Row>) {
  const row = p.original;
  const rowName = p.text(row);
  const actions = p.rowActions?.(row);
  const title = p.lead.cell ? p.lead.cell(row) : p.text(row, p.lead.id);
  // Nothing in the card takes focus: the title is where focus lands on it, as after Load more, as the table's row
  // header is.
  const bare = !p.href && p.selected === undefined && !actions?.length;
  // A field's text, or its `cell` where it has no text. One whose cell returns `null`, `''` or `false` is left out, dot
  // and all.
  const shown = p.fields
    .map((f) => ({ f, content: p.text(row, f.id) || (f.cell ? f.cell(row) : null) }))
    .filter(({ content }) => content != null && content !== '' && content !== false);
  return (
    <ListRow
      rowKey={p.id}
      className={p.selected ? 'ld-dt-card-selected' : undefined}
      title={bare ? <span className="ld-dt-card-title" tabIndex={-1}>{title}</span> : title}
      subtitle={
        shown.length ? (
          <>
            {shown.map(({ f, content }, i) => (
              <React.Fragment key={f.id}>
                {i > 0 ? ' ' : null}
                {/* Every field but the last ends with its dot, so a line never starts with one. */}
                <span className="ld-dt-card-field">
                  <span className="ld-sr-only">{`${f.label}: `}</span>
                  {content}
                  {i < shown.length - 1 ? (
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
            aria-label={p.labels.selectRow(rowName)}
            checked={p.selected}
            aria-disabled={p.inert || undefined}
            onChange={(e) => p.toggle(p.id, e.currentTarget.checked, { range: (e.nativeEvent as MouseEvent).shiftKey })}
          />
        ) : undefined
      }
      actions={actions}
      actionsVisible
      actionsLabel={rowName}
      moreLabel={p.labels.moreActions(rowName)}
      swipe={p.swipe}
    />
  );
}) as <Row>(p: CardProps<Row>) => React.ReactElement;

