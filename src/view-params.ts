import * as React from 'react';
import { useLocation, useNavigate, useSearchParams, type NavigateOptions } from 'react-router';

/**
 * View state lives in the URL's query and nowhere else, so a link opens the screen its sender sees. React Router is
 * the only writer: a view change replaces the entry with `setSearchParams` (no Back step, no scroll, and rendered at
 * once, so a controlled control never shows its old value), and a navigation pushes as usual. A value at its default
 * stays out, and an unknown value reads as the default.
 *
 * The site-wide params, the look and the appearance, follow the reader from page to page: `RouterLink` and the site's
 * `navigate` calls put them on every in-app href with `withSiteParams`. A page's own choice, `useViewParam`, stays on
 * its page. Their names are the theme axes' names, and stay as they are.
 */
export const SITE_PARAMS = ['look', 'scheme', 'contrast', 'accent', 'shape', 'density', 'glass'] as const;

/**
 * An in-app href with the site-wide params of `current` (a query string), which win over any the href names: they are
 * the reader's view now. Its path, its own params and its hash stay as they are.
 */
export function withSiteParams(href: string, current: string): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const rest = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = rest.indexOf('?');
  const path = queryAt < 0 ? rest : rest.slice(0, queryAt);
  const params = new URLSearchParams(queryAt < 0 ? '' : rest.slice(queryAt));
  const now = new URLSearchParams(current);
  for (const name of SITE_PARAMS) {
    const value = now.get(name);
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ''}${hash}`;
}

/** `withSiteParams` against the current location. */
export function useSiteHref() {
  const { search } = useLocation();
  return React.useCallback((href: string) => withSiteParams(href, search), [search]);
}

/** Replaces this entry's params: `null` or a default removes one. For a view change, not a navigation. */
export function useSetViewParams() {
  const [, setParams] = useSearchParams();
  return React.useCallback((next: Record<string, string | null>) => setParams((prev) => {
    const params = new URLSearchParams(prev);
    for (const [name, value] of Object.entries(next)) {
      if (value === null) params.delete(name);
      else params.set(name, value);
    }
    return params;
  }, { replace: true, preventScrollReset: true, flushSync: true }), [setParams]);
}

/** One of `values` read from `?name=`, or `fallback`. */
export function readView<T extends string>(params: URLSearchParams, name: string, values: readonly T[], fallback: T): T {
  const raw = params.get(name);
  return values.includes(raw as T) ? (raw as T) : fallback;
}

/** A page's own choice in `?name=`, such as Overview's example. Choosing `fallback` removes the param. */
export function useViewParam<T extends string>(name: string, values: readonly T[], fallback: T): [T, (value: T) => void] {
  const [params] = useSearchParams();
  const set = useSetViewParams();
  return [readView(params, name, values, fallback), React.useCallback((v: T) => set({ [name]: v === fallback ? null : v }), [set, name, fallback])];
}

/** `useNavigate` for an in-app path, carrying the look and the appearance as `RouterLink` does. */
export function useSiteNavigate() {
  const navigate = useNavigate();
  const site = useSiteHref();
  return React.useCallback((to: string, options?: NavigateOptions) => navigate(site(to), options), [navigate, site]);
}
