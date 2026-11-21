import type { Page } from '@playwright/test';

/** The appearance prefs a test can ask for, as the docs' Mode control and Daybook's Settings → Appearance name them. */
export interface Prefs { scheme?: 'auto' | 'light' | 'dark'; highContrast?: boolean; accent?: string; shape?: string; compact?: boolean; solidGlass?: boolean }

/** The URL params `src/theme.tsx` reads for each pref. A pref at its default has none. */
export function appearanceParams(prefs: Prefs): Record<string, string> {
  const params: Record<string, string> = {};
  if (prefs.scheme && prefs.scheme !== 'auto') params.scheme = prefs.scheme;
  if (prefs.highContrast) params.contrast = 'high';
  if (prefs.accent && prefs.accent !== 'blue') params.accent = prefs.accent;
  if (prefs.shape && prefs.shape !== 'soft') params.shape = prefs.shape;
  if (prefs.compact) params.density = 'compact';
  if (prefs.solidGlass) params.glass = 'solid';
  return params;
}

/**
 * Opens every page of the test with this appearance. The appearance lives only in the URL, so before the app runs,
 * each document's URL gets the params it doesn't already have, a layout preview's frame included.
 */
export async function withAppearance(page: Page, prefs: Prefs) {
  await page.addInitScript((params) => {
    if (!location.protocol.startsWith('http')) return;
    const url = new URL(location.href);
    for (const [name, value] of Object.entries(params)) if (!url.searchParams.has(name)) url.searchParams.set(name, value);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }, appearanceParams(prefs));
}
