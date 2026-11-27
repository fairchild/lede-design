import * as React from 'react';
import { Button } from '../button';
import type { Noun } from './selection-bar';
import type { DataTableLabels, Paging } from './use-data-table';

/** Load more, or Previous / Page n of m / Next. `shown` is the number of rows on screen. */
export function Pager({ paging, noun, labels: l, busy, shown, locale }: { paging: Paging; noun: Noun; labels: DataTableLabels; busy: boolean; shown: number; locale: string | undefined }) {
  // Load more is busy only for a fetch it asked for, so a background refresh leaves it usable. A press is answered when
  // new rows arrive or the table's fetch settles, and one that started no fetch is dropped once its render commits.
  const [asked, setAsked] = React.useState(false);
  const [seen, setSeen] = React.useState({ busy, shown });
  if (busy !== seen.busy || shown !== seen.shown) {
    setSeen({ busy, shown });
    if (shown !== seen.shown || !busy) setAsked(false);
  }
  React.useEffect(() => { if (asked && !busy) setAsked(false); }, [asked, busy]);
  if (paging.kind === 'load-more') {
    const loading = busy && asked;
    return paging.hasMore ? (
      <div className="ld-dt-pager">
        <Button
          variant="tinted"
          className="ld-dt-btn"
          aria-disabled={loading || undefined}
          onClick={() => { if (!loading) { setAsked(true); paging.onLoadMore(); } }}
        >
          {loading ? l.loadingMore : l.loadMore}
        </Button>
      </div>
    ) : null;
  }
  const { page, pageCount, onPageChange } = paging;
  const go = (to: number) => () => { if (to >= 0 && to < pageCount && to !== page) onPageChange(to); };
  // `aria-disabled` leaves the button focusable, so focus stays on it at the first or last page.
  return (
    <nav className="ld-dt-pager" aria-label={l.pages(noun)}>
      <Button variant="gray" className="ld-dt-btn" aria-disabled={page <= 0 || undefined} onClick={go(page - 1)}>{l.previous}</Button>
      <span className="ld-dt-page">{l.page({ page: (page + 1).toLocaleString(locale), count: pageCount.toLocaleString(locale) })}</span>
      <Button variant="gray" className="ld-dt-btn" aria-disabled={page >= pageCount - 1 || undefined} onClick={go(page + 1)}>{l.next}</Button>
    </nav>
  );
}
