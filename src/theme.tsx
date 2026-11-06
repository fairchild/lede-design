import * as React from 'react';
import { ThemeProvider, presets } from '@lede/theme-provider';
import type { AppearancePrefs } from '@lede/flows/settings';

const KEY = 'lede:appearance';
const DEFAULTS: AppearancePrefs = { scheme: 'auto', highContrast: false, accent: 'blue', shape: 'soft', compact: false, solidGlass: false };

const oneOf = <T extends string>(values: Record<T, true>) => (v: unknown) => typeof v === 'string' && Object.hasOwn(values, v);
const isBoolean = (v: unknown) => typeof v === 'boolean';

/** One check per field. The tables are typed, so adding a value to a union in the flow fails the typecheck here. */
const ALLOWED: { [K in keyof AppearancePrefs]: (v: unknown) => boolean } = {
  scheme: oneOf<AppearancePrefs['scheme']>({ auto: true, light: true, dark: true }),
  highContrast: isBoolean,
  accent: (v) => (presets as readonly unknown[]).includes(v),
  shape: oneOf<AppearancePrefs['shape']>({ soft: true, crisp: true, square: true }),
  compact: isBoolean,
  solidGlass: isBoolean,
};

/** Storage can hold anything, so each field is kept only when it has the right type and an allowed value. */
function load(): AppearancePrefs {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return DEFAULTS;
    return { ...DEFAULTS, ...Object.fromEntries(Object.entries(stored).filter(([k, v]) => Object.hasOwn(ALLOWED, k) && ALLOWED[k as keyof AppearancePrefs](v))) };
  } catch {
    return DEFAULTS;
  }
}

const Ctx = React.createContext<{ prefs: AppearancePrefs; setPrefs: (p: AppearancePrefs) => void } | null>(null);

/** Site-wide appearance, remembered per browser. The Settings → Appearance flow edits it live. */
export function AppearanceRoot({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = React.useState<AppearancePrefs>(load);
  const setPrefs = React.useCallback((p: AppearancePrefs) => {
    setState(p);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: keep in memory */ }
  }, []);
  // Another document changed the prefs: a second tab, or the docs page around a layout preview's frame.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) setState(load()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return (
    <Ctx.Provider value={{ prefs, setPrefs }}>
      <ThemeProvider
        className="app-root"
        surface="grouped"
        scheme={prefs.scheme}
        contrast={prefs.highContrast ? 'high' : 'auto'}
        accent={prefs.accent}
        shape={prefs.shape}
        density={prefs.compact ? 'compact' : 'regular'}
        glass={prefs.solidGlass ? 'solid' : 'regular'}
      >
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
