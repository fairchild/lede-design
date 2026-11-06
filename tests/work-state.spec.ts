// Work keeps its place. Sort and page live in the URL, so a reload or a shared link shows the same rows; selection and
// archives live in the demo store, so they last across routes and reloads; and Back from an item returns to the scroll
// position the reader left.
import { test, expect, type Page } from '@playwright/test';
import { allWorkItems, applyView } from '../src/data/work-items';

const BY_AMOUNT = applyView(allWorkItems, { sort: [{ columnId: 'amount', direction: 'ascending' }] });
const BY_AMOUNT_DESC = applyView(allWorkItems, { sort: [{ columnId: 'amount', direction: 'descending' }] });
const BY_DUE = applyView(allWorkItems, { sort: [{ columnId: 'due', direction: 'ascending' }] });
/** The first row of a 50-row page, 1-based. */
const first = (rows: typeof BY_DUE, page: number) => rows[(page - 1) * 50].id;
const plain = (rows: typeof BY_DUE, page: number) => rows.slice((page - 1) * 50, page * 50).filter((w) => !w.locked && !w.archiveFails).map((w) => w.id);

const row = (page: Page, id: string) => page.locator(`[data-row-id="${id}"]`);
const pager = (page: Page) => page.getByRole('navigation', { name: 'Pages of work items' });
const bar = (page: Page) => page.getByRole('toolbar', { name: /selected/ });
const go = (page: Page, place: string) => page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: place, exact: true }).click();
/** The column header in the table, or the Sort menu above the cards. */
const amountSorted = (page: Page, isMobile: boolean, direction: 'ascending' | 'descending') => isMobile
  ? expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue(`amount:${direction}`)
  : expect(page.getByRole('columnheader', { name: 'Amount' })).toHaveAttribute('aria-sort', direction);

async function expectPage(page: Page, at: number, firstId: string) {
  await expect(pager(page).getByText(new RegExp(`^Page ${at} of \\d+$`))).toBeVisible();
  await expect(page.locator('[data-row-id]').first()).toHaveAttribute('data-row-id', firstId);
}

test('a URL with a sort and a page opens on that page, and a reload or a new tab shows the same rows', async ({ page, context, isMobile }) => {
  await page.goto('/app/work?sort=amount&page=3');
  await expectPage(page, 3, first(BY_AMOUNT, 3));
  await amountSorted(page, isMobile, 'ascending');
  await page.reload();
  await expectPage(page, 3, first(BY_AMOUNT, 3));

  const tab = await context.newPage();
  await tab.goto('/app/work?sort=-amount&page=2');
  await expectPage(tab, 2, first(BY_AMOUNT_DESC, 2));
  await amountSorted(tab, isMobile, 'descending');
});

test('sorting and paging write the URL', async ({ page, isMobile }) => {
  await page.goto('/app/work');
  await expectPage(page, 1, first(BY_DUE, 1));
  if (isMobile) await page.getByRole('combobox', { name: 'Sort' }).selectOption('amount:ascending');
  else await page.getByRole('columnheader', { name: 'Amount' }).getByRole('button').click();
  await expect(page).toHaveURL(/\/app\/work\?sort=amount$/);
  await pager(page).getByRole('button', { name: 'Next' }).click();
  // Until a page's rows or the exact count arrive, the pager doesn't know there is a page after it.
  await expectPage(page, 2, first(BY_AMOUNT, 2));
  await pager(page).getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/app\/work\?sort=amount&page=3$/);
  await expectPage(page, 3, first(BY_AMOUNT, 3));
  // Paging and sorting replace the entry, so Back leaves Work.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/app\/work/);
});

test('each click on Next moves one page, however quick', async ({ page }) => {
  await page.goto('/app/work');
  await expect(pager(page).getByText('Page 1 of 7')).toBeVisible();
  // Three clicks in one task stand in for clicks that come faster than a render: each finds the page the last one moved to.
  await pager(page).getByRole('button', { name: 'Next' }).evaluate((next: HTMLElement) => { for (let i = 0; i < 3; i++) next.click(); });
  await expect(page).toHaveURL(/\/app\/work\?page=4$/);
  await expectPage(page, 4, first(BY_DUE, 4));
});

test('Back from a work item restores the sort, the page, the selection and the scroll position', async ({ page }) => {
  await page.goto('/app/work?sort=amount&page=3');
  await expectPage(page, 3, first(BY_AMOUNT, 3));
  const [a, b] = plain(BY_AMOUNT, 3);
  for (const id of [a, b]) await row(page, id).getByRole('checkbox').check();
  await expect(bar(page)).toHaveAccessibleName('2 work items selected');
  // Far enough down the page that the top of the list is out of sight.
  const target = BY_AMOUNT[100 + 30].id;
  await row(page, target).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(1000);
  await row(page, target).getByRole('link').first().click();
  await expect(page).toHaveURL(`/app/work/${target}`);

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/work\?sort=amount&page=3$/);
  await expectPage(page, 3, first(BY_AMOUNT, 3));
  await expect(bar(page)).toHaveAccessibleName('2 work items selected');
  for (const id of [a, b]) await expect(row(page, id).getByRole('checkbox')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
});

test('the item page’s Work link returns to the list’s sort and page', async ({ page }) => {
  await page.goto('/app/work?sort=amount&page=2');
  await expectPage(page, 2, first(BY_AMOUNT, 2));
  await row(page, first(BY_AMOUNT, 2)).getByRole('link').first().click();
  await page.getByRole('main').getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/work\?sort=amount&page=2$/);
  await expectPage(page, 2, first(BY_AMOUNT, 2));
});

test('the selection lasts across a route change and a reload', async ({ page }) => {
  await page.goto('/app/work');
  const [a] = plain(BY_DUE, 1);
  await row(page, a).getByRole('checkbox').check();
  await go(page, 'Settings');
  await go(page, 'Work');
  await expect(bar(page)).toHaveAccessibleName('1 work item selected');
  await page.reload();
  await expect(row(page, a).getByRole('checkbox')).toBeChecked();
  await expect(bar(page)).toHaveAccessibleName('1 work item selected');
});

test('an archived item stays archived after a reload, and leaves the selection', async ({ page }) => {
  await page.goto('/app/work');
  const [a, b] = plain(BY_DUE, 1);
  for (const id of [a, b]) await row(page, id).getByRole('checkbox').check();
  // Archived from its own page, the item leaves the list's selection too.
  await row(page, a).getByRole('link').first().click();
  await page.getByRole('main').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Archived ${a}.` })).toBeVisible();
  await expect(bar(page)).toHaveAccessibleName('1 work item selected');
  await page.reload();
  await expect(row(page, b)).toBeVisible();
  await expect(row(page, a)).toHaveCount(0);
  await expect(page.locator('.ld-dt-summary')).toContainText('of 309 work items');
  await expect(bar(page)).toHaveAccessibleName('1 work item selected');
  await page.goto(`/app/work/${a}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
});

test('a URL the list can’t show falls back: an unknown sort to the default, a page past the end to the last page', async ({ page }) => {
  await page.goto('/app/work?sort=nope&page=0');
  await expectPage(page, 1, first(BY_DUE, 1));
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.goto('/app/work?page=99');
  await expectPage(page, 7, first(BY_DUE, 7));
  await expect(page).toHaveURL(/\/app\/work\?page=7$/);
});

test('Back between two Work entries returns to each one’s sort and page', async ({ page }) => {
  await page.goto('/app/work?sort=amount&page=3');
  await expectPage(page, 3, first(BY_AMOUNT, 3));
  // The app's Work link adds an entry while the list stays on screen.
  await go(page, 'Work');
  await expect(page).toHaveURL(/\/app\/work$/);
  await expectPage(page, 1, first(BY_DUE, 1));
  for (const at of [2, 3]) {
    await pager(page).getByRole('button', { name: 'Next' }).click();
    await expectPage(page, at, first(BY_DUE, at));
  }
  await expect(page).toHaveURL(/\/app\/work\?page=3$/);
  await page.goBack();
  await expectPage(page, 3, first(BY_AMOUNT, 3));
  await expect(page).toHaveURL(/\/app\/work\?sort=amount&page=3$/);
});

test('archiving the only row on the last page moves the list, and its URL, to the page before', async ({ page }) => {
  const last = BY_DUE.slice(300);
  const keep = last.find((w) => !w.locked && !w.archiveFails)!.id;
  // Page 7 starts with one row: the rest of it is archived already.
  await page.goto('/');
  await page.evaluate((archived) => sessionStorage.setItem('lede:demo', JSON.stringify({ version: 1, work: { archived } })), last.filter((w) => w.id !== keep).map((w) => w.id));
  await page.goto('/app/work?page=7');
  await expectPage(page, 7, keep);
  await expect(page.locator('[data-row-id]')).toHaveCount(1);
  await row(page, keep).getByRole('button', { name: `More actions for ${keep}` }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(pager(page).getByText('Page 6 of 6')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/work\?page=6$/);
});
