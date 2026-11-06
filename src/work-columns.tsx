import type { ReactNode } from 'react';
import { defineColumns } from '@lede/blocks/use-data-table';
import type { StatusTone } from '@lede/blocks/summary-card';
import { dueDate, type WorkItem, type WorkStatus } from '@/data/work-items';

/** Color for the two states that need a reaction: done is good news, blocked needs help. The rest stay neutral. */
const TONE: Record<WorkStatus, StatusTone> = { Open: 'neutral', 'In progress': 'neutral', Blocked: 'critical', Done: 'positive' };
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatMoney = (n: number) => money.format(n);

/** A status word with a dot in its tone. The word is always spelled out; the dot's color only adds to it. */
export function Status({ tone, working, children }: { tone: StatusTone; working?: boolean; children: ReactNode }) {
  return (
    <span className={`ld-status ld-status-${tone}${working ? ' docs-status-working' : ''}`}>
      <span className="ld-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** A work item's status. While it's archiving, the dot is a ring. */
export const StatusChip = ({ status, archiving }: { status: WorkStatus; archiving?: boolean }) => (
  <Status tone={TONE[status]} working={archiving}>{status}</Status>
);

/**
 * Module scope: a stable column list means the table never rebuilds its column model. A card leads with the title,
 * and the line under it is the ID (what the page's messages name an item by), the due date and the amount.
 */
export const workColumns = defineColumns<WorkItem>([
  { id: 'id', label: 'ID', value: (r) => r.id, compare: (a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)), sortable: true, width: { preferred: 112, min: 104 }, card: 1 },
  { id: 'title', label: 'Title', value: (r) => r.title, sortable: true, truncate: true, width: { min: 200, preferred: 300 }, card: 'title' },
  {
    id: 'status', label: 'Status', value: (r) => r.status, cell: (r) => <StatusChip status={r.status} archiving={r.archiving} />, sortable: true,
    compare: (a, b) => ['Open', 'In progress', 'Blocked', 'Done'].indexOf(a.status) - ['Open', 'In progress', 'Blocked', 'Done'].indexOf(b.status),
    width: { preferred: 136, min: 128 }, card: 'status',
  },
  { id: 'assignee', label: 'Assignee', value: (r) => r.assignee.name, sortable: true, truncate: true, width: { preferred: 160, min: 120 } },
  { id: 'due', label: 'Due', value: (r) => dueDate(r), sortable: true, width: { preferred: 136, min: 120 }, card: 2 },
  // A card shows each field's value as text, so the value is the formatted amount and compare keeps the sort numeric.
  {
    id: 'amount', label: 'Amount', value: (r) => formatMoney(r.amount), compare: (a, b) => a.amount - b.amount, align: 'end', sortable: true,
    width: { preferred: 128, min: 112 }, card: 3,
  },
]);
