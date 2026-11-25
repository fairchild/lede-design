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

/**
 * The Settings → Appearance flow speaks in prefs; this is the one place they meet the URL's axes. Under a look, an
 * accent not in the URL is unset, so the look's own accent shows and the picker checks none. Without a look, it's Blue.
 */
const toPrefs = (a: Axes, accent: Axes['accent'] | undefined): AppearancePrefs => ({
  scheme: a.scheme, highContrast: a.contrast === 'high', accent, shape: a.shape, compact: a.density === 'compact', solidGlass: a.glass === 'solid',
});
const toAxes = (p: AppearancePrefs): Omit<Axes, 'accent'> => ({
  scheme: p.scheme, contrast: p.highContrast ? 'high' : 'auto', shape: p.shape, density: p.compact ? 'compact' : 'regular', glass: p.solidGlass ? 'solid' : 'regular',
});

const Ctx = React.createContext<{ prefs: AppearancePrefs; setPrefs: (p: AppearancePrefs) => void } | null>(null);

/** Site-wide appearance, derived from the URL on every render. The Settings → Appearance flow edits it live. */
export function AppearanceRoot({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const setParams = useSetViewParams();
  const axes = readAxes(params);
  const look = useLook();
  // The accent the URL picks, if any. An unknown one reads as none.
  const picked = (presets as readonly string[]).includes(params.get('accent') ?? '') ? axes.accent : undefined;
  const accent = look === 'lede' ? axes.accent : picked;
  const setPrefs = React.useCallback((p: AppearancePrefs) => {
    const next: Record<string, string | null> = Object.fromEntries(Object.entries(toAxes(p)).map(([name, value]) => (
      [name, value === AXES[name as keyof Axes][0] ? null : value]
    )));
    // Under a look, a picked accent stays in the URL even when it's Blue, the default, since leaving it out shows the
    // look's own accent. An unset one stays out.
    next.accent = !p.accent || (look === 'lede' && p.accent === AXES.accent[0]) ? null : p.accent;
    setParams(next);
  }, [setParams, look]);
  return (
    <Ctx.Provider value={{ prefs: toPrefs(axes, accent), setPrefs }}>
      <ThemeProvider className="app-root" surface="grouped" {...axes} accent={picked} look={look}>
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
