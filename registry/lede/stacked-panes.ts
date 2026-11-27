import * as React from 'react';

// The width under which MasterDetail and WorkbenchShell show one pane at a time, as in `lede.blocks.css`.
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
