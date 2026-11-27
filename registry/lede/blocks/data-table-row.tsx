import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Table } from '../table';
import { Checkbox } from '../checkbox';
import { useLinkComponent } from '../link';
import { formatValue, type Column, type DataTableLabels } from './use-data-table';

/** Placeholder rows while the first page loads. */
export const SKELETON_ROWS = 6;

export const cellContent = <Row,>(c: Column<Row>, row: Row, locale?: string) => (c.cell ? c.cell(row) : formatValue(c.value?.(row), locale));
const Dots = () => (
  <svg viewBox="0 0 20 20" width={20} height={20} fill="currentColor" aria-hidden="true">
    <path d="M2.4 10a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0M8.4 10a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0M14.4 10a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0" />
  </svg>
);

interface DataRowProps<Row> {
  id: string;
  original: Row;
  columns: Column<Row>[];
  rowHeader: string;
  text: (row: Row, columnId?: string) => string;
  /** `undefined` when the table has no selection. */
  selected: boolean | undefined;
  /** The rows on screen are the last view’s: the checkbox is `aria-disabled`, so it keeps focus. */
  inert: boolean;
  toggle: (id: string, on: boolean, o?: { range?: boolean }) => void;
  href: string | undefined;
  /** The table's one actions menu; each row has a Base UI trigger attached to it. */
  menu: Menu.Handle<string> | undefined;
  /** This row has actions: a row whose `rowActions` returns none keeps its empty cell and gets no •••. */
  hasActions: boolean;
  sticky: boolean;
  /** Stable while the caller's `labels` is. */
  labels: DataTableLabels;
  locale: string | undefined;
}

/**
 * One body row. Memoized on primitive and stable props: a sort moves rows without re-rendering them, and a selection
 * change re-renders only the rows whose checkbox changed.
 */
export const DataRow = React.memo(function DataRow<Row>(p: DataRowProps<Row>) {
  const Link = useLinkComponent();
  const { id, original, columns } = p;
  const name = p.text(original);
  // A sticky first cell is positioned. When it's the row header, it confines the link's `::after` to itself, and when
  // it isn't, it sits above that `::after`. A twin link, out of the tab order and hidden from assistive tech, then
  // covers the rest of the row, or that cell, so the whole row stays one target.
  const twinAt = !p.href || !p.sticky ? -1 : columns[0]?.id === p.rowHeader ? 1 : 0;
  return (
    <Table.Row selected={p.selected} data-row-id={id}>
      {p.selected !== undefined ? (
        <Table.Cell className="ld-table-check" sticky={p.sticky}>
          <Checkbox
            aria-label={p.labels.selectRow(name)}
            checked={p.selected}
            aria-disabled={p.inert || undefined}
            onChange={(e) => p.toggle(id, e.currentTarget.checked, { range: (e.nativeEvent as MouseEvent).shiftKey })}
          />
        </Table.Cell>
      ) : null}
      {columns.map((c, i) => {
        const content = cellContent(c, original, p.locale);
        const sticky = p.sticky && i === 0;
        if (c.id === p.rowHeader) {
          // Truncation goes inside the link, so the ellipsis is drawn on the link's text.
          return (
            // Without a link, the row header is where focus lands on the row, as after Load more.
            <Table.RowHeader key={c.id} align={c.align} sticky={sticky} truncate={c.truncate && !p.href} tabIndex={p.href ? undefined : -1}>
              {p.href ? <Table.RowLink href={p.href}>{c.truncate ? <span className="ld-table-trunc">{content}</span> : content}</Table.RowLink> : content}
            </Table.RowHeader>
          );
        }
        return (
          <Table.Cell key={c.id} align={c.align} truncate={c.truncate} sticky={sticky}>
            {i === twinAt ? <Link href={p.href!} className="ld-table-twin" tabIndex={-1} aria-hidden="true" /> : null}
            {content}
          </Table.Cell>
        );
      })}
      {p.menu ? (
        <Table.Cell className="ld-table-actions">
          {p.hasActions ? (
            <Menu.Trigger handle={p.menu} payload={id} className="ld-table-more" aria-label={p.labels.moreActions(name)}>
              <Dots />
            </Menu.Trigger>
          ) : null}
        </Table.Cell>
      ) : null}
    </Table.Row>
  );
}) as <Row>(p: DataRowProps<Row>) => React.ReactElement;

