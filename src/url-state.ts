import * as React from 'react';

/**
 * View state in the address, so a link opens the screen its sender sees: the look, the appearance, a page's chosen tab.
 * A value at its default stays out of the URL, so a plain link stays plain.
 *
 * Writes replace the current history entry with `history.replaceState`, keeping React Router's state, so a change of
 * view adds no Back step and doesn't count as a navigation: no scroll, no focus move. The router's own `location.search`
 * doesn't see these params, so read them here, with `readParam` or `useUrlParam`.
 *
 * Two kinds of state:
 * - Site-wide state, such as the look, follows the reader from page to page. Its owner registers it with
 *   `shareSiteWide`, and `useSiteWideParams` in the router's root writes it again after every navigation.
 * - A page's own state, such as Overview's example, uses `useUrlParam` and lives only in that page's URL. Back to the
 *   page brings it back, since its history entry kept it.
 */

export type Params = Record<string, string | null>;

export function readParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Sets each param, or removes it where the value is `null`. The hash and the router's history state stay. */
export function writeParams(params: Params) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(params)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

const siteWide = new Set<() => Params>();

/** Registers site-wide state, written now and again after each navigation. Returns the unregister. */
export function shareSiteWide(read: () => Params) {
  siteWide.add(read);
  writeParams(read());
  return () => { siteWide.delete(read); };
}

/** In the router's root: a navigation builds a new URL, so the site-wide params go back on it. */
export function useSiteWideParams(location: unknown) {
  React.useLayoutEffect(() => { siteWide.forEach((read) => writeParams(read())); }, [location]);
}

/**
 * A page's own choice, kept in `?name=`. An unknown value in the URL reads as `fallback`, and choosing `fallback`
 * removes the param. `initial` is where the value comes from when the URL has none, such as what the reader left.
 */
export function useUrlParam<T extends string>(name: string, values: readonly T[], fallback: T, initial: T = fallback): [T, (value: T) => void] {
  const [value, setValue] = React.useState<T>(() => {
    const fromUrl = readParam(name);
    return values.includes(fromUrl as T) ? (fromUrl as T) : initial;
  });
  const set = React.useCallback((next: T) => {
    setValue(next);
    writeParams({ [name]: next === fallback ? null : next });
  }, [name, fallback]);
  return [value, set];
}
