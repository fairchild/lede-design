import * as React from 'react';

/** SPIKE: picks a look (`data-look` on <html>). `?look=brutal` in the URL wins and is remembered; `?chrome=0` hides the picker. */
export const LOOKS = [
  { id: 'lede', name: 'Lede (default)' },
  { id: 'skeuo', name: 'Skeuomorphic' },
  { id: 'brutal', name: 'Neo-brutalist' },
  { id: 'broadsheet', name: 'Broadsheet' },
] as const;
const KEY = 'lede:look';
const valid = (v: string | null) => LOOKS.some((l) => l.id === v);

function initial(): string {
  if (typeof window === 'undefined') return 'lede';
  const fromUrl = new URLSearchParams(location.search).get('look');
  if (valid(fromUrl)) return fromUrl!;
  try { const s = localStorage.getItem(KEY); if (valid(s)) return s!; } catch { /* no storage */ }
  return 'lede';
}

export function LookSwitcher() {
  const [look, setLook] = React.useState(initial);
  const hidden = typeof window !== 'undefined' && new URLSearchParams(location.search).get('chrome') === '0';
  React.useEffect(() => {
    if (look === 'lede') delete document.documentElement.dataset.look;
    else document.documentElement.dataset.look = look;
    try { localStorage.setItem(KEY, look); } catch { /* no storage */ }
  }, [look]);
  if (hidden) return null;
  return (
    <label
      style={{
        position: 'fixed', insetInlineEnd: 12, insetBlockEnd: 12, zIndex: 2147483000, display: 'flex', gap: 6, alignItems: 'center',
        padding: '6px 10px', background: '#111', color: '#fff', font: '12px system-ui, sans-serif', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,.3)',
      }}
    >
      Look
      <select value={look} onChange={(e) => setLook(e.target.value)} style={{ font: 'inherit' }}>
        {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}
