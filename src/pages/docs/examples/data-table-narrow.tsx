import { useCallback } from 'react';
import { DataTable } from '@/components/lede/blocks/data-table';
import { defineColumns } from '@/components/lede/blocks/use-data-table';
import type { RowAction } from '@/components/lede/list';

interface WorkItem { id: string; title: string; status: string; due: string; amount: number }

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

// In a pane narrower than narrowBelow (560px by default), rows become cards. A card leads with the
// column marked card: 'title' (the row header when none is) and lists card: 1, 2 and 3 on the line
// below it. A field keeps to one line, and one wider than the card wraps inside itself. card: 'status'
// sits beside the text, where a long status narrows it, or under the text when the card is narrower
// than 440px. Checkboxes and menus are named by the row header, so rows whose titles repeat stay
// distinct; give it a numbered slot so that name shows on the card.
const columns = defineColumns<WorkItem>([
  { id: 'id', label: 'ID', value: (r) => r.id, sortable: true, card: 1 },
  { id: 'title', label: 'Title', value: (r) => r.title, sortable: true, truncate: true, card: 'title' },
  { id: 'status', label: 'Status', value: (r) => r.status, card: 'status' },
  { id: 'due', label: 'Due', value: (r) => r.due, sortable: true, card: 2 },
  {
    id: 'amount', label: 'Amount', value: (r) => money.format(r.amount), compare: (a, b) => a.amount - b.amount,
    align: 'end', sortable: true, card: 3,
  },
]);

export function NarrowWorkTable({ items, onArchive }: { items: WorkItem[]; onArchive: (id: string) => void }) {
  const rowActions = useCallback(
    (r: WorkItem): RowAction[] => [{ label: 'Archive', tone: 'neutral', onSelect: () => onArchive(r.id) }],
    [onArchive],
  );
  return (
    <DataTable
      caption="Work items in a narrow pane"
      noun={{ one: 'work item', other: 'work items' }}
      columns={columns}
      rows={items}
      getRowId={(r) => r.id}
      rowHeader="id"
      selectionMode="multiple"
      rowActions={rowActions}
      swipeActions // swipe a card for its actions; the ••• menu stays as the visible twin
      narrow="cards" // or "scroll": keep the table, with a sticky first column
    />
  );
}
