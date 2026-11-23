import * as React from 'react';
import { useSearchParams } from 'react-router';
import { ThemeProvider, presets } from '@lede/theme-provider';
import type { AppearancePrefs } from '@lede/flows/settings';
import { readView, useSetViewParams } from '@/view-params';
import { useLook } from '@/look-switcher';

/**
 * The site's appearance is ThemeProvider's props, read from the URL's query by the same names:
 * `?scheme=dark&contrast=high&accent=teal&shape=square&density=compact&glass=solid`. Each is first in its list by default,
 * and a default stays out of the URL. A bare URL follows the system: Automatic mode, and contrast that rises with the
 * system's Increase contrast.
 */
const AXES = {
  scheme: ['auto', 'light', 'dark'],
  contrast: ['auto', 'high'],
  accent: presets,
  shape: ['soft', 'crisp', 'square'],
  density: ['regular', 'compact'],
  glass: ['regular', 'solid'],
} as const;
type Axes = { [K in keyof typeof AXES]: (typeof AXES)[K][number] };

function readAxes(params: URLSearchParams): Axes {
  return Object.fromEntries(Object.entries(AXES).map(([name, values]) => [name, readView(params, name, values, values[0])])) as Axes;
}

/** The Settings → Appearance flow speaks in prefs; this is the one place they meet the URL's axes. */
const toPrefs = (a: Axes): AppearancePrefs => ({
  scheme: a.scheme, highContrast: a.contrast === 'high', accent: a.accent, shape: a.shape, compact: a.density === 'compact', solidGlass: a.glass === 'solid',
});
const toAxes = (p: AppearancePrefs): Axes => ({
  scheme: p.scheme, contrast: p.highContrast ? 'high' : 'auto', accent: p.accent, shape: p.shape, density: p.compact ? 'compact' : 'regular', glass: p.solidGlass ? 'solid' : 'regular',
});

const Ctx = React.createContext<{ prefs: AppearancePrefs; setPrefs: (p: AppearancePrefs) => void } | null>(null);

/** Site-wide appearance, derived from the URL on every render. The Settings → Appearance flow edits it live. */
export function AppearanceRoot({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const setParams = useSetViewParams();
  const axes = readAxes(params);
  const look = useLook();
  const setPrefs = React.useCallback((p: AppearancePrefs) => {
    const next = toAxes(p);
    setParams(Object.fromEntries(Object.entries(AXES).map(([name, values]) => [name, next[name as keyof Axes] === values[0] ? null : next[name as keyof Axes]])));
  }, [setParams]);
  return (
    <Ctx.Provider value={{ prefs: toPrefs(axes), setPrefs }}>
      {/* An accent not in the URL stays unset, so a look's own accent shows until one is picked. */}
      <ThemeProvider className="app-root" surface="grouped" {...axes} accent={(presets as readonly string[]).includes(params.get('accent') ?? '') ? axes.accent : undefined} look={look}>
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  );
}

export function useAppearance() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useAppearance must be used inside <AppearanceRoot>');
  return v;
}
