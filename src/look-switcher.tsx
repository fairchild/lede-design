import * as React from 'react';
import { readParam, shareSiteWide, writeParams } from '@/url-state';
// The looks' faces, bundled with the site. A browser fetches a face only when a look's CSS uses it.
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/libre-franklin';
import '@fontsource/unifrakturmaguntia';

/**
 * SPIKE: the site's look, `data-look` on <html>. The URL carries it as `?look=brutal` on every page, so a link shows its
 * sender's look: opening one wins over the look this browser remembered, and is remembered in turn. The param's name and
 * values stay as they are when the look becomes a theme axis. `?chrome=0` hides the floating picker, and the Looks page
 * has its own picker. One store, so every picker shows the same look.
 */
export const LOOKS = [
  { id: 'lede', name: 'Lede' },
  { id: 'skeuo', name: 'Skeuomorphic' },
  { id: 'brutal', name: 'Neo-brutalist' },
  { id: 'broadsheet', name: 'Broadsheet' },
] as const;
export type LookId = (typeof LOOKS)[number]['id'];
const KEY = 'lede:look';
const valid = (v: string | null): v is LookId => LOOKS.some((l) => l.id === v);

const remember = (look: LookId) => { try { localStorage.setItem(KEY, look); } catch { /* no storage */ } };

function initial(): LookId {
  if (typeof window === 'undefined') return 'lede';
  const fromUrl = readParam('look');
  // Remembered, so a layout preview's frame, which has its own URL, shows the same look.
  if (valid(fromUrl)) { remember(fromUrl); return fromUrl; }
  try { const s = localStorage.getItem(KEY); if (valid(s)) return s; } catch { /* no storage */ }
  return 'lede';
}

let current: LookId = initial();
const toParams = () => ({ look: current === 'lede' ? null : current });
const listeners = new Set<() => void>();
function apply() {
  if (typeof document === 'undefined') return;
  if (current === 'lede') delete document.documentElement.dataset.look;
  else document.documentElement.dataset.look = current;
}
apply();
shareSiteWide(toParams);

export function setLook(look: LookId) {
  current = look;
  apply();
  remember(look);
  writeParams(toParams());
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useLook = () => React.useSyncExternalStore(subscribe, () => current, () => 'lede' as LookId);

/** The floating picker: in `npm run dev`, or in a build once a look is chosen, so the test suite's pages stay as they were. */
export function LookSwitcher() {
  const look = useLook();
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
