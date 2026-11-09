// Where focus lands after each action, acted by keyboard on desktop and by touch on a phone: the landing, no frame on
// <body> on the way, and an outcome announced only after the focus move it belongs to. The rows are ACTIONS in
// `tests/focus-table.ts`.
import { test, expect } from '@playwright/test';
import { ACTIONS, driver, each, expectLanding, rowTests, type Part } from './focus-table';
import { expectNoBody, focusMoves, focusSettled, focusTrail, trackFocus } from './focus-trail';
import { heard, listen } from './spoken';

test.beforeEach(async ({ page }) => {
  await trackFocus(page);
  await listen(page);
});

for (const row of ACTIONS) {
  const parts: Part[] = ['target', 'body'];
  if (row.says) parts.push('says');
  if (row.check) parts.push('check');
  rowTests(`${row.screen} · ${row.action}`, parts, row.pending, row.only, async (page, device, check) => {
    const d = driver(page, device);
    if (row.viewport) await page.setViewportSize(each(row.viewport, device));
    await row.setup(d);
    await focusSettled(page, 200);
    await focusTrail(page);
    const before = await page.evaluate(() => performance.now());
    await row.act(d);
    await row.done?.(d);
    // A focus move a frame or two later would otherwise be missed, by rows where focus stays put above all.
    await focusSettled(page, 150);
    if (check.has('target')) {
      if (row.url) await expect(page).toHaveURL(row.url);
      await expectLanding(page, each(row.target, device), row.action, { inView: row.inView ?? false, body: false });
    } else {
      await focusSettled(page);
    }
    if (check.has('body')) expectNoBody(await focusTrail(page));
    // Orders tasks, not statements within one task: see `says` in tests/focus-table.ts.
    if (check.has('says') && row.says) {
      const match = (text: string) => (typeof row.says === 'string' ? text === row.says : row.says!.test(text));
      await expect.poll(async () => (await heard(page)).some((s) => s.t > before && match(s.text)), `“${row.says}” is said`).toBe(true);
      const said = (await heard(page)).find((s) => s.t > before && match(s.text))!;
      const move = (await focusMoves(page)).filter((m) => m.t > before).at(-1);
      expect(!move || said.t >= move.t, `“${said.text}” is said at ${said.t.toFixed(1)}ms, before focus moves to ${move?.focus} at ${move?.t.toFixed(1)}ms`).toBe(true);
    }
    if (check.has('check')) await row.check!(d);
  }, { strictTouch: row.strictTouch });
}
