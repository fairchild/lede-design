import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { cn } from './cn';

export const presets = ['blue', 'indigo', 'teal', 'green', 'orange', 'pink', 'graphite'] as const;
export type Preset = (typeof presets)[number];

export interface ThemeProviderProps extends useRender.ComponentProps<'div'> {
  /**
   * Unset inherits the nearest provider's, and is `'auto'` at the root. `'auto'` follows `prefers-color-scheme`.
   * `'inherit'` copies the nearest provider's, or the nearest `[data-theme]` ancestor's when no provider is above.
   */
  scheme?: 'auto' | 'inherit' | 'light' | 'dark';
  /**
   * Unset inherits the nearest provider's, and is `'auto'` at the root. `'auto'` follows `prefers-contrast: more`, and
   * `'high'` selects the `-hc` theme. `'inherit'` copies the nearest provider's, or the nearest `[data-theme]`
   * ancestor's when no provider is above.
   */
  contrast?: 'auto' | 'inherit' | 'standard' | 'high';
  /** A preset name, or any hex color, for which `--primary-foreground` is picked for you. Unset inherits the nearest provider's. */
  accent?: Preset | (string & {});
  /** Text color on primary fills, for a custom accent when the automatic pick is wrong. Inherited along with `accent`. */
  accentForeground?: string;
  /** Corners, from roundest to squarest. `square` has no capsules. Unset inherits the nearest provider's, or `:root`'s. */
  shape?: 'soft' | 'crisp' | 'square';
  /**
   * Control heights, for buttons, fields and table hit targets. `'touch'` is for screens used with a finger: no control is
   * shorter than `--size-hit-min`, 44px. List rows and bar items keep `--size-hit-min` in every density.
   * Unset inherits the nearest provider's, or `:root`'s.
   */
  density?: 'regular' | 'compact' | 'touch';
  /** Glass material. Default `'regular'`. Under `prefers-reduced-transparency`, glass draws as `solid`. */
  glass?: 'regular' | 'solid';
  /** The wrapper's background. Default `'none'`. */
  surface?: 'none' | 'base' | 'grouped';
  /** Token values by name, such as `{ radius: '18px' }`, set on the wrapper and carried into its portals. */
  tokens?: Record<string, string>;
}

function hexToRgb(c: string): number[] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}
function luminance([r, g, b]: number[]) {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** White or near-black (`#06111f`), whichever contrasts more with the given hex color. */
export function pickOnColor(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const L = luminance(rgb);
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0555 ? '#ffffff' : '#06111f';
}

function useMedia(query: string) {
  const [match, setMatch] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );
  React.useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

function accentVars(accent?: string, foreground?: string) {
  const vars: Record<string, string> = {};
  if (accent && (presets as readonly string[]).includes(accent)) vars['--primary'] = `var(--preset-${accent})`;
  else if (accent) {
    vars['--primary'] = accent;
    const on = foreground ?? pickOnColor(accent);
    if (on) vars['--primary-foreground'] = on;
  }
  if (foreground) vars['--primary-foreground'] = foreground;
  return vars;
}

interface Scope {
  /** The theme on a ThemeProvider's wrapper, without what paints or sizes that wrapper. */
  props: {
    className: string; 'data-theme': string; 'data-glass': string; 'data-shape'?: string; 'data-density'?: string;
    style: React.CSSProperties;
  };
  accent?: string;
  accentForeground?: string;
  parent: Scope | null;
}

const ScopeContext = React.createContext<Scope | null>(null);

/**
 * Gives portalled content the theme of its nearest ThemeProvider. Place it directly inside any portal:
 * `<Dialog.Portal><ThemeScope><Dialog.Popup /></ThemeScope></Dialog.Portal>`.
 *
 * It renders the same scope as each provider above it, one element per provider, so the page's cascade applies
 * unchanged: `[data-theme]` blocks reset colors, an unset shape or density inherits and ancestor selectors match. A
 * provider's `surface`, `className`, `style` and other DOM props stay on its wrapper; theme values reach a portal
 * through props such as `accent` and `tokens`.
 */
export function ThemeScope({ children }: { children?: React.ReactNode }) {
  const nearest = React.useContext(ScopeContext);
  let content = children;
  for (let scope = nearest; scope; scope = scope.parent) content = <div {...scope.props}>{content}</div>;
  return content;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const nearest = React.useContext(ScopeContext);
  const unset = nearest ? 'inherit' : 'auto';
  const {
    render, scheme = unset, contrast = unset, accent, accentForeground, shape, density,
    glass = 'regular', surface = 'none', tokens, className, style, ...rest
  } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const [outer, setOuter] = React.useState('light');
  React.useLayoutEffect(() => {
    if (nearest || (scheme !== 'inherit' && contrast !== 'inherit')) return;
    const el = ref.current?.parentElement?.closest('[data-theme]');
    const id = el?.getAttribute('data-theme') ?? 'light';
    if (id !== outer) setOuter(id);
  });
  const parentTheme = nearest?.props['data-theme'] ?? outer;
  const prefersDark = useMedia('(prefers-color-scheme: dark)');
  const prefersMore = useMedia('(prefers-contrast: more)');
  const dark = scheme === 'auto' ? prefersDark : scheme === 'inherit' ? parentTheme.startsWith('dark') : scheme === 'dark';
  const high = contrast === 'auto' ? prefersMore : contrast === 'inherit' ? parentTheme.endsWith('-hc') : contrast === 'high';
  const theme = (dark ? 'dark' : 'light') + (high ? '-hc' : '');

  const foreground = accentForeground;
  const brand = accent
    ? { accent, accentForeground: foreground }
    : { accent: nearest?.accent, accentForeground: foreground ?? nearest?.accentForeground };
  const vars = accentVars(brand.accent, brand.accentForeground);
  if (tokens) for (const [k, v] of Object.entries(tokens)) vars[`--${k.replace(/^--/, '')}`] = v;

  const scope: Scope = {
    props: {
      className: cn('ld-theme', dark && 'dark'), 'data-theme': theme, 'data-glass': glass, 'data-shape': shape, 'data-density': density,
      style: vars as React.CSSProperties,
    },
    ...brand,
    parent: nearest,
  };
  const wrapper = useRender({
    defaultTagName: 'div',
    render,
    ref,
    props: mergeProps<'div'>(
      {
        ...scope.props,
        className: cn(scope.props.className, className as string),
        'data-surface': surface,
        style: { ...scope.props.style, ...(style as React.CSSProperties) },
      } as React.HTMLAttributes<HTMLDivElement>,
      rest,
    ),
  });
  return <ScopeContext.Provider value={scope}>{wrapper}</ScopeContext.Provider>;
}
