import * as React from 'react';
import { cn } from '../cn';
import { focusLanding } from '../input-modality';

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
  /** The selected item. `null`, `undefined`, `false`, `true`, `''` and `0` mean nothing is selected, so `selected && <Message />` works. */
  detail: React.ReactNode;
  /** Shown in the detail pane on wide screens when nothing is selected. */
  empty?: React.ReactNode;
  className?: string;
}

const shows = (node: React.ReactNode) => node != null && typeof node !== 'boolean' && node !== '' && node !== 0;
const visible = (el: Element | null): el is HTMLElement => !!el && el !== document.body && el.isConnected && el.checkVisibility();

/**
 * Two named regions side by side on wide screens. On narrow screens only one shows at a time: the list, or the
 * detail when one is selected, chosen by the route so Back works. The hidden pane is `display: none`, so it leaves
 * the tab order and the accessibility tree.
 *
 * When the pane that holds focus hides, focus follows to the one that shows: the detail's first heading when it
 * opens, and back to the control that opened it when it closes, else the list's first heading. A detail that moves
 * focus itself, as InboxFlow's does, keeps its choice.
 */
export function MasterDetail(props: MasterDetailProps) {
  const open = shows(props.detail);
  const stacked = useStackedPanes();
  const listRef = React.useRef<HTMLElement>(null);
  const detailRef = React.useRef<HTMLElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const was = React.useRef({ open, stacked });
  React.useLayoutEffect(() => {
    const opened = open && !was.current.open;
    const swapped = open !== was.current.open || (stacked && !was.current.stacked);
    was.current = { open, stacked };
    const at = document.activeElement;
    if (opened && listRef.current?.contains(at)) opener.current = at as HTMLElement;
    if (!swapped) return;
    // After the commit, so a parent's own landing in this commit goes first.
    queueMicrotask(() => {
      if (visible(document.activeElement) || !document.hasFocus()) return;
      const heading = (pane: HTMLElement | null) => pane?.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
      const to = open ? heading(detailRef.current) : visible(opener.current) ? opener.current : heading(listRef.current);
      if (!to) return;
      if (to.matches('a[href], button, input, select, textarea, [tabindex]')) to.focus({ preventScroll: true });
      else { to.tabIndex = -1; focusLanding(to); }
      to.scrollIntoView({ block: 'nearest' });
    });
  }, [open, stacked]);
  return (
    <div className={cn('ld-md', props.className)} data-detail-open={open || undefined}>
      <section ref={listRef} className="ld-md-list" aria-label={props.listLabel}>{props.list}</section>
      <section ref={detailRef} className="ld-md-detail" aria-label={props.detailLabel}>{open ? props.detail : props.empty}</section>
    </div>
  );
}
