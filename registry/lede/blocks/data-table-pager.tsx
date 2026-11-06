import { Button } from '../button';
import type { Noun } from './selection-bar';
import type { Paging } from './use-data-table';

/** Load more, or Previous / Page n of m / Next. */
export function Pager({ paging, noun, busy, locale }: { paging: Paging; noun: Noun; busy: boolean; locale: string | undefined }) {
  if (paging.kind === 'load-more') {
    return paging.hasMore ? (
      <div className="ld-dt-pager">
        <Button variant="tinted" className="ld-dt-btn" aria-disabled={busy || undefined} onClick={() => { if (!busy) paging.onLoadMore(); }}>
          {busy ? 'Loading…' : 'Load more'}
        </Button>
      </div>
    ) : null;
  }
  const { page, pageCount, onPageChange } = paging;
  const go = (to: number) => () => { if (to >= 0 && to < pageCount && to !== page) onPageChange(to); };
  // `aria-disabled` leaves the button focusable, so focus stays on it at the first or last page.
  return (
    <nav className="ld-dt-pager" aria-label={`Pages of ${noun.other}`}>
      <Button variant="gray" className="ld-dt-btn" aria-disabled={page <= 0 || undefined} onClick={go(page - 1)}>Previous</Button>
      <span className="ld-dt-page">{`Page ${(page + 1).toLocaleString(locale)} of ${pageCount.toLocaleString(locale)}`}</span>
      <Button variant="gray" className="ld-dt-btn" aria-disabled={page >= pageCount - 1 || undefined} onClick={go(page + 1)}>Next</Button>
    </nav>
  );
}
