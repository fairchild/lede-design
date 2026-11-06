/** Lede's mark, Headline: a heavy line over two light ones on a `primary` tile. Drawn on a 16px grid so it stays sharp
 * at 16px on a 1x screen. `scripts/build-brand.mjs` draws the same shape for the favicon set and the social card. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect className="docs-mark-tile" width="16" height="16" rx="3.5" />
      <rect className="docs-mark-line" x="3" y="4" width="10" height="2" rx="1" />
      <rect className="docs-mark-line" x="3" y="8" width="10" height="1" rx="0.5" />
      <rect className="docs-mark-line" x="3" y="11" width="7" height="1" rx="0.5" />
    </svg>
  );
}
