import * as React from 'react';
import { ThemeProvider, presets } from '@lede/theme-provider';
import type { AppearancePrefs } from '@lede/flows/settings';
import { readParam, shareSiteWide, writeParams, type Params } from '@/url-state';

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

/**
 * The appearance in the URL, so a link shows its sender's: `?scheme=dark&contrast=high&accent=teal&shape=square&
 * density=compact&glass=solid`. A pref at its default stays out. A param the link leaves out keeps the reader's own
 * setting, so a plain link never turns off someone's dark mode or high contrast.
 */
const PARAMS: { [K in keyof AppearancePrefs]: { name: string; write: (v: AppearancePrefs[K]) => string | null; read: (v: string) => unknown } } = {
  scheme: { name: 'scheme', write: (v) => (v === 'auto' ? null : v), read: (v) => v },
  highContrast: { name: 'contrast', write: (v) => (v ? 'high' : null), read: (v) => (v === 'high' ? true : v === 'standard' ? false : undefined) },
  accent: { name: 'accent', write: (v) => (v === DEFAULTS.accent ? null : v), read: (v) => v },
  shape: { name: 'shape', write: (v) => (v === DEFAULTS.shape ? null : v), read: (v) => v },
  compact: { name: 'density', write: (v) => (v ? 'compact' : null), read: (v) => (v === 'compact' ? true : v === 'regular' ? false : undefined) },
  solidGlass: { name: 'glass', write: (v) => (v ? 'solid' : null), read: (v) => (v === 'solid' ? true : v === 'regular' ? false : undefined) },
};
const entries = Object.entries(PARAMS) as [keyof AppearancePrefs, (typeof PARAMS)[keyof AppearancePrefs]][];

const toParams = (p: AppearancePrefs): Params =>
  Object.fromEntries(entries.map(([key, param]) => [param.name, (param.write as (v: unknown) => string | null)(p[key])]));

/** The prefs with each valid param from the URL laid over them, and whether the URL changed any. */
function fromUrl(base: AppearancePrefs): [AppearancePrefs, boolean] {
  const next = { ...base } as Record<keyof AppearancePrefs, unknown>;
  let changed = false;
  for (const [key, param] of entries) {
    const raw = readParam(param.name);
    if (raw === null) continue;
    const value = param.read(raw);
    if (value !== undefined && ALLOWED[key](value) && value !== base[key]) { next[key] = value; changed = true; }
  }
  return [next as AppearancePrefs, changed];
}

const save = (p: AppearancePrefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: keep in memory */ } };

/** The stored prefs, with the URL's on top. A link's are remembered, so a layout preview's frame shows them too. */
function initial(): AppearancePrefs {
  const [prefs, changed] = fromUrl(load());
  if (changed) save(prefs);
  return prefs;
}

/** Storage can hold anything, so each field is kept only when it has the right type and an allowed value. */
function load(): AppearancePrefs {
  // The docs' Markdown build renders in Node, which has no window and no stored prefs.
  if (typeof window === 'undefined') return DEFAULTS;
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
  const [prefs, setState] = React.useState<AppearancePrefs>(initial);
  const setPrefs = React.useCallback((p: AppearancePrefs) => {
    setState(p);
    save(p);
  }, []);
  // The URL follows the prefs, on this page and, through the router's root, on the next.
  const current = React.useRef(prefs);
  React.useLayoutEffect(() => { current.current = prefs; writeParams(toParams(prefs)); }, [prefs]);
  React.useLayoutEffect(() => shareSiteWide(() => toParams(current.current)), []);
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
