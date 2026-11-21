import * as React from 'react';
import { useSearchParams } from 'react-router';
import { readView, useSetViewParams } from '@/view-params';
// The looks' faces, bundled with the site. A browser fetches a face only when a look's CSS uses it.
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/libre-franklin';
import '@fontsource/unifrakturmaguntia';

/**
 * SPIKE: the site's look, `data-look` on <html>, read from the URL's `?look=brutal` (src/view-params.ts) and carried to
 * every page with the appearance. A bare URL shows Lede. The param's name and values stay as they are when the look
 * becomes a theme axis. `?chrome=0` hides the floating picker, and the Looks page has its own picker.
 */
export const LOOKS = [
  { id: 'lede', name: 'Lede' },
  { id: 'skeuo', name: 'Skeuomorphic' },
  { id: 'brutal', name: 'Neo-brutalist' },
  { id: 'broadsheet', name: 'Broadsheet' },
] as const;
export type LookId = (typeof LOOKS)[number]['id'];
const IDS = LOOKS.map((l) => l.id);

export function useLook(): LookId {
  return readView(useSearchParams()[0], 'look', IDS, 'lede');
}

export function useSetLook() {
  const set = useSetViewParams();
  return React.useCallback((look: LookId) => set({ look: look === 'lede' ? null : look }), [set]);
}

/** In the router's root: puts the URL's look on <html>, where looks.css reads it. */
export function useLookAttribute() {
  const look = useLook();
  React.useLayoutEffect(() => {
    if (look === 'lede') delete document.documentElement.dataset.look;
    else document.documentElement.dataset.look = look;
  }, [look]);
}

/** The floating picker: in `npm run dev`, or in a build once a look is chosen, so the test suite's pages stay as they were. */
export function LookSwitcher() {
  const look = useLook();
  const setLook = useSetLook();
  const params = typeof window === 'undefined' ? null : new URLSearchParams(location.search);
  if (!params || params.get('chrome') === '0' || (!import.meta.env.DEV && look === 'lede' && !params.has('look'))) return null;
  return (
    <label
      style={{
        position: 'fixed', insetInlineEnd: 12, insetBlockEnd: 12, zIndex: 2147483000, display: 'flex', gap: 6, alignItems: 'center',
        padding: '6px 10px', background: '#111', color: '#fff', font: '12px system-ui, sans-serif', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,.3)',
      }}
    >
      Look
      <select value={look} onChange={(e) => setLook(e.target.value as LookId)} style={{ font: 'inherit' }}>
        {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}
