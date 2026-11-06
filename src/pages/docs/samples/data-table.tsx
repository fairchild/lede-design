import { useCallback } from 'react';
import { DataTable } from '@/components/lede/blocks/data-table';
import { defineColumns, type Selection } from '@/components/lede/blocks/use-data-table';
import type { RowAction } from '@/components/lede/list';

interface WorkItem { id: string; title: string; amount: number }

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

// Module scope (or useMemo): rows are memoized against the column list. Development builds warn if it changes on
// every render. Each column's card option places it in the card layout for narrow containers.
const columns = defineColumns<WorkItem>([
  { id: 'id', label: 'ID', value: (r) => r.id, sortable: true, width: { min: 104 }, card: 1 },
  { id: 'title', label: 'Title', value: (r) => r.title, sortable: true, truncate: true, card: 'title' },
  // Cards show value as text, so it's the formatted amount; compare keeps the sort numeric.
  {
    id: 'amount', label: 'Amount', value: (r) => money.format(r.amount), compare: (a, b) => a.amount - b.amount,
    align: 'end', sortable: true, card: 2,
  },
]);

export function WorkTable({ items, onArchive }: { items: WorkItem[]; onArchive: (selection: Selection) => void }) {
  // Also stable: the card layout's rows are memoized against it.
  const rowActions = useCallback(
    (r: WorkItem): RowAction[] => [
      { label: 'Archive', tone: 'neutral', onSelect: () => onArchive({ kind: 'ids', ids: new Set([r.id]) }) },
    ],
    [onArchive],
  );
  return (
    <DataTable
      caption="Work items"
      noun={{ one: 'work item', other: 'work items' }}
      columns={columns}
      rows={items}
      getRowId={(r) => r.id}
      rowHeader="id"
      defaultView={{ sort: [{ columnId: 'amount', direction: 'descending' }] }}
      selectionMode="multiple"
      bulkActions={[{ label: 'Archive', onSelect: onArchive }]}
      rowHref={(r) => `/work/${r.id}`}
      rowActions={rowActions}
    />
  );
}
