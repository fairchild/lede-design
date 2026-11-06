import * as React from 'react';
import { cn } from '../cn';

const STACKED = '(width < 68.75em)';
const readStacked = () => !!window.matchMedia && window.matchMedia(STACKED).matches;
function subscribeStacked(onChange: () => void) {
  if (!window.matchMedia) return () => undefined;
  const query = window.matchMedia(STACKED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True when panes show one at a time, on narrow screens. Use it to make the detail's title the `<h1>`. False on a server. */
export function useStackedPanes(): boolean {
  return React.useSyncExternalStore(subscribeStacked, readStacked, () => false);
}

export interface MasterDetailProps {
  /** Accessible name of the list region, such as "Messages". */
  listLabel: string;
  /** Accessible name of the detail region, such as "Message". */
  detailLabel: string;
  /** The list pane: usually a PageHeader and a ListGroup. */
  list: React.ReactNode;
  /** The selected item, or `null`. */
  detail: React.ReactNode | null;
  /** Shown in the detail pane on wide screens when nothing is selected. */
  empty?: React.ReactNode;
  className?: string;
}

/**
 * Two named regions side by side on wide screens. On narrow screens only one shows at a time: the list, or the
 * detail when one is selected, chosen by the route so Back works. The hidden pane is `display: none`, so it leaves
 * the tab order and the accessibility tree.
 */
export function MasterDetail(props: MasterDetailProps) {
  const open = props.detail != null;
  return (
    <div className={cn('ld-md', props.className)} data-detail-open={open || undefined}>
      <section className="ld-md-list" aria-label={props.listLabel}>{props.list}</section>
      <section className="ld-md-detail" aria-label={props.detailLabel}>{open ? props.detail : props.empty}</section>
    </div>
  );
}
