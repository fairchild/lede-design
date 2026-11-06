import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { allWorkItems, applyView, bigWorkItems, createWorkServer } from '../src/data/work-items';

const DEFAULT_SORT = { sort: [{ columnId: 'due', direction: 'ascending' as const }] };
const ALWAYS = 'WI-1025';
const ALWAYS_TITLE = 'Close out the Q3 vendor audit';
const ONCE = 'WI-1026';
const ONCE_TITLE = 'Send the September freelancer invoices';
const ROW_1 = applyView(allWorkItems, DEFAULT_SORT)[0].id;
const ROW_3 = applyView(allWorkItems, DEFAULT_SORT)[2].id;
const LOCKED = applyView(allWorkItems, DEFAULT_SORT).slice(0, 50).find((w) => w.locked)!.id;
const PLAIN = applyView(allWorkItems, DEFAULT_SORT).slice(0, 50).find((w) => !w.locked && !w.archiveFails)!.id;

const row = (page: Page, id: string) => page.locator(`[data-row-id="${id}"]`);
const alert = (page: Page) => page.getByRole('alert');
const tryAgain = (page: Page) => page.getByRole('button', { name: 'Try again' });
const bar = (page: Page) => page.getByRole('toolbar', { name: /selected/ });
const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Work' });
const float = (page: Page) => page.locator('.docs-float');
const message = (page: Page) => float(page).locator('.ld-dt-error');
const dismiss = (page: Page) => page.getByRole('button', { name: 'Dismiss' });

async function open(page: Page) {
  await page.goto('/app/work');
  await expect(row(page, ALWAYS)).toBeVisible();
}
/** By keyboard: a click that Playwright retries can scroll the page first, and these tests measure the page. */
async function archive(page: Page, id: string) {
  await row(page, id).getByRole('button', { name: `More actions for ${id}` }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeFocused();
  await page.keyboard.press('Enter');
}

test('the first page is the hand-written items, each title once, with the two refusals at rows 5 and 6', () => {
  const page = applyView(allWorkItems, DEFAULT_SORT).slice(0, 50);
  expect(new Set(page.map((w) => w.title)).size).toBe(50);
  const [fifth, sixth] = page.slice(4, 6);
  expect(fifth).toMatchObject({ id: ALWAYS, title: ALWAYS_TITLE, archiveFails: 'always' });
  expect(sixth).toMatchObject({ id: ONCE, title: ONCE_TITLE, archiveFails: 'once' });
  expect(fifth.locked || sixth.locked).toBeFalsy();
  expect(allWorkItems.filter((w) => w.archiveFails).map((w) => w.id).sort()).toEqual([ALWAYS, ONCE]);
});

test('later items are recurring work on working days, and no page of 50 repeats a title, by due date or ID', () => {
  // The hand-written items are one-off tasks: each appears once, even among the 500.
  const once = allWorkItems.slice(0, 50).map((w) => w.title);
  expect(once.filter((title) => bigWorkItems.filter((w) => w.title === title).length !== 1)).toEqual([]);
  const weekend = (w: { due: string }) => [0, 6].includes(new Date(`${w.due}T00:00:00Z`).getUTCDay());
  expect(bigWorkItems.slice(50).filter((w) => weekend(w) || ['2026-12-25', '2027-01-01'].includes(w.due)).map((w) => `${w.id} ${w.due}`)).toEqual([]);
  for (const items of [allWorkItems, bigWorkItems]) {
    for (const columnId of ['due', 'id']) for (const direction of ['ascending', 'descending'] as const) {
      const rows = applyView(items, { sort: [{ columnId, direction }] });
      for (let at = 0; at < rows.length; at += 50) {
        const titles = rows.slice(at, at + 50).map((w) => w.title);
        expect(new Set(titles).size, `${items.length} items by ${columnId}, ${direction}: page ${at / 50 + 1}`).toBe(titles.length);
      }
    }
  }
});

test('the fake server archives like a POST: later, logged, and saying what failed and why', async () => {
  const server = createWorkServer({ latency: 1 });
  const refused = server.archive((id) => id === ALWAYS);
  expect(server.getLog()[0]).toMatchObject({ text: `Archive ${ALWAYS}`, status: 'pending' });
  expect(await refused).toEqual({
    archived: [], locked: [],
    failed: [{ id: ALWAYS, title: ALWAYS_TITLE, reason: 'This item is linked to an open approval.', next: 'Close the approval, then try again.' }],
  });
  expect(server.getLog()[0].status).toBe('failed');

  expect((await server.archive((id) => id === ONCE)).failed.map((f) => f.id)).toEqual([ONCE]);
  expect(server.get(ONCE)?.archiveFails).toBeUndefined();
  expect(await server.archive((id) => id === ONCE)).toEqual({ archived: [ONCE], locked: [], failed: [] });
  expect(server.getLog()[0].status).toBe('done');
  expect(server.get(ONCE)).toBeUndefined();

  expect(await server.archive((id) => id === LOCKED)).toEqual({ archived: [], locked: [LOCKED], failed: [] });
  expect(server.get(LOCKED)).toBeDefined();
});

test('row 5 stays where it is after a failed archive, and the alert says which, why and what to do', async ({ page }) => {
  await open(page);
  // Where the row sits on the page. Below the tab bar's breakpoint, focus returning to its ••• from the menu scrolls the
  // page to clear the tab bar, so the row is placed on the page rather than in the window.
  const place = () => row(page, ALWAYS).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; });
  const before = await place();
  // In flight for a moment only, so the row is watched rather than polled. A wider status would rewrap a card and move the rows below.
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-row-id="${id}"]`)!;
    const { height } = el.getBoundingClientRect();
    new MutationObserver(() => {
      if (el.querySelector('.docs-status-working')) document.body.dataset.sawWorking = 'yes';
      if (el.getBoundingClientRect().height !== height) document.body.dataset.rowResized = 'yes';
    }).observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
  }, ALWAYS);
  await archive(page, ALWAYS);
  await expect(alert(page).locator('strong')).toHaveText(`Couldn’t archive ${ALWAYS}.`);
  await expect(alert(page)).toContainText(`${ALWAYS_TITLE}: This item is linked to an open approval. Close the approval, then try again.`);
  await expect(page.locator('body')).not.toHaveAttribute('data-row-resized', 'yes');
  await expect(page.locator('body')).toHaveAttribute('data-saw-working', 'yes');
  expect(await place()).toEqual(before);
  await expect(row(page, ALWAYS).getByRole('button', { name: `More actions for ${ALWAYS}` })).toBeFocused();

  // Each failed try puts a new alert in the page, so it's announced even when its words repeat.
  await tryAgain(page).focus();
  await page.keyboard.press('Enter');
  await expect(alert(page).locator('strong')).toHaveText(`Still couldn’t archive ${ALWAYS}.`);
  await expect(tryAgain(page)).toBeFocused();
  expect(await place()).toEqual(before);
  const second = (await alert(page).elementHandle())!;
  await page.keyboard.press('Enter');
  await expect.poll(() => second.evaluate((el) => el.isConnected)).toBe(false);
  await expect(alert(page).locator('strong')).toHaveText(`Still couldn’t archive ${ALWAYS}.`);
  await expect(tryAgain(page)).toBeFocused();

  await dismiss(page).click();
  await expect(alert(page)).toHaveCount(0);
  await expect(heading(page)).toBeFocused();
  await expect(row(page, ALWAYS)).toBeVisible();
});

test('row 6 fails once and archives on the retry', async ({ page }) => {
  await open(page);
  await archive(page, ONCE);
  await expect(alert(page).locator('strong')).toHaveText(`Couldn’t archive ${ONCE}.`);
  await expect(row(page, ONCE)).toBeVisible();
  await tryAgain(page).click();
  await expect(page.getByRole('status').filter({ hasText: `Archived ${ONCE}.` })).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
  await expect(row(page, ONCE)).toHaveCount(0);
  await expect(page.locator('.ld-dt-summary')).toContainText('of 309 work items');
  await expect(heading(page)).toBeFocused();
});

test('a bulk archive states both numbers, names the failures, and keeps only those selected for Try again', async ({ page }) => {
  await open(page);
  for (const id of [ROW_1, ALWAYS, ONCE, LOCKED]) await row(page, id).getByRole('checkbox').check();
  await bar(page).getByRole('button', { name: 'Archive' }).click();
  await expect(alert(page).locator('strong')).toHaveText('Archived ' + ROW_1 + '. Couldn’t archive 2 work items. 1 locked item was kept.');
  // In screen order, row 5 before row 6.
  await expect(alert(page).locator('li')).toHaveText([new RegExp(`^${ALWAYS}, ${ALWAYS_TITLE}`), new RegExp(`^${ONCE}, ${ONCE_TITLE}`)]);
  await expect(row(page, ROW_1)).toHaveCount(0);
  await expect(bar(page)).toHaveAccessibleName('2 work items selected');
  await expect(row(page, ALWAYS).getByRole('checkbox')).toBeChecked();
  await expect(row(page, ONCE).getByRole('checkbox')).toBeChecked();
  await expect(row(page, LOCKED).getByRole('checkbox')).not.toBeChecked();
  await expect(bar(page).getByRole('button', { name: 'Archive' })).toBeFocused();

  await tryAgain(page).click();
  await expect(alert(page).locator('strong')).toHaveText(`Archived ${ONCE}. Still couldn’t archive ${ALWAYS}.`);
  await expect(row(page, ONCE)).toHaveCount(0);
  await expect(bar(page)).toHaveAccessibleName('1 work item selected');
  await expect(row(page, ALWAYS).getByRole('checkbox')).toBeChecked();
  await expect(page.locator('.ld-dt-summary')).toContainText('of 308 work items');
});

test('a bulk answer leaves selection changes made in flight', async ({ page }) => {
  await open(page);
  for (const id of [ROW_1, ALWAYS]) await row(page, id).getByRole('checkbox').check();
  // In one task, so the second click is certain to land while the request is out.
  const archiveThen = (name: string) => bar(page).getByRole('button', { name: 'Archive' }).evaluate((b: HTMLElement, target) => {
    b.click();
    (document.querySelector(target) as HTMLElement).click();
  }, name);
  await archiveThen(`[data-row-id="${ROW_3}"] input[type="checkbox"]`);
  await expect(alert(page).locator('strong')).toHaveText(`Archived ${ROW_1}. Couldn’t archive ${ALWAYS}.`);
  await expect(bar(page)).toHaveAccessibleName('2 work items selected');
  await expect(row(page, ROW_3).getByRole('checkbox')).toBeChecked();
  await expect(row(page, ALWAYS).getByRole('checkbox')).toBeChecked();

  // Done in flight stays done: the failed row isn't selected again behind the person's back.
  await bar(page).getByRole('button', { name: 'Archive' }).evaluate((b: HTMLElement) => {
    b.click();
    ([...b.parentElement!.querySelectorAll('button')].find((x) => x.textContent === 'Done') as HTMLElement).click();
  });
  await expect(alert(page).locator('strong')).toContainText(`Still couldn’t archive ${ALWAYS}.`);
  await expect(bar(page)).toHaveCount(0);
});

test('a request that fails outright frees its rows, says so, and Try again sends it again', async ({ page }) => {
  const failNext = () => page.getByRole('button', { name: 'Fail the next request' }).click();
  await page.goto('/fixtures/work-archive');
  await expect(row(page, ROW_1)).toBeVisible();
  await failNext();
  await archive(page, ROW_1);
  await expect(alert(page).locator('strong')).toHaveText(`Couldn’t archive ${ROW_1}. The server didn’t answer in time. Try again.`);
  await expect(page.locator('.docs-status-working')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Archiving' })).toHaveCount(0);
  await tryAgain(page).click();
  await expect(page.getByRole('status').filter({ hasText: `Archived ${ROW_1}.` })).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
  // A rows request can use up the failure too, so the reload has to finish first.
  await expect(page.locator('.ld-dt-summary')).toContainText('of 309 work items');

  // An all-matching selection stays what it was, because nothing is known about its items.
  await page.getByRole('checkbox', { name: /^Select all/ }).check();
  await page.getByRole('button', { name: /^Select all \d+ work items$/ }).click();
  await failNext();
  await bar(page).getByRole('button', { name: 'Archive' }).click();
  await expect(alert(page).locator('strong')).toHaveText('Couldn’t archive the selected work items. The server didn’t answer in time. Try again.');
  await expect(bar(page)).toHaveAccessibleName(/^\d{3} work items selected$/);
  await tryAgain(page).click();
  await expect(alert(page).locator('strong')).toContainText('Couldn’t archive 2 work items.');
  await expect(bar(page)).toHaveAccessibleName('2 work items selected');
});

test('a double click sends the archive once', async ({ page }) => {
  await open(page);
  await row(page, ONCE).getByRole('checkbox').check();
  await bar(page).getByRole('button', { name: 'Archive' }).dblclick();
  // A second request would have found the flag cleared and archived the row.
  await expect(alert(page).locator('strong')).toHaveText(`Couldn’t archive ${ONCE}.`);
  await page.waitForTimeout(500);
  await expect(row(page, ONCE)).toBeVisible();
  await expect(page.locator('.ld-dt-summary')).toContainText('of 310 work items');
});

test('with nothing focused, a failure hands focus to the heading', async ({ page }) => {
  await open(page);
  await row(page, ALWAYS).getByRole('checkbox').check();
  await bar(page).getByRole('button', { name: 'Archive' }).evaluate((b: HTMLElement) => {
    b.click();
    (document.activeElement as HTMLElement).blur();
  });
  await expect(alert(page)).toBeVisible();
  await expect(heading(page)).toBeFocused();
});

test('a failed row leaving the page later does not take focus from whatever has it', async ({ page }) => {
  await open(page);
  await archive(page, ALWAYS);
  await expect(alert(page)).toBeVisible();
  const pager = page.getByRole('navigation', { name: 'Pages of work items' });
  await pager.getByRole('button', { name: 'Next' }).focus();
  await page.keyboard.press('Enter');
  await expect(row(page, ALWAYS)).toHaveCount(0);
  // Paging put it on the new page's summary line.
  await expect(page.locator('.ld-dt-summary')).toBeFocused();
});

test('tabbing up the page under the message keeps focus in sight', async ({ page }) => {
  await open(page);
  for (const id of [ALWAYS, ONCE]) await row(page, id).getByRole('checkbox').check();
  await bar(page).getByRole('button', { name: 'Archive' }).click();
  await expect(alert(page)).toBeVisible();
  const card = (await message(page).boundingBox())!;
  await row(page, applyView(allWorkItems, DEFAULT_SORT)[34].id).getByRole('checkbox').focus();
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('Shift+Tab');
    const bottom = await page.evaluate(() => document.activeElement!.getBoundingClientRect().bottom);
    expect(bottom).toBeGreaterThan(card.y + card.height);
  }
});

test('on a phone the message steps aside for the controls it covers at the top of the page', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The card layout has controls above its rows.');
  await open(page);
  for (const id of [ALWAYS, ONCE]) await row(page, id).getByRole('checkbox').check();
  await bar(page).getByRole('button', { name: 'Archive' }).click();
  await expect(message(page)).toBeVisible();
  await dismiss(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: /^Select all/ })).toBeFocused();
  await expect(float(page)).toHaveCSS('opacity', '0');
  // It's only faded, so Shift+Tab reaches it, and it's back as soon as it has focus.
  await page.keyboard.press('Shift+Tab');
  await expect(dismiss(page)).toBeFocused();
  await expect(float(page)).toHaveCSS('opacity', '1');
});

test('on desktop the message stays up for the controls above the table, and Shift+Tab reaches it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Table layout.');
  await open(page);
  await archive(page, ALWAYS);
  await expect(alert(page)).toBeVisible();
  await page.getByRole('checkbox', { name: /^Select all/ }).check();
  await dismiss(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Select all 310 work items' })).toBeFocused();
  await expect(float(page)).toHaveCSS('opacity', '1');
  await page.keyboard.press('Shift+Tab');
  await expect(dismiss(page)).toBeFocused();
});

test('tabbing to the message from far down the page moves nothing', async ({ page }) => {
  await open(page);
  await archive(page, ALWAYS);
  await expect(alert(page)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 900));
  const scrolled = await page.evaluate(() => window.scrollY);
  await tryAgain(page).focus();
  await page.keyboard.press('Tab');
  await expect(dismiss(page)).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test('loading the page leaves focus with a parent that embeds it', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    document.body.innerHTML = '<input id="mine"><iframe id="work" style="width: 900px; height: 600px"></iframe>';
    document.getElementById('mine')!.focus();
    (document.getElementById('work') as HTMLIFrameElement).src = '/app/work';
  });
  await expect(page.frameLocator('#work').locator(`[data-row-id="${ALWAYS}"]`)).toBeVisible();
  await expect(page.locator('#mine')).toBeFocused();
});

test('the message moves the page only to uncover the failed row', async ({ page }) => {
  await open(page);
  await page.evaluate((id) => window.scrollBy(0, document.querySelector(`[data-row-id="${id}"]`)!.getBoundingClientRect().top - 60), ALWAYS);
  await archive(page, ALWAYS);
  await expect(alert(page)).toBeVisible();
  const card = (await message(page).boundingBox())!;
  const { y } = (await row(page, ALWAYS).boundingBox())!;
  expect(y).toBeGreaterThanOrEqual(Math.floor(card.y + card.height));
});

test('after a bulk failure the topmost failed row comes clear of the message', async ({ page }) => {
  await open(page);
  for (const id of [ALWAYS, ONCE]) await row(page, id).getByRole('checkbox').check();
  await page.evaluate((id) => window.scrollBy(0, document.querySelector(`[data-row-id="${id}"]`)!.getBoundingClientRect().top - 60), ALWAYS);
  await bar(page).getByRole('button', { name: 'Archive' }).evaluate((b: HTMLElement) => b.click());
  await expect(alert(page)).toBeVisible();
  const card = (await message(page).boundingBox())!;
  const { y } = (await row(page, ALWAYS).boundingBox())!;
  expect(y).toBeGreaterThanOrEqual(Math.floor(card.y + card.height));
});

test('the item page archives too, says why when it can’t, and returns to the list when it has', async ({ page }) => {
  const archiveButton = page.getByRole('main').getByRole('button', { name: 'Archive' });
  await page.goto(`/app/work/${ALWAYS}`);
  await archiveButton.click();
  await expect(alert(page)).toHaveText(`Couldn’t archive ${ALWAYS}. This item is linked to an open approval. Close the approval, then try again.`);

  // Screen readers announce a change to a live region, so the list's status region must mount empty.
  await page.addInitScript(() => {
    new MutationObserver((records) => {
      for (const node of records.flatMap((r) => [...r.addedNodes])) {
        const region = node instanceof Element ? (node.matches('.docs-notice') ? node : node.querySelector('.docs-notice')) : null;
        if (region && !('noticeAtMount' in window)) Object.assign(window, { noticeAtMount: region.textContent });
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`/app/work/${ONCE}`);
  await archiveButton.click();
  await expect(alert(page)).toContainText('The server couldn’t save this item in time.');
  // The alert keeps the standard gap from the facts below it.
  const gap = await page.locator('.docs-facts').evaluate((el) => el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(16);
  await tryAgain(page).click();
  await expect(page).toHaveURL(/\/app\/work$/);
  await expect(page.getByRole('status').filter({ hasText: `Archived ${ONCE}.` })).toBeVisible();
  expect(await page.evaluate(() => (window as { noticeAtMount?: string }).noticeAtMount)).toBe('');
  await expect(row(page, ROW_1)).toBeVisible();
  await expect(row(page, ONCE)).toHaveCount(0);

  // A locked item has no Archive, and says why.
  await page.goto(`/app/work/${LOCKED}`);
  await expect(page.locator('.docs-facts')).toContainText('Can’t be archived');
  await expect(archiveButton).toHaveCount(0);
});

test('leaving the item page while it archives keeps you where you went, and the archive still completes', async ({ page }) => {
  await page.goto(`/app/work/${PLAIN}`);
  await page.getByRole('main').getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  // The fake server answers after 350ms; well past that, the answer mustn't take the page back to Work.
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/\/app\/settings$/);
  await page.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(row(page, ROW_1 === PLAIN ? ROW_3 : ROW_1)).toBeVisible();
  await expect(row(page, PLAIN)).toHaveCount(0);
});

test('an archive answered after Work is left still reaches the store, so a reload keeps it archived', async ({ page }) => {
  await open(page);
  await archive(page, PLAIN);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await page.waitForTimeout(1000);
  await page.reload();
  await page.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(row(page, ROW_1 === PLAIN ? ROW_3 : ROW_1)).toBeVisible();
  await expect(row(page, PLAIN)).toHaveCount(0);
});

test('an archive whose reload fails still reaches the store, so the bar leaves and the archive is said', async ({ page }) => {
  await page.goto('/fixtures/work-archive');
  await expect(row(page, ROW_1)).toBeVisible();
  // Arms the failure as the archive's answer comes, so the reload that follows it fails.
  await page.evaluate(() => {
    const fail = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Fail the next request')!;
    let seen = false;
    const watch = new MutationObserver(() => {
      if (document.querySelector('.docs-status-working')) seen = true;
      else if (seen) { watch.disconnect(); fail.click(); }
    });
    watch.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await row(page, ROW_1).getByRole('checkbox').check();
  await bar(page).getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText(/^Showing saved data/)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: `Archived ${ROW_1}.` })).toBeVisible();
});

test('an item archived from its own page is said once, so a later page keeps the last archive’s words', async ({ page }) => {
  await open(page);
  await page.getByRole('link', { name: new RegExp(`\\b${PLAIN}\\b`) }).click();
  await page.getByRole('main').getByRole('button', { name: 'Archive' }).click();
  await expect(page).toHaveURL(/\/app\/work$/);
  await expect(page.locator('.docs-notice')).toHaveText(`Archived ${PLAIN}.`);
  await archive(page, ROW_3);
  await expect(row(page, ROW_3)).toHaveCount(0);
  await expect(page.locator('.docs-notice')).toHaveText(`Archived ${ROW_3}.`);
  const next = page.getByRole('navigation', { name: 'Pages of work items' }).getByRole('button', { name: 'Next' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(row(page, 'WI-1042')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(page.locator('.docs-notice')).toHaveText(`Archived ${ROW_3}.`);
});

test('in forced colours the working row and the message keep their shape', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page);
  await archive(page, ALWAYS);
  const ring = page.locator('.docs-status-working .ld-status-dot');
  await expect(ring).toHaveCSS('border-top-style', 'solid');
  await expect(ring).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(alert(page)).toBeVisible();
  await expect(message(page)).not.toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
});

for (const mode of [
  { name: 'light', scheme: 'light' as const, hc: false },
  { name: 'dark', scheme: 'dark' as const, hc: false },
  { name: 'light-hc', scheme: 'light' as const, hc: true },
  { name: 'dark-hc', scheme: 'dark' as const, hc: true },
]) {
  test(`the failure message passes axe · ${mode.name}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: mode.scheme });
    await page.addInitScript((hc) => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: hc })), mode.hc);
    await open(page);
    for (const id of [ROW_1, ALWAYS, ONCE]) await row(page, id).getByRole('checkbox').check();
    await bar(page).getByRole('button', { name: 'Archive' }).click();
    await expect(alert(page)).toBeVisible();
    await expect(row(page, ROW_1)).toHaveCount(0);
    // The pointer leaves the bar, so this checks the message. The bar's critical tool, hovered in dark, is a known contrast failure.
    await page.mouse.move(0, 0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('Done after a selection that ended without it does not return focus to the old checkbox', async ({ page, isMobile }) => {
  test.skip(isMobile, 'One project is enough; the check is about the bar’s memory.');
  await open(page);
  const first = row(page, ROW_1).getByRole('checkbox');
  await first.focus();
  await page.keyboard.press('Space');
  await bar(page).getByRole('button', { name: 'Done' }).focus();
  await first.evaluate((el: HTMLInputElement) => el.click());
  await expect(bar(page)).toHaveCount(0);
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  const later = row(page, ROW_3).getByRole('checkbox');
  const y = await page.evaluate(() => scrollY);
  await later.evaluate((el: HTMLInputElement) => el.click());
  await bar(page).getByRole('button', { name: 'Done' }).evaluate((el: HTMLElement) => el.click());
  await expect(bar(page)).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  expect(await first.evaluate((el) => el === document.activeElement)).toBe(false);
});
