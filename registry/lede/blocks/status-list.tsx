import * as React from 'react';
import { ListGroup, ListRow } from '../list';
import { StatusText } from '../status-text';
import type { StatusTone } from '../tone';

export interface StatusItem {
  /** Stable key, written to the row's `data-row-id`. */
  id: string;
  /** What the status is about, such as a host's name. */
  title: React.ReactNode;
  /** What to look at, such as "Deploy failed on the health check". */
  subtitle?: React.ReactNode;
  tone: StatusTone;
  /** The status in words, such as "Failed". The tone only adds color. */
  status: string;
  /** Where the item's detail lives. */
  href?: string;
  /** Acts in place. Use `href` for navigation. */
  onClick?: (e: React.MouseEvent) => void;
}

export interface StatusListProps {
  /** The list's heading, such as "Needs attention". */
  title: React.ReactNode;
  /** The one-line takeaway beside the heading, such as "2 failed, 1 would change". */
  summary?: React.ReactNode;
  items: StatusItem[];
  /** Shown in place of the rows when no item is listed. Default “Nothing needs a look.” */
  empty?: React.ReactNode;
  /** Lines each subtitle shows before it ends in an ellipsis: 1, 2 or `'all'`. Default 2. */
  subtitleLines?: 1 | 2 | 'all';
  /** Heading level for `title`. Default 2. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  footer?: React.ReactNode;
  className?: string;
}

/** Worst first. Items with the same tone keep the order they came in. */
const RANK: Record<StatusTone, number> = { critical: 0, caution: 1, neutral: 2, positive: 3 };

/**
 * A ListGroup of items that may need a look, worst first: `critical`, then `caution`, `neutral` and `positive`. Each
 * row ends in its status as StatusText, and the group shows `empty` when there's nothing to list.
 */
export function StatusList(props: StatusListProps) {
  const items = [...props.items].sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  return (
    <ListGroup
      title={props.title}
      summary={props.summary}
      footer={props.footer}
      headingLevel={props.headingLevel}
      empty={props.empty ?? 'Nothing needs a look.'}
      className={props.className}
    >
      {items.map((item) => (
        <ListRow
          key={item.id}
          rowKey={item.id}
          title={item.title}
          subtitle={item.subtitle}
          subtitleLines={props.subtitleLines ?? 2}
          value={<StatusText tone={item.tone}>{item.status}</StatusText>}
          href={item.href}
          onClick={item.onClick}
        />
      ))}
    </ListGroup>
  );
}
