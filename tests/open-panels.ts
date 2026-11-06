import { expect, type Page } from '@playwright/test';

// A closed Disclosure keeps its body as `hidden="until-found"` and a collapsed table hides its rows, so axe and a
// layout check see neither. This opens every one on the page, a panel revealed inside another included, with motion
// reduced so each opens at once to its full height, then restored for the checks that follow. It returns how many it
// opened.
export async function openPanels(page: Page): Promise<number> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const closed = page.locator('.ld-disc-head[aria-expanded="false"], .ld-table-toggle[aria-expanded="false"]');
  let opened = 0;
  for (let n = await closed.count(); n; n = await closed.count()) {
    opened += n;
    expect(opened, 'panels keep closing as they are opened').toBeLessThan(500);
    // A DOM click reaches a heading in a part of the page the layout hides, such as a phone's closed sidebar.
    await closed.evaluateAll((heads) => heads.forEach((head) => (head as HTMLButtonElement).click()));
  }
  await expect(page.locator('.ld-disc-panel[hidden], .ld-disc-panel[data-starting-style]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: null });
  return opened;
}
