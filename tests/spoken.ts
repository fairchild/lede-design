// What screen readers are told: each text added to a live region or changed in place there, with whether that region
// was already on the page in an earlier change and whether it was rendered. Screen readers announce a change to a
// region that exists and is rendered.
import type { Page } from '@playwright/test';

export type Spoken = { text: string; before: boolean; rendered: boolean };
/** A Spoken entry and when it was said, on the `performance.now()` clock that `tests/focus-trail.ts` uses. */
export type Heard = Spoken & { t: number };

/** Call before the first navigation: it records from the first node on. */
export async function listen(page: Page) {
  await page.addInitScript(() => {
    const said: Heard[] = [];
    (window as unknown as { said: typeof said }).said = said;
    const LIVE = '[aria-live], [role="status"], [role="log"], [role="alert"]';
    const known = new WeakSet<Element>();
    new MutationObserver((records) => {
      const t = performance.now();
      const fresh: Element[] = [];
      for (const r of records) {
        if (r.type === 'characterData') {
          const region = r.target.parentElement?.closest(LIVE);
          if (region && r.target.textContent) said.push({ text: r.target.textContent, before: known.has(region), rendered: region.checkVisibility(), t });
        }
        for (const n of r.addedNodes) {
          const region = n.parentElement?.closest(LIVE);
          if (region && n.textContent) said.push({ text: n.textContent, before: known.has(region), rendered: region.checkVisibility(), t });
          if (n instanceof Element) fresh.push(...(n.matches(LIVE) ? [n] : []), ...n.querySelectorAll(LIVE));
        }
      }
      fresh.forEach((el) => known.add(el));
    }).observe(document, { childList: true, characterData: true, subtree: true });
  });
}

export const spoken = (page: Page): Promise<Spoken[]> =>
  page.evaluate(() => (window as unknown as { said: Heard[] }).said.map(({ text, before, rendered }) => ({ text, before, rendered })));
/** What was said, each with its time. */
export const heard = (page: Page): Promise<Heard[]> => page.evaluate(() => (window as unknown as { said: Heard[] }).said);
