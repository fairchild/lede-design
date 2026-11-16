import { test, expect, type Page } from '@playwright/test';
import { ROUTES, NOT_FOUND } from './routes';

// An agent that reads the accessibility tree picks a control by its role and name inside the region it sits in. Two
// controls of one role with one name in the same region can't be told apart, so an agent presses the wrong one. Lede's
// rule is that each control a person can use is named for what it does to what: "Archive Quarterly review", not a
// bare "Archive" on every row.
const APP = ROUTES.filter((route) => route.startsWith('/app') && !NOT_FOUND.has(route));

/** Every visible, enabled control's role, name and the name of the nearest named landmark or region around it. */
async function controls(page: Page) {
  return page.evaluate(() => {
    const ROLES: Record<string, string> = { A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox' };
    const named = (el: Element) => el.getAttribute('aria-label') ?? (el.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
    const out: { role: string; name: string; region: string }[] = [];
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="radio"], [role="switch"], [role="checkbox"]')) {
      const html = el as HTMLElement;
      if (html.closest('[hidden], [inert], [aria-hidden="true"]') || !html.getClientRects().length || (html as HTMLButtonElement).disabled) continue;
      const role = el.getAttribute('role') ?? (el.tagName === 'INPUT' ? `input:${(el as HTMLInputElement).type}` : ROLES[el.tagName]);
      // The accessible name, approximated: aria-label, aria-labelledby, a <label>, then text.
      const label = (el as HTMLInputElement).labels?.[0]?.textContent?.trim();
      const name = (named(el) || label || html.innerText || html.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      let region = '';
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.matches('main, nav, aside, header, footer, section[aria-label], section[aria-labelledby], form[aria-label], form[aria-labelledby], [role="region"], [role="dialog"], [role="group"][aria-label], [role="group"][aria-labelledby], ul[aria-label], ul[aria-labelledby]')) {
          region = `${p.tagName.toLowerCase()} ${named(p)}`.trim();
          break;
        }
      }
      out.push({ role, name, region });
    }
    return out;
  });
}

for (const route of APP) {
  test(`${route}: no two controls in one region share a role and a name`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const seen = new Map<string, number>();
    for (const { role, name, region } of await controls(page)) {
      const key = `${region} › ${role} "${name}"`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    expect([...seen].filter(([, n]) => n > 1).map(([key, n]) => `${key} ×${n}`)).toEqual([]);
  });
}
