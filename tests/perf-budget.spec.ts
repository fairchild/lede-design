import { test, expect, type Page } from '@playwright/test';

// Proposal test-plan item 7: a performance budget that fails on a regression. Absolute times depend on the machine,
// so the budget is a ratio: DataTable against a plain React <table> with the same 500 rows, cells, checkbox, link and
// button, measured alternately in the same browser. The medians of BUDGET.runs runs must stay under the ratios.
// 21 runs, and the `perf` project runs this file alone (playwright.config.ts).
const BUDGET = { runs: 21, mount: 2.5, sort: 1.3 };
// Measured on the build that set the budget (median ratios, Chromium): mount 1.55–1.9, of which a Base UI
// Menu.Trigger per row is about a third; sort 0.75–1.05 (rows are memoised, so a sort moves them without
// re-rendering). Mount was 2.2 at first: the ratio itself varies by machine, not only with load (alone on a quiet
// machine 1.35–1.8; under CPU load up to 2.0; on a reviewer's machine 1.98–2.45), and 2.2 failed on CI and locally
// on code no slower than main. 2.5 covers every reading seen, so it fails only a large regression: about 40% or
// more over today's mount on a quiet machine. Smaller ones (a second per-row trigger would be about a third) can pass;
// watch the logged ratios for drift. Sort stays 1.3.

test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function measure(page: Page, impl: 'Plain table' | 'DataTable') {
  return page.evaluate(async (name) => {
    const frames = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const until = async (fn: () => boolean) => { while (!fn()) await new Promise((r) => requestAnimationFrame(r)); };
    const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === label)!;
    const rows = () => document.querySelector('table')?.tBodies[0]?.rows ?? null;
    button('Clear').click();
    await until(() => !document.querySelector('table'));
    await frames();
    let t = performance.now();
    button(name).click();
    await until(() => rows()?.length === 500);
    await frames();
    const mount = performance.now() - t;
    const first = rows()![0].dataset.rowId;
    t = performance.now();
    button('Sort by title').click();
    await until(() => rows()![0].dataset.rowId !== first);
    await frames();
    return { mount, sort: performance.now() - t };
  }, impl);
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

test('DataTable stays within its budget against a plain table (500 rows)', async ({ page }) => {
  await page.goto('/fixtures/data-table-perf');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await measure(page, 'Plain table'); // warm up both paths (code, styles, fonts)
  await measure(page, 'DataTable');
  const ratio = { mount: [] as number[], sort: [] as number[] };
  for (let i = 0; i < BUDGET.runs; i++) {
    const plain = await measure(page, 'Plain table');
    const lede = await measure(page, 'DataTable');
    ratio.mount.push(lede.mount / plain.mount);
    ratio.sort.push(lede.sort / plain.sort);
  }
  const result = { mount: median(ratio.mount), sort: median(ratio.sort) };
  test.info().annotations.push({ type: 'ratios', description: JSON.stringify(result) });
  console.log('DataTable / plain table, median ratios:', result);
  expect(result.mount).toBeLessThan(BUDGET.mount);
  expect(result.sort).toBeLessThan(BUDGET.sort);
});

// A first press right after mount must work with real input. (Mounting row triggers late was tried for speed and
// reverted: swapping the button under a mouse press or a touch tap lost the click, and on touch, focus.)
for (const input of ['mouse', 'touch'] as const) {
  test(`row actions: the first ${input} press right after mount opens the menu`, async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: input === 'touch', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/fixtures/data-table-perf');
    await page.getByRole('button', { name: 'DataTable', exact: true }).click();
    const more = page.getByRole('button', { name: 'More actions for WI-1003' });
    const box = (await more.boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (input === 'touch') await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await expect(page.getByRole('menu', { name: 'More actions for WI-1003' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    await ctx.close();
  });
}
