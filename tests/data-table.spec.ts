import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { listen, spoken } from './spoken';
import { allWorkItems, dueDate } from '../src/data/work-items';

const DOCS = '/blocks/data-table';
const MODES = [
  { name: 'light', scheme: 'light' as const, hc: false },
  { name: 'dark', scheme: 'dark' as const, hc: false },
  { name: 'light-hc', scheme: 'light' as const, hc: true },
  { name: 'dark-hc', scheme: 'dark' as const, hc: true },
];

async function open(page: Page, url = DOCS, prefs: Record<string, unknown> = {}) {
  await page.addInitScript((p) => localStorage.setItem('lede:appearance', JSON.stringify(p)), prefs);
  await page.goto(url);
  await expect(page.locator('main')).toBeVisible();
}
const clientTable = (page: Page) => page.getByRole('table', { name: 'Work items (client mode)' });
const serverTable = (page: Page) => page.getByRole('table', { name: 'Work items (server mode)' });
const politeAnnouncer = (page: Page) => page.locator('[data-live-announcer] [aria-live="polite"]');
const rowHeaders = (table: Locator) => table.locator('tbody th[scope="row"]').allInnerTexts();
async function axe(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/**
 * Open a row's menu and wait for that row's own menu. A press on the next row while the last menu is still closing can
 * read that old menu, and an Escape sent before the new menu opens is lost, which left a menu open over the table.
 */
async function openRowMenu(page: Page, trigger: Locator) {
  const name = (await trigger.getAttribute('aria-label'))!;
  await trigger.click();
  const menu = page.getByRole('menu', { name });
  await expect(menu).toBeVisible();
  return menu;
}
/** Close the open menu with Escape and wait until no menu is left. */
async function closeMenu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
}

test.describe('DataTable', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'Table-layout behaviour is covered at desktop width; the phone project covers cards below.');
  });

  test('structure: a real table with a caption, one row header per row, column headers, no grid role', async ({ page }) => {
    await open(page);
    const table = clientTable(page);
    await expect(table.locator('caption')).toHaveText('Work items (client mode)');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(24);
    for (const row of await rows.all()) await expect(row.locator('th[scope="row"]')).toHaveCount(1);
    await expect(table.locator('thead th[scope="col"]')).toHaveCount(8); // checkbox, 6 columns, actions
    await expect(page.locator('[role="grid"], [role="treegrid"]')).toHaveCount(0);
    await expect(table.locator('[aria-selected]')).toHaveCount(0);
    // No interactive element nested inside another.
    const nested = await table.locator('a a, a button, button a, button button, a input, button input').count();
    expect(nested).toBe(0);
  });

  test('sorting: aria-sort only on the sorted header, focus stays, the new sort is announced then cleared', async ({ page }) => {
    await open(page);
    const table = clientTable(page);
    await expect(table.locator('[aria-sort]')).toHaveCount(1);
    await expect(table.getByRole('columnheader', { name: 'Due' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.locator('[aria-sort="none"]')).toHaveCount(0);

    const title = table.getByRole('button', { name: 'Title' });
    await title.focus();
    await page.keyboard.press('Enter');
    await expect(title).toBeFocused();
    await expect(table.locator('[aria-sort]')).toHaveCount(1);
    await expect(table.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.getByRole('columnheader', { name: 'Due' })).not.toHaveAttribute('aria-sort');
    await expect(politeAnnouncer(page)).toHaveText('Sorted by Title, ascending');
    const ascending = await table.locator('tbody tr td:nth-child(3)').allInnerTexts();
    expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })));
    // Cleared after about a second, so the same sort twice is announced twice.
    await expect(politeAnnouncer(page)).toHaveText('', { timeout: 2500 });

    await page.keyboard.press('Space');
    await expect(title).toBeFocused();
    await expect(table.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'descending');
    await expect(politeAnnouncer(page)).toHaveText('Sorted by Title, descending');
    await expect(title).toHaveAccessibleDescription('Sorted descending');
  });

  test('selection: checkbox names, select the page, shift-click a range', async ({ page }) => {
    await open(page);
    const table = clientTable(page);
    const first = await rowHeaders(table);
    await expect(table.getByRole('checkbox', { name: `Select ${first[0]}` })).toBeVisible();
    const boxes = table.locator('tbody').getByRole('checkbox');
    await expect(boxes).toHaveCount(24);

    await boxes.nth(1).click();
    await boxes.nth(4).click({ modifiers: ['Shift'] });
    for (let i = 0; i < 6; i++) {
      if (i >= 1 && i <= 4) await expect(boxes.nth(i)).toBeChecked();
      else await expect(boxes.nth(i)).not.toBeChecked();
    }
    await expect(table.locator('tbody tr[data-selected]')).toHaveCount(4);
    const all = table.getByRole('checkbox', { name: 'Select all work items shown' });
    expect(await all.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
    await expect(page.getByRole('toolbar', { name: '4 work items selected' })).toBeVisible();

    await all.click();
    await expect(all).toBeChecked();
    await expect(table.locator('tbody tr[data-selected]')).toHaveCount(24);
    await all.click();
    await expect(table.locator('tbody tr[data-selected]')).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: /selected/ })).toHaveCount(0);
  });

  test('selection: the page, then "Select all N" once the exact count arrives, then an exception', async ({ page }) => {
    await open(page);
    const table = serverTable(page);
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(page.locator('section[aria-labelledby="dt-server"]').getByText('50 of 310 work items', { exact: true })).toBeVisible();
    await table.getByRole('checkbox', { name: 'Select all work items shown' }).click();
    await page.getByRole('button', { name: 'Select all 310 work items' }).click();
    await expect(page.getByText('All 310 work items are selected.')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: '310 work items selected' })).toBeVisible();
    // Unticking one row after "Select all N" keeps the rest: 309.
    await table.locator('tbody').getByRole('checkbox').first().click();
    await expect(page.getByRole('toolbar', { name: '309 work items selected' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await expect(page.getByRole('toolbar', { name: /selected/ })).toHaveCount(0);
  });

  test('row link: a click anywhere on the row follows it; the checkbox and menu keep their own clicks', async ({ page }) => {
    await open(page);
    const table = clientTable(page);
    const row = table.locator('tbody tr').first();
    const id = (await row.locator('th[scope="row"]').innerText()).trim();
    await expect(row.getByRole('link', { name: id })).toHaveAttribute('href', `/blocks/data-table/items/${id}?from=dt-client`);

    await row.getByRole('checkbox').click();
    await expect(row.getByRole('checkbox')).toBeChecked();
    await expect(page).toHaveURL(new RegExp(`${DOCS}$`));
    const more = row.getByRole('button', { name: `More actions for ${id}` });
    await more.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(page).toHaveURL(new RegExp(`${DOCS}$`));
    await more.click(); // pressing it again closes it
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    // Click the middle of the Title cell, as a person would: the stretched link covers the cell, so the click lands on it.
    const box = (await row.locator('td').nth(2).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(new RegExp(`/blocks/data-table/items/${id}\\?from=dt-client$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('row actions menu by keyboard: opens, moves, closes and returns focus; disabled actions keep a reason', async ({ page }) => {
    await open(page);
    const table = clientTable(page);
    const trigger = table.getByRole('button', { name: /^More actions for / }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Assign to me' })).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    // The menu is named by its button; Tab leaves it closed and moves on (nothing left open or inert).
    await trigger.click();
    await expect(page.getByRole('menu', { name: /^More actions for / })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-base-ui-inert]')).toHaveCount(0);
    // Pressing outside an open menu dismisses it (the menu is modal: the press doesn't reach the table), and focus
    // isn't pulled anywhere; the next click on a checkbox works and keeps focus there.
    await trigger.click();
    await expect(menu).toBeVisible();
    const other = table.locator('tbody').getByRole('checkbox').nth(5);
    const at = (await other.boundingBox())!;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect(menu).toBeHidden();
    await expect(other).not.toBeChecked();
    await other.click();
    await expect(other).toBeChecked();
    await expect(other).toBeFocused();

    // A locked item: Archive stays listed, disabled, with its reason.
    const ids = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('table tbody tr')] as HTMLElement[];
      return rows.map((r) => r.dataset.rowId).filter(Boolean) as string[];
    });
    for (const id of ids) {
      const menu = await openRowMenu(page, table.getByRole('button', { name: `More actions for ${id}` }));
      const archive = menu.getByRole('menuitem', { name: /Archive/ });
      if ((await archive.getAttribute('aria-disabled')) === 'true') {
        await expect(archive).toContainText('Locked items can’t be archived');
        await closeMenu(page);
        return;
      }
      await closeMenu(page);
    }
    throw new Error('expected a locked item in the client example');
  });

  test('states: loading, empty, error with retry, stale', async ({ page }) => {
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-states"]');
    const table = section.getByRole('table', { name: 'State example' });
    const pick = (name: string) => section.getByRole('radio', { name, exact: true }).check();

    // It opens on Ready, so a reader's first sight isn't a skeleton that looks like the page still loading.
    await expect(section.getByRole('radio', { name: 'Ready', exact: true })).toBeChecked();
    await expect(table.locator('tbody tr')).toHaveCount(5);

    // Loading: skeleton rows keep the layout; the table is busy.
    await pick('Loading');
    await expect(table).toHaveAttribute('aria-busy', 'true');
    await expect(table.locator('tbody tr[aria-hidden="true"]')).toHaveCount(6);
    await expect(section.getByText('Loading work items…')).toBeVisible();

    await pick('Empty');
    await expect(section.getByText('No work items', { exact: true })).toBeVisible();
    await expect(section.getByRole('table')).toHaveCount(0);

    await pick('Error');
    const alert = section.getByRole('alert');
    await expect(alert).toContainText('Couldn’t load work items.');
    // Nothing loaded, so the table can't say how many there are: the summary beside the alert says nothing.
    const summary = section.locator('.ld-dt-summary');
    await expect(summary).toBeEmpty();
    await expect(alert).toContainText('The server didn’t answer in time.');
    // Focus lands on the summary once the retry's state is in, so it has its text as focus arrives.
    await summary.evaluate((el) => el.addEventListener('focus', () => { el.setAttribute('data-text-at-focus', el.textContent ?? ''); }, { once: true }));
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(summary).toBeFocused();
    await expect(summary).toHaveAttribute('data-text-at-focus', /\S/);
    await expect(table.locator('tbody tr')).toHaveCount(5);
    await expect(section.getByRole('alert')).toHaveCount(0);

    await pick('Stale');
    await expect(section.getByText(/Showing saved data from 10:42/)).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(5); // still usable
    await section.getByRole('button', { name: 'Refresh' }).click();
    await expect(section.getByText(/Showing saved data/)).toHaveCount(0);
  });

  test('a failed refresh is announced: its status region is on the page, empty and unpainted, before the text', async ({ page }) => {
    await listen(page);
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-states"]');
    const notice = section.locator('.ld-dt-notice');
    await expect(section.getByRole('table', { name: 'State example' }).locator('tbody tr')).toHaveCount(5);
    await expect(notice.getByRole('status')).toBeEmpty();
    expect(await notice.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])).toEqual([0, 0]);

    await section.getByRole('radio', { name: 'Stale', exact: true }).check();
    await expect(notice.getByRole('status')).toHaveText('Showing saved data from 10:42 AM.');
    await expect(notice.getByRole('button', { name: 'Refresh' })).toBeVisible();
    expect((await spoken(page)).filter((s) => s.text.startsWith('Showing saved data')))
      .toEqual([{ text: 'Showing saved data from 10:42 AM.', before: true, rendered: true }]);
  });

  test('guide: a table\'s selection bar stays with its own example, not over the next ones', async ({ page }) => {
    await open(page);
    const client = page.locator('section[aria-labelledby="dt-client"]');
    await client.locator('tbody').getByRole('checkbox').first().check();
    const bar = client.getByRole('toolbar', { name: '1 work item selected' });
    await expect(bar).toBeInViewport(); // while its table is on screen, the bar floats in view
    await page.locator('#dt-states').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById('dt-states')!.scrollIntoView({ block: 'center' }));
    // Both edges in one read: rows that load in the examples between two reads move the page under the second one.
    const [barBottom, clientBottom] = await bar.evaluate((el) => [
      el.getBoundingClientRect().bottom,
      el.closest('section[aria-labelledby="dt-client"]')!.getBoundingClientRect().bottom,
    ]);
    expect(barBottom).toBeLessThanOrEqual(clientBottom + 1);
    await expect(bar).not.toBeInViewport();
  });

  test('search: the filter is in the view, so it reaches the server, survives a sort and comes back from the cache', async ({ page }) => {
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-search"]');
    const table = section.getByRole('table', { name: 'Work items (search)' });
    await expect(section.getByText(/ of 310 work items/)).toBeVisible();

    await section.getByRole('searchbox', { name: 'Search titles' }).fill('contract');
    await expect(section.getByText(/ of 310 work items/)).toHaveCount(0);
    await expect(table.getByRole('row').nth(1)).toContainText(/contract/i);
    const matched = await table.locator('tbody tr').count();
    expect(matched).toBeGreaterThan(0);
    for (const row of await table.locator('tbody tr').allInnerTexts()) expect(row).toMatch(/contract/i);

    // Sorting keeps the search: the view carries both.
    await table.getByRole('button', { name: 'Title' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(matched);
    for (const row of await table.locator('tbody tr').allInnerTexts()) expect(row).toMatch(/contract/i);

    // Clearing it shows everything again.
    await section.getByRole('searchbox', { name: 'Search titles' }).fill('');
    await expect(section.getByText(/ of 310 work items/)).toBeVisible();
  });

  test('search: a new filter clears the selection, so the bar and an action never reach rows not shown', async ({ page }) => {
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-search"]');
    const table = section.getByRole('table', { name: 'Work items (search)' });
    const search = section.getByRole('searchbox', { name: 'Search titles' });
    const bar = section.getByRole('toolbar', { name: /selected/ });
    const tickPage = () => table.getByRole('checkbox', { name: 'Select all work items shown' }).click();
    const rowBoxes = table.locator('tbody').getByRole('checkbox');
    await expect(section.getByText('50 of 310 work items')).toBeVisible();

    // Search, select the matches, clear the search: the selection doesn't carry over to all 310.
    await search.fill('contract');
    await expect(section.getByText(/ of 310 work items/)).toHaveCount(0);
    await expect(table.locator('tbody tr').first()).toContainText(/contract/i);
    await tickPage();
    await expect(bar).toBeVisible();
    await search.fill('');
    await expect(section.getByText(/ of 310 work items/)).toBeVisible();
    await expect(bar).toHaveCount(0);

    // Select all 310, untick 3, search: not "307 selected" over the matches.
    await tickPage();
    await section.getByRole('button', { name: 'Select all 310 work items' }).click();
    for (const i of [0, 1, 2]) await rowBoxes.nth(i).click();
    await expect(section.getByRole('toolbar', { name: '307 work items selected' })).toBeVisible();
    await search.fill('contract');
    await expect(table.locator('tbody tr').first()).toContainText(/contract/i);
    await expect(bar).toHaveCount(0);
    await search.fill('');
    await expect(section.getByText(/ of 310 work items/)).toBeVisible();

    // Select all, untick the page, search.
    await tickPage();
    await section.getByRole('button', { name: 'Select all 310 work items' }).click();
    await tickPage();
    await expect(section.getByRole('toolbar', { name: '260 work items selected' })).toBeVisible();
    await search.fill('contract');
    await expect(table.locator('tbody tr').first()).toContainText(/contract/i);
    await expect(bar).toHaveCount(0);
    await search.fill('');
    await expect(section.getByText(/ of 310 work items/)).toBeVisible();

    // Tick 2, search for nothing: no "2 selected" over an empty table.
    await rowBoxes.nth(0).click();
    await rowBoxes.nth(1).click();
    await expect(section.getByRole('toolbar', { name: '2 work items selected' })).toBeVisible();
    await search.fill('zzzz no match');
    await expect(table.locator('tbody tr').filter({ has: page.getByRole('checkbox') })).toHaveCount(0);
    await expect(bar).toHaveCount(0);

    // A selection made under the new filter works as usual, and a sort keeps it: only the filter scopes a selection.
    await search.fill('contract');
    await expect(table.locator('tbody tr').first()).toContainText(/contract/i);
    await rowBoxes.nth(0).click();
    await expect(section.getByRole('toolbar', { name: '1 work item selected' })).toBeVisible();
    await table.getByRole('button', { name: 'Title' }).click();
    await expect(table.getByRole('columnheader', { name: /Title/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect(section.getByRole('toolbar', { name: '1 work item selected' })).toBeVisible();

    // Paging keeps it too: with no filter, tick 2, then Load more.
    await search.fill('');
    await expect(section.getByText(/ of 310 work items/)).toBeVisible();
    await rowBoxes.nth(0).click();
    await rowBoxes.nth(1).click();
    await section.getByRole('button', { name: 'Load more' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(100);
    await expect(section.getByRole('toolbar', { name: '2 work items selected' })).toBeVisible();
  });

  test('search: the result count is announced in a status region', async ({ page }) => {
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-search"]');
    const status = page.locator('#dt-search-status');
    await expect(status).toHaveText('');
    // Every text the region takes: while the new rows load it must not speak the last view's total.
    await status.evaluate((el) => {
      const seen: string[] = [];
      (window as unknown as { statusSeen: string[] }).statusSeen = seen;
      new MutationObserver(() => seen.push(el.textContent ?? '')).observe(el, { childList: true, subtree: true, characterData: true });
    });
    await section.getByRole('searchbox', { name: 'Search titles' }).fill('contract');
    const found = `${allWorkItems.filter((w) => w.title.toLowerCase().includes('contract')).length} work items found`;
    await expect(status).toHaveText(found);
    const seen = await page.evaluate(() => (window as unknown as { statusSeen: string[] }).statusSeen);
    expect(seen.filter((t) => t !== '' && t !== found)).toEqual([]);
  });

  test('load more: while the next page loads, its button stays, says so, and keeps focus; then focus lands on the first new row', async ({ page }) => {
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-server"]');
    await expect(section.getByText(/^50 of /)).toBeVisible();
    await section.getByRole('button', { name: 'Load more' }).focus();
    await page.keyboard.press('Enter');
    const busy = section.getByRole('button', { name: 'Loading…' });
    await expect(busy).toBeFocused();
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter'); // a second press while it loads asks for nothing more
    await expect(section.getByText(/^100 of /)).toBeVisible();
    await expect(serverTable(page).locator('tbody tr')).toHaveCount(100);
    await expect(serverTable(page).locator('tbody tr:nth-child(51) [data-row-link]')).toBeFocused();
  });

  test('load more: focus that falls to <body> while the page loads still lands on the first new row', async ({ page }) => {
    // A click on blank text drops focus to <body>. Load more is still there, so the landing waits for the rows.
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-server"]');
    await expect(section.getByText(/^50 of /)).toBeVisible();
    await section.getByRole('button', { name: 'Load more' }).focus();
    await page.keyboard.press('Enter');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(serverTable(page).locator('tbody tr')).toHaveCount(100);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect(await page.evaluate(() => document.activeElement?.closest('tr')?.matches(':nth-child(51)') && document.activeElement.matches('[data-row-link]'))).toBe(true);
  });

  test('server mode: {atLeast} then the exact count, load more, cancellation, and a failed page leaves data usable', async ({ page }) => {
    await open(page);
    const table = serverTable(page);
    const section = page.locator('section[aria-labelledby="dt-server"]');
    await expect(section.getByText('50 of 100+ work items')).toBeVisible();
    await expect(section.getByText('50 of 310 work items')).toBeVisible();

    await section.getByRole('button', { name: 'Load more' }).click();
    // Loading more keeps the shown rows usable: "Updating…", but the table isn't aria-busy.
    await expect(section.getByText(/Updating…/)).toBeVisible();
    await expect(table).not.toHaveAttribute('aria-busy');
    await expect(table.locator('tbody tr')).toHaveCount(100);
    await expect(section.getByText('100 of 310 work items')).toBeVisible();

    // Two sorts in quick succession: the first request is out of date and is cancelled. While the new order is on its
    // way, the rows shown are the old order's, so the table is busy.
    await table.getByRole('button', { name: 'Title' }).click();
    await expect(table).toHaveAttribute('aria-busy', 'true');
    await table.getByRole('button', { name: 'Amount' }).click();
    const log = section.getByRole('list', { name: 'Requests to the fake server' });
    await expect(log.getByText(/title ascending: canceled/)).toBeVisible();
    await expect(log.getByText(/amount ascending: done/).first()).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Amount' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.locator('tbody tr')).toHaveCount(50);
    const amounts = (await table.locator('tbody td.ld-table-end').allInnerTexts()).map((t) => Number(t.replace(/[^0-9.]/g, '')));
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));

    // A next page that fails: the rows on screen stay (they are this view's and current), an alert says what failed,
    // and Load more retries it.
    await section.getByRole('button', { name: 'Fail the next request' }).click();
    await section.getByRole('button', { name: 'Load more' }).click();
    await expect(section.getByRole('alert')).toContainText('Couldn’t load more work items.');
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(section.getByText(/Showing saved data/)).toHaveCount(0);
    await section.getByRole('button', { name: 'Load more' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(100);
    await expect(section.getByRole('alert')).toHaveCount(0);

    // A new sort that fails shows the error alone: the previous order is never passed off as the new one.
    await section.getByRole('button', { name: 'Fail the next request' }).click();
    await table.getByRole('button', { name: 'Assignee' }).click();
    await expect(section.getByRole('alert')).toContainText('Couldn’t load work items.');
    await expect(section.getByRole('table')).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Load more' })).toHaveCount(0); // no pager under the alert
    const summary = section.locator('.ld-dt-summary');
    await expect(summary).toBeEmpty(); // nor a count of rows it never loaded
    await section.getByRole('button', { name: 'Try again' }).click();
    // The rows and sort below would already hold on the previous rows, so this waits for the retry to finish first.
    await expect(summary).toHaveText(/^50 of [^·]+$/);
    await expect(serverTable(page).locator('tbody tr')).toHaveCount(50);
    await expect(serverTable(page).getByRole('columnheader', { name: 'Assignee' })).toHaveAttribute('aria-sort', 'ascending');
  });

  test('fake server: "Fail the next request" fails the next rows request, even when a count finishes first', async ({ page }) => {
    // Regression: the armed failure used to be spent by whichever request finished next, including the slow exact
    // count, which made the failure tests depend on timing.
    await open(page);
    const section = page.locator('section[aria-labelledby="dt-server"]');
    await expect(section.getByText('50 of 100+ work items')).toBeVisible(); // the count is still running
    await section.getByRole('button', { name: 'Fail the next request' }).click();
    await expect(section.getByText('50 of 310 work items')).toBeVisible(); // the count finished, and succeeded
    await section.getByRole('button', { name: 'Load more' }).click();
    await expect(section.getByRole('alert')).toContainText('Couldn’t load more work items.');
  });

  test('sticky header: sticks to the page while the table fits; focus moving up is never hidden under it', async ({ page }) => {
    await open(page, '/app/work');
    const table = page.getByRole('table', { name: 'Work items' });
    await expect(table.locator('tbody tr')).toHaveCount(50);
    // The table fits, so its box is not a scroll container or a region: the page scrolls, and the header sticks to it.
    await expect(page.getByRole('region', { name: 'Work items' })).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 1200));
    const head = table.locator('thead th').first();
    const headBox = (await head.boundingBox())!;
    expect(Math.abs(headBox.y)).toBeLessThan(1);
    // Put row 10's menu button under the header, then Shift+Tab to it from row 11: it scrolls clear of the header.
    const more = (i: number) => table.locator('tbody tr').nth(i).getByRole('button', { name: /actions/i });
    await table.locator('tbody tr').nth(10).getByRole('checkbox').focus();
    const y = (await more(9).boundingBox())!.y;
    await page.evaluate((dy) => window.scrollBy(0, dy), y - headBox.height / 2);
    await page.keyboard.press('Shift+Tab');
    await expect(more(9)).toBeFocused();
    const focused = (await more(9).boundingBox())!;
    expect(focused.y).toBeGreaterThanOrEqual(headBox.height - 1);
  });

  test('sticky header: a table wider than its box scrolls in its own named region', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await open(page);
    const region = page.getByRole('region', { name: 'Work items (client mode)' });
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('tabindex', '0');
    expect(await region.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
  });

  test('server mode, pages: next and previous, ends stay focusable but inert', async ({ page }) => {
    await open(page, '/app/work');
    const table = page.getByRole('table', { name: 'Work items' });
    await expect(table.locator('tbody tr')).toHaveCount(50);
    const pager = page.getByRole('navigation', { name: 'Pages of work items' });
    await expect(pager.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
    const firstPage = await rowHeaders(table);
    await pager.getByRole('button', { name: 'Next' }).click();
    await expect(pager.getByText('Page 2 of 7')).toBeVisible();
    await expect.poll(async () => (await rowHeaders(table))[0]).not.toBe(firstPage[0]);
    await pager.getByRole('button', { name: 'Previous' }).click();
    await expect(pager.getByText('Page 1 of 7')).toBeVisible();
    await expect(page.locator('.ld-dt-summary')).toBeFocused(); // the new page, from its summary line
    expect(await rowHeaders(table)).toEqual(firstPage); // from the cache
    await pager.getByRole('button', { name: 'Previous' }).focus();
    await page.keyboard.press('Enter');
    await expect(pager.getByText('Page 1 of 7')).toBeVisible();
    await expect(pager.getByRole('button', { name: 'Previous' })).toBeFocused(); // at the first page it does nothing
  });

  for (const mode of MODES.filter((m) => m.hc)) {
    test(`server mode, pages: in ${mode.name} the disabled end draws no edge, and the enabled one does`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode.scheme });
      await open(page, '/app/work', { highContrast: true });
      const pager = page.getByRole('navigation', { name: 'Pages of work items' });
      const edge = (name: string) => pager.getByRole('button', { name }).evaluate((el) => getComputedStyle(el).boxShadow);
      await expect(pager.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');
      expect(await edge('Previous')).toBe('none');
      expect(await edge('Next')).not.toBe('none');
    });
  }

  test('server mode, pages: archiving everything on the last page steps back to a page that exists', async ({ page }) => {
    await open(page, '/app/work');
    const table = page.getByRole('table', { name: 'Work items' });
    const pager = page.getByRole('navigation', { name: 'Pages of work items' });
    await expect(pager.getByText('Page 1 of 7')).toBeVisible();
    for (let i = 2; i <= 7; i++) {
      await pager.getByRole('button', { name: 'Next' }).click();
      await expect(pager.getByText(`Page ${i} of 7`)).toBeVisible();
      await expect(table).not.toHaveAttribute('aria-busy');
    }
    await table.getByRole('checkbox', { name: 'Select all work items on this page' }).click();
    await page.getByRole('toolbar', { name: /selected/ }).getByRole('button', { name: 'Archive' }).click();
    // The takeaway first: what was archived, and that locked items were kept.
    await expect(page.getByRole('status').filter({ hasText: /^Archived \d+ work items?\./ })).toBeVisible();
    // Locked items stay, so page 7 may keep a few rows; if it empties, the table steps back to page 6.
    await expect(pager.getByText(/Page (6 of 6|7 of 7)/)).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
  });

  test('server mode: an exact count cancelled by a sort is asked for again when the view comes back', async ({ page }) => {
    await open(page, '/app/work');
    const table = page.getByRole('table', { name: 'Work items' });
    const pager = page.getByRole('navigation', { name: 'Pages of work items' });
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(pager.getByText('Page 1 of 2')).toBeVisible(); // {atLeast: 100} so far
    await table.getByRole('button', { name: 'Title' }).click(); // cancels the Due count
    await expect(table.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'ascending');
    await table.getByRole('button', { name: 'Due' }).click(); // back to Due, ascending: cached rows
    await expect(table.getByRole('columnheader', { name: 'Due' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(pager.getByText('Page 1 of 7')).toBeVisible();
  });

  test('truncated text: the full text shows on hover, also in rows covered by their link', async ({ page }) => {
    await open(page);
    const table = clientTable(page);
    const row = table.locator('tbody tr').filter({ hasText: 'the new analytics workspace' }).first();
    const cell = row.locator('td').nth(1);
    const clipped = await cell.locator('.ld-table-trunc').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(true);
    await cell.scrollIntoViewIfNeeded();
    const box = (await cell.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(row).toHaveAttribute('title', /the new analytics workspace/);
    // A cell that fits shows no title.
    const due = (await row.locator('td').nth(4).boundingBox())!;
    await page.mouse.move(due.x + due.width / 2, due.y + due.height / 2);
    await expect(row).not.toHaveAttribute('title');
  });

  test('narrow container: cards instead of the table, and focus follows the row across a layout switch', async ({ page }) => {
    await open(page);
    const narrow = page.locator('.docs-narrow');
    await expect(narrow.getByRole('table')).toHaveCount(0);
    const cards = narrow.getByRole('list', { name: 'Work items in a narrow pane' }).getByRole('listitem');
    await expect(cards).toHaveCount(8);
    await expect(cards.first().getByRole('checkbox', { name: 'Select WI-1001' })).toBeVisible();
    await expect(cards.first().getByRole('button', { name: 'More actions for WI-1001' })).toBeVisible();
    await expect(cards.first()).toContainText('Open');

    await page.goto('/app/work');
    const table = page.getByRole('table', { name: 'Work items' });
    await expect(table.locator('tbody tr')).toHaveCount(50);
    const id = (await rowHeaders(table))[2];
    await table.getByRole('link', { name: id, exact: true }).focus();
    await page.setViewportSize({ width: 480, height: 800 });
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.locator(`li[data-row-id="${id}"] a`)).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator(`tr[data-row-id="${id}"] a`)).toBeFocused();

    // A menu open during a layout switch doesn't come back on its own, anchored to a removed button.
    await table.getByRole('button', { name: `More actions for ${id}` }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.setViewportSize({ width: 480, height: 800 });
    // Wait for the cards, so the switch really happened (resizing straight back can skip it).
    await expect(page.getByRole('list', { name: 'Work items' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole('table', { name: 'Work items' })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('narrow container: a card leads with its card: \'title\' column, and the row header still names the row', async ({ page }) => {
    await open(page);
    const card = page.locator('.docs-narrow').getByRole('list', { name: 'Work items in a narrow pane' }).getByRole('listitem').first();
    const item = allWorkItems[0];
    await expect(card.locator('.ld-row-title')).toHaveText(item.title);
    // Below it, card: 1, 2 and 3: the ID, the due date and the amount with its currency. The assignee has no slot.
    const line = card.locator('.ld-row-subtitle');
    await expect(line).toContainText(item.id);
    await expect(line).toContainText(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount));
    await expect(line).not.toContainText(item.assignee.name);
    await expect(card.getByRole('checkbox', { name: `Select ${item.id}`, exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: `More actions for ${item.id}`, exact: true })).toBeVisible();
  });

  const FIXTURES = '/fixtures/data-table';

  test('a card field wider than its line wraps inside itself: nothing is cut off, and no line starts with a dot', async ({ page }) => {
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await open(page, FIXTURES);
      const section = page.locator('section[aria-labelledby="fx-long"]');
      await expect(section.getByRole('list', { name: 'Long card fields' }).getByRole('listitem')).toHaveCount(2);
      for (const subtitle of await section.locator('.ld-row-subtitle').all()) {
        expect(await subtitle.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        // Each dot ends a field, after its text, so it never sits at a line's start.
        const left = (await subtitle.boundingBox())!.x;
        for (const dot of await subtitle.locator('[aria-hidden="true"]').all()) expect((await dot.boundingBox())!.x).toBeGreaterThan(left + 4);
      }
      await expect(section.getByRole('checkbox', { name: 'Select P-1', exact: true })).toBeVisible();
    }
  });

  test.describe('controls in linked rows', () => {
    const table = (page: Page) => page.getByRole('table', { name: 'Row controls fixture' });
    /** Clicks a cell near its end, away from what it holds, where the row link's `::after` is on top. */
    const clickEnd = async (cell: Locator) => {
      await cell.scrollIntoViewIfNeeded();
      const box = (await cell.boundingBox())!;
      await cell.page().mouse.click(box.x + box.width - 4, box.y + box.height / 2);
    };

    test('a Button in a linked row’s cell takes the press, and the rest of the row navigates', async ({ page }) => {
      await open(page, FIXTURES);
      const row = table(page).locator('[data-row-id="n1"]');
      await row.getByRole('button', { name: 'Count 1' }).click();
      await expect(page.getByTestId('row-presses')).toHaveText('Pressed n1');
      expect(new URL(page.url()).hash).toBe('');
      await clickEnd(row.locator('td').first());
      await expect(page).toHaveURL(/#rc-n1$/);
      await expect(page.getByTestId('row-presses')).toHaveText('Pressed n1');
    });

    test('a row whose rowActions returns none has no ••• and keeps its cell', async ({ page }) => {
      await open(page, FIXTURES);
      await expect(table(page).getByRole('button', { name: 'More actions for 1', exact: true })).toBeVisible();
      await expect(table(page).getByRole('button', { name: 'More actions for 0', exact: true })).toHaveCount(0);
      await expect(table(page).locator('[data-row-id="n0"] td')).toHaveCount(2);
      await clickEnd(table(page).locator('[data-row-id="n0"] .ld-table-actions'));
      await expect(page).toHaveURL(/#rc-n0$/);
    });

    test('Table.RowLink covers its own row without `linked`', async ({ page }) => {
      await open(page, FIXTURES);
      const rows = page.getByRole('table', { name: 'Rows without linked' }).getByRole('row');
      await clickEnd(rows.nth(0).getByRole('cell'));
      await expect(page).toHaveURL(/#bare-Q1$/);
      await clickEnd(rows.nth(1).getByRole('cell'));
      await expect(page).toHaveURL(/#bare-Q2$/);
    });
  });

  // Edge cases on /fixtures/data-table: selection while a new filter's rows load, cursor paging on reload, a change of
  // page size, sorting by compare alone and density changes at runtime.
  const numbers = (page: Page, name: string) => page.getByRole('table', { name }).locator('tbody th[scope="row"]').allInnerTexts();

  // While a new filter's rows are on their way, the last view's rows are on screen; ticking them must do nothing.
  test.describe('a filter whose rows are held', () => {
    const section = (page: Page) => page.locator('section[aria-labelledby="fx-held"]');
    const table = (page: Page) => page.getByRole('table', { name: 'Held filter fixture' });
    const answer = (page: Page) => section(page).getByRole('button', { name: 'Answer waiting requests' });
    const bar = (page: Page) => section(page).getByRole('toolbar', { name: /selected/ });
    async function loaded(page: Page) {
      await open(page, FIXTURES);
      await answer(page).click();
      await expect(section(page).getByText('5 of 30 items')).toBeVisible();
    }
    async function filterEven(page: Page) {
      await section(page).getByRole('radio', { name: 'Even' }).click();
      await expect(section(page).getByText('1 waiting')).toBeVisible();
      await expect(table(page)).toHaveAttribute('aria-busy', 'true');
    }
    async function settle(page: Page) {
      await answer(page).click();
      await expect(section(page).getByText('5 of 15 items')).toBeVisible();
      await expect(table(page)).not.toHaveAttribute('aria-busy');
    }
    const rowBox = (page: Page, n: number) => table(page).getByRole('checkbox', { name: `Select ${n}` });
    const pageBox = (page: Page) => table(page).getByRole('checkbox', { name: /^Select all items/ });

    test('ticking an old row while the filter loads does nothing', async ({ page }) => {
      await loaded(page);
      await filterEven(page);
      await expect(rowBox(page, 1)).toBeDisabled();
      await rowBox(page, 1).click({ force: true });
      await settle(page);
      await expect(bar(page)).toHaveCount(0);
    });

    test('ticking the page while the filter loads does nothing, and offers no "Select all"', async ({ page }) => {
      await loaded(page);
      await filterEven(page);
      await expect(pageBox(page)).toBeDisabled();
      await pageBox(page).click({ force: true });
      await expect(section(page).getByRole('button', { name: /^Select all \d+ items/ })).toHaveCount(0);
      await settle(page);
      await expect(bar(page)).toHaveCount(0);
    });

    test('a page ticked before the filter loses its "Select all" offer while the filter loads', async ({ page }) => {
      await loaded(page);
      await pageBox(page).click();
      await expect(section(page).getByRole('button', { name: 'Select all 30 items' })).toBeVisible();
      await filterEven(page);
      await expect(section(page).getByRole('button', { name: 'Select all 30 items' })).toHaveCount(0);
      await settle(page);
      await expect(bar(page)).toHaveCount(0);
    });

    test('once the filter\'s rows arrive, ticking works', async ({ page }) => {
      await loaded(page);
      await filterEven(page);
      await settle(page);
      await rowBox(page, 2).click();
      await expect(section(page).getByRole('toolbar', { name: '1 item selected' })).toBeVisible();
    });

    // The hook alone, through the fixture's probe. While inert the rendered checkboxes are disabled, and a browser
    // never delivers a click to a disabled input, forced or not, so only a headless caller reaches the hook's guards.
    const hookCall = (page: Page, call: string) => page.evaluate(`window.ledeHookProbe.${call}`);
    const probe = (page: Page) => page.getByTestId('hook-probe');

    test('the hook: a toggle ignored while rows are the last view\'s leaves the Shift range anchor alone', async ({ page }) => {
      await open(page, FIXTURES);
      await hookCall(page, `model.selection.toggle('n0', true)`);
      await expect(probe(page)).toHaveText('n0');
      await hookCall(page, `setRows('previous')`);
      await expect(probe(page)).toHaveAttribute('data-inert', 'true');
      await hookCall(page, `model.selection.toggle('n2', true)`);
      await expect(probe(page)).toHaveText('n0');
      await hookCall(page, `setRows('current')`);
      await expect(probe(page)).toHaveAttribute('data-inert', 'false');
      await hookCall(page, `model.selection.toggle('n4', true, { range: true })`);
      // The range runs from the last toggle that counted (n0), not from the ignored one (n2).
      await expect(probe(page)).toHaveText('n0,n1,n2,n3,n4');
    });

    // Each call is made while inert, then the rows turn current. React applies updates in order, so once the probe
    // shows current rows it also shows any selection the call made: empty means none. The same call once current selects.
    test('the hook: togglePage does nothing while rows are the last view\'s', async ({ page }) => {
      await open(page, FIXTURES);
      await hookCall(page, `setRows('previous')`);
      await expect(probe(page)).toHaveAttribute('data-inert', 'true');
      await hookCall(page, 'model.selection.togglePage()');
      await hookCall(page, `setRows('current')`);
      await expect(probe(page)).toHaveAttribute('data-inert', 'false');
      await expect(probe(page)).toHaveText('');
      await hookCall(page, 'model.selection.togglePage()');
      await expect(probe(page)).toHaveText('n0,n1,n2,n3,n4,n5');
    });

    test('the hook: selectAllMatching does nothing while rows are the last view\'s', async ({ page }) => {
      await open(page, FIXTURES);
      await hookCall(page, `setRows('previous')`);
      await expect(probe(page)).toHaveAttribute('data-inert', 'true');
      await hookCall(page, 'model.selection.selectAllMatching()');
      await hookCall(page, `setRows('current')`);
      await expect(probe(page)).toHaveAttribute('data-inert', 'false');
      await expect(probe(page)).toHaveText('');
      await hookCall(page, 'model.selection.selectAllMatching()');
      await expect(probe(page)).toHaveText('all');
    });

    test('restoring a saved view, filter and selection in one handler, keeps the selection', async ({ page }) => {
      await loaded(page);
      await section(page).getByRole('button', { name: 'Restore a saved view' }).click();
      await settle(page);
      await expect(section(page).getByRole('toolbar', { name: '2 items selected' })).toBeVisible();
      await expect(rowBox(page, 2)).toBeChecked();
      await expect(rowBox(page, 4)).toBeChecked();
    });

    // An app that keeps the selection as plain JSON (URL params, a store) passes a new Selection object every render.
    const buildInRender = (page: Page) => section(page).getByRole('radio', { name: 'Built in render' }).click();

    test('a selection built in render, a new object every render, is still cleared by a new filter', async ({ page }) => {
      await loaded(page);
      await buildInRender(page);
      await rowBox(page, 1).click();
      await expect(section(page).getByRole('toolbar', { name: '1 item selected' })).toBeVisible();
      await filterEven(page);
      await settle(page);
      await expect(bar(page)).toHaveCount(0);
    });

    test('restoring a saved view keeps a selection built in render too', async ({ page }) => {
      await loaded(page);
      await buildInRender(page);
      await section(page).getByRole('button', { name: 'Restore a saved view' }).click();
      await settle(page);
      await expect(section(page).getByRole('toolbar', { name: '2 items selected' })).toBeVisible();
      await expect(rowBox(page, 2)).toBeChecked();
      await expect(rowBox(page, 4)).toBeChecked();
    });
  });

  test('cursor paging: reload rebuilds the loaded pages in order, each from the previous cursor', async ({ page }) => {
    await open(page, FIXTURES);
    const table = page.getByRole('table', { name: 'Cursor fixture' });
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await page.locator('section[aria-labelledby="fx-cursor"]').getByRole('button', { name: 'Load more' }).click();
    await expect.poll(() => numbers(page, 'Cursor fixture')).toEqual(['0', '1', '2', '3']);
    await page.getByRole('button', { name: 'Reload cursor fixture' }).click();
    await expect(table).not.toHaveAttribute('aria-busy');
    await expect(page.locator('section[aria-labelledby="fx-cursor"]').getByText(/Updating/)).toHaveCount(0);
    expect(await numbers(page, 'Cursor fixture')).toEqual(['0', '1', '2', '3']);
  });

  test('page size: changing it starts again with the new page boundaries, so no rows are skipped', async ({ page }) => {
    await open(page, FIXTURES);
    const section = page.locator('section[aria-labelledby="fx-size"]');
    await expect.poll(() => numbers(page, 'Page size fixture')).toEqual(['0', '1']);
    await section.getByRole('radio', { name: '3' }).check();
    await expect.poll(() => numbers(page, 'Page size fixture')).toEqual(['0', '1', '2']);
    await section.getByRole('button', { name: 'Load more' }).click();
    await expect.poll(() => numbers(page, 'Page size fixture')).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  test('a column sortable by compare alone sorts with its comparator', async ({ page }) => {
    await open(page, FIXTURES);
    const table = page.getByRole('table', { name: 'Compare fixture' });
    const ranks = () => table.locator('tbody td:nth-child(2)').allInnerTexts();
    await expect.poll(ranks).toEqual(['1', '2', '3'].map((n) => `#${n}`));
    await table.getByRole('button', { name: 'Rank' }).click();
    await expect.poll(ranks).toEqual(['3', '2', '1'].map((n) => `#${n}`));
  });

  test('server mode: a sortable column needs neither value nor compare, since the server sorts', async ({ page }) => {
    await open(page, FIXTURES);
    const region = page.getByRole('region', { name: 'A server table mounted later' });
    await region.getByRole('button', { name: 'Show the server table' }).click();
    const table = region.getByRole('table', { name: 'Mounted server fixture' });
    await expect(table.locator('tbody tr[data-row-id]')).toHaveCount(3);
    const sort = table.getByRole('button', { name: 'Label' });
    await expect(sort, 'the Label header is a sort button').toBeVisible({ timeout: 2000 });
    await sort.click();
    await expect(table.getByRole('columnheader', { name: 'Label' })).toHaveAttribute('aria-sort', 'ascending');
  });

  test('a server table never shows its empty state or a zero count before its first rows', async ({ page }) => {
    await open(page, FIXTURES);
    const region = page.getByRole('region', { name: 'A server table mounted later' });
    // What every commit rendered, even one a later commit in the same task replaced, so a frame that never paints
    // still counts: the text nodes added and removed, and the text a node had before it changed.
    await region.evaluate((el) => {
      const said: string[] = [];
      (window as unknown as { said: string[] }).said = said;
      new MutationObserver((records) => {
        for (const r of records) {
          for (const n of [...r.addedNodes, ...r.removedNodes]) said.push(n.textContent ?? '');
          if (r.oldValue != null) said.push(r.oldValue);
        }
      }).observe(el, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
    });
    await region.getByRole('button', { name: 'Show the server table' }).click();
    const table = region.getByRole('table', { name: 'Mounted server fixture' });
    await expect(table.locator('tbody tr[data-row-id]')).toHaveCount(3);
    const said = await page.evaluate(() => (window as unknown as { said: string[] }).said);
    expect(said.filter((t) => /No items|^0 items/.test(t)), 'nothing said there were no items').toEqual([]);
    expect(said.some((t) => t.includes('Loading items…')), 'the first commit says the rows are loading').toBe(true);
  });

  test('uncontrolled selection: archived rows leave it, and rows on another page stay', async ({ page }) => {
    await open(page, FIXTURES);
    const region = page.getByRole('region', { name: 'Uncontrolled selection' });
    const table = region.getByRole('table', { name: 'Uncontrolled fixture' });
    const bar = page.getByRole('toolbar', { name: /selected/ });
    const presses = region.getByRole('list', { name: 'Archive presses' }).getByRole('listitem');
    await table.getByRole('checkbox', { name: 'Select 0' }).check();
    // A page change isn't a removal: the row is elsewhere, still selected.
    await region.getByRole('button', { name: 'Next' }).click();
    await expect(table.getByRole('checkbox', { name: 'Select 3' })).toBeVisible();
    await expect(bar).toHaveAccessibleName('1 entry selected');
    await region.getByRole('button', { name: 'Previous' }).click();
    await expect(table.getByRole('checkbox', { name: 'Select 0' })).toBeChecked();
    await table.getByRole('checkbox', { name: 'Select 1' }).check();
    await bar.getByRole('button', { name: 'Archive' }).click();
    await expect(presses).toHaveText(['n0,n1']);
    // The archived rows left the selection with the table, so the bar left too.
    await expect(bar).toHaveCount(0);
    await expect(table.getByRole('checkbox', { name: 'Select all entries on this page' })).not.toBeChecked();
    // The next Archive sends only what's selected now.
    await table.getByRole('checkbox', { name: 'Select 2' }).check();
    await expect(bar).toHaveAccessibleName('1 entry selected');
    await bar.getByRole('button', { name: 'Archive' }).click();
    await expect(presses).toHaveText(['n0,n1', 'n2']);
  });

  test('density: control columns follow a density change at runtime', async ({ page }) => {
    await open(page);
    const check = clientTable(page).locator('thead th.ld-table-check');
    const before = (await check.boundingBox())!.width;
    // What ThemeProvider density="compact" does: smaller control tokens on the theme root.
    await page.locator('.ld-theme').first().evaluate((el: HTMLElement) => el.style.setProperty('--size-control-md', '30px'));
    await expect.poll(async () => (await check.boundingBox())!.width).toBeLessThan(before);
    const box = (await clientTable(page).locator('tbody .ld-table-check input').first().boundingBox())!;
    expect(box.height).toBe(38);
    expect((await check.boundingBox())!.width).toBeGreaterThanOrEqual(box.width);
  });

  for (const density of [{ name: 'regular', compact: false, min: 44 }, { name: 'compact', compact: true, min: 24 }]) {
    test(`hit targets: every control is at least ${density.min}px in ${density.name} density`, async ({ page }) => {
      await open(page, DOCS, { compact: density.compact });
      await expect(serverTable(page).locator('tbody tr')).toHaveCount(50);
      const sizes = await page.locator('.ld-dt').evaluateAll((roots) =>
        roots.flatMap((root) =>
          [...root.querySelectorAll<HTMLElement>('a[href], button, input')]
            .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName, w: r.width, h: r.height };
            }),
        ),
      );
      expect(sizes.length).toBeGreaterThan(100);
      const small = sizes.filter((s) => s.w < density.min - 0.5 || s.h < density.min - 0.5);
      expect(small).toEqual([]);
      // Compact reads the density tokens: smaller than regular, never below 24.
      const hit = await page.locator('.ld-table-check input').first().evaluate((el) => el.getBoundingClientRect().height);
      if (density.compact) expect(hit).toBeLessThan(44);
      else expect(hit).toBe(44);
    });
  }
});

test('cards on a phone: the work list renders cards with a visible actions button', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone only');
  await open(page, '/app/work');
  await expect(page.getByRole('table')).toHaveCount(0);
  const cards = page.getByRole('list', { name: 'Work items' }).getByRole('listitem');
  await expect(cards).toHaveCount(50);
  await expect(cards.first().getByRole('button', { name: /^More actions for WI-\d+$/ })).toBeVisible();
  // The title leads, and the ID still names the row's checkbox: titles repeat, IDs don't.
  await expect(cards.first().locator('.ld-row-title')).not.toHaveText(/^WI-/);
  await expect(cards.first().getByRole('checkbox', { name: /^Select WI-\d+$/ })).toBeVisible();
  // The header's jobs move to a bar: sort with a native select, select the page with a labelled checkbox.
  await page.getByRole('combobox', { name: 'Sort' }).selectOption({ label: 'ID, descending' });
  await expect(politeAnnouncer(page)).toHaveText('Sorted by ID, descending');
  await expect(cards.first()).toContainText('WI-1310');
  await page.getByRole('checkbox', { name: 'Select all work items on this page' }).check();
  await expect(page.getByRole('toolbar', { name: '50 work items selected' })).toBeVisible();
});

// Axe on the fixtures the route sweep can't reach: loaded rows with selection, every state, and cards.
for (const mode of MODES) {
  test(`DataTable fixtures pass axe · ${mode.name}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Fixture sweep runs once, at desktop width.');
    await page.emulateMedia({ colorScheme: mode.scheme });
    await open(page, DOCS, { highContrast: mode.hc });
    await expect(serverTable(page).locator('tbody tr')).toHaveCount(50);
    await clientTable(page).locator('tbody').getByRole('checkbox').nth(1).click();
    await page.locator('.docs-narrow').getByRole('checkbox').first().click();
    expect(await axe(page)).toEqual([]);
    const section = page.locator('section[aria-labelledby="dt-states"]');
    for (const state of ['Empty', 'Error', 'Stale', 'Ready']) {
      await section.getByRole('radio', { name: state, exact: true }).check();
      expect(await axe(page, 'section[aria-labelledby="dt-states"]'), state).toEqual([]);
    }
  });
}

test.describe('DataTable at 320px and in forced colours', () => {
  test.skip(({ isMobile }) => isMobile, 'Viewport and media are set explicitly here.');

  for (const url of [DOCS, '/app/work', '/app/work/WI-1001', '/fixtures/data-table']) {
    test(`reflow: ${url} needs no sideways scrolling of the page at 320px (WCAG 1.4.10)`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await open(page, url);
      await page.waitForLoadState('networkidle');
      // A data table may scroll inside its own named region; the page itself never scrolls sideways.
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(320);
    });
  }

  test('cards keep every title word and every field whole at 320 and 390px, with the status under the text', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await open(page, '/app/work');
      const card = page.locator('.ld-dt-cards li[data-row-id]').first();
      await expect(card).toBeVisible();
      const brokenWords = await page.locator('.ld-dt-cards .ld-row-title').evaluateAll((titles) => titles.flatMap((title) => {
        const broken: string[] = [];
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode as Text;
          // A line may break after a hyphen ("load-|testing"), so each side of one counts as a word.
          for (const word of text.data.matchAll(/[^\s-]+/g)) {
            const range = document.createRange();
            range.setStart(text, word.index);
            range.setEnd(text, word.index + word[0].length);
            if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) broken.push(word[0]);
          }
        }
        return broken;
      }));
      expect(brokenWords).toEqual([]);
      // A field's visible text sits on one line; its screen-reader label is positioned apart, so only text nodes count.
      const split = await page.locator('.ld-dt-card-field').evaluateAll((fields) => fields.filter((field) => {
        const tops = new Set<number>();
        for (const node of field.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
        }
        return tops.size > 1;
      }).map((field) => field.textContent));
      expect(split).toEqual([]);
      const text = (await card.locator('.ld-row-main').boundingBox())!;
      const status = (await card.locator('.ld-row-value').boundingBox())!;
      expect(status.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
    }
  });

  test('forced colours: checkboxes, focus, the sort and the selection keep a visible form', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page);
    const table = clientTable(page);
    await expect(table.locator('tbody tr')).not.toHaveCount(0);
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const box = table.locator('tbody .ld-checkbox-box').first();
    // The box is drawn with a border in a system colour, so it is visible with any palette.
    const border = await box.evaluate((el) => { const s = getComputedStyle(el); return { w: s.borderTopWidth, st: s.borderTopStyle }; });
    expect(border.st).not.toBe('none');
    expect(parseFloat(border.w)).toBeGreaterThan(0);
    // Selection shows as the checked box, not only as the row tint (which forced colours remove).
    const first = table.locator('tbody tr').first();
    await first.getByRole('checkbox').check();
    // The fill eases in, so a read this early can still see the unticked colour. Wait for where it ends: Highlight, which
    // is the browser's to define, so read it in the page.
    const unticked = table.locator('tbody tr').nth(1).locator('.ld-checkbox-box');
    const highlight = await unticked.evaluate((el) => {
      const probe = document.createElement('i');
      probe.style.background = 'Highlight';
      el.after(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    });
    await expect(first.locator('.ld-checkbox-box')).toHaveCSS('background-color', highlight);
    await expect(unticked).not.toHaveCSS('background-color', highlight);
    // The tick is drawn too, in a colour that isn't the fill: the box's ::after, a border in currentColor.
    const tick = await first.locator('.ld-checkbox-box').evaluate((el) => {
      const t = getComputedStyle(el, '::after');
      return { display: t.display, visibility: t.visibility, width: parseFloat(t.borderRightWidth), colour: t.borderRightColor, opacity: t.opacity };
    });
    expect(tick.display).not.toBe('none');
    expect(tick.visibility).toBe('visible');
    expect(tick.width).toBeGreaterThan(0);
    expect(Number(tick.opacity)).toBeGreaterThan(0.5);
    expect(tick.colour).not.toBe(highlight);
    // Focus is an outline, which forced colours keep (a box-shadow ring would vanish).
    const sort = table.getByRole('button', { name: 'Title' });
    await sort.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const outline = await sort.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    // The sorted column shows its direction: the icon goes from dimmed to full, and the arrow for the other direction
    // goes. Both arrows are drawn in currentColor, which forced colours keep.
    const header = table.getByRole('columnheader', { name: 'Title' });
    const arrows = () => header.evaluate((th) => {
      const css = (sel: string) => getComputedStyle(th.querySelector(sel)!);
      return { icon: Number(css('.ld-table-sort-icon').opacity), up: Number(css('.ld-table-sort-up').opacity), down: Number(css('.ld-table-sort-down').opacity), stroke: css('.ld-table-sort-up').stroke, colour: css('.ld-table-sort').color };
    });
    const before = await arrows();
    expect(before.icon).toBeLessThan(1);
    expect(before.down).toBe(1);
    await sort.press('Enter');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(async () => (await arrows()).icon).toBe(1);
    const after = await arrows();
    expect(after.up).toBe(1);
    expect(after.down).toBe(0);
    expect(after.stroke).toBe(after.colour);
  });
});

test.describe('SelectionBar placement', () => {
  test.skip(({ isMobile }) => isMobile, 'Viewport set explicitly.');
  const centerOf = (b: { x: number; width: number }) => b.x + b.width / 2;
  const select = async (page: Page, checkbox: Locator) => {
    await checkbox.check();
    const bar = page.getByRole('toolbar', { name: /selected/ });
    await expect(bar).toBeVisible();
    return (await bar.boundingBox())!;
  };

  for (const width of [390, 900, 1400]) {
    test(`with no AppShell it centers in the viewport and sits clear of its foot · ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/fixtures/bare-table');
      const bar = await select(page, page.getByRole('checkbox', { name: 'Select 0' }));
      expect(Math.abs(centerOf(bar) - width / 2), 'the bar’s center is the viewport’s').toBeLessThanOrEqual(1);
      expect(bar.y + bar.height).toBeLessThan(800);
      // No tab bar to clear: the bar sits near the foot, not a tab bar's height above it.
      expect(800 - (bar.y + bar.height)).toBeLessThan(48);
    });
  }

  test('in AppShell it centers beside the sidebar on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('/app/work');
    const sidebar = (await page.locator('.ld-shell-sidebar').boundingBox())!;
    const bar = await select(page, page.getByRole('checkbox', { name: 'Select WI-1018' }));
    const main = sidebar.x + sidebar.width;
    expect(Math.abs(centerOf(bar) - (main + (1400 - main) / 2)), 'the bar’s center is the main column’s').toBeLessThanOrEqual(1);
  });

  test('in AppShell on a phone it floats above the tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/app/work');
    const bar = await select(page, page.getByRole('checkbox', { name: 'Select WI-1018' }));
    const tabbar = (await page.locator('.ld-shell-tabbar > *').boundingBox())!;
    expect(bar.y + bar.height, 'the bar ends above the tab bar').toBeLessThanOrEqual(tabbar.y);
    expect(Math.abs(centerOf(bar) - 390 / 2)).toBeLessThanOrEqual(1);
  });
});

test('sticky first column: focus stays clear of it, with widths from Table.Columns or measured for auto columns', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Viewport set explicitly.');
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page);
  const stuck = (name: string) => page.getByRole('table', { name }).locator('tbody td, tbody th').first()
    .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--ld-table-stuck-w')) || 0);
  // Docs client table: every column has a width, so Table.Columns writes a calc(); it resolves to the sticky cells' width.
  const fromCss = await page.getByRole('table', { name: 'Work items (client mode)' }).locator('tbody tr').first().getByRole('link')
    .evaluate((el) => parseFloat(getComputedStyle(el).scrollMarginLeft));
  const sticky = await page.getByRole('table', { name: 'Work items (client mode)' }).locator('thead .ld-table-sticky')
    .evaluateAll((cells) => cells.reduce((w, c) => w + c.getBoundingClientRect().width, 0));
  expect(Math.abs(fromCss - sticky)).toBeLessThan(2);
  // Fixture tables have auto-width columns: Table.Root measures the sticky one after layout.
  await open(page, '/fixtures/data-table');
  await expect.poll(() => stuck('Cursor fixture')).toBeGreaterThan(0);
});

test('work page: archiving one row keeps the rest of the selection, and says what it did', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Table layout.');
  await open(page, '/app/work');
  const table = page.getByRole('table', { name: 'Work items' });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  const rows = table.locator('tbody tr');
  // Two unlocked rows: find them by their menus.
  const unlocked: number[] = [];
  for (let i = 0; i < 50 && unlocked.length < 2; i++) {
    const menu = await openRowMenu(page, rows.nth(i).getByRole('button', { name: /^More actions for/ }));
    const locked = (await menu.getByRole('menuitem', { name: /Archive/ }).getAttribute('aria-disabled')) === 'true';
    await closeMenu(page);
    if (!locked) unlocked.push(i);
  }
  const keep = (await rows.nth(unlocked[1]).locator('th').innerText()).trim();
  const gone = (await rows.nth(unlocked[0]).locator('th').innerText()).trim();
  await rows.nth(unlocked[0]).getByRole('checkbox').check();
  await rows.nth(unlocked[1]).getByRole('checkbox').check();
  await rows.nth(unlocked[0]).getByRole('button', { name: /^More actions for/ }).click();
  await page.getByRole('menuitem', { name: /Archive/ }).click();
  await expect(page.getByRole('status').filter({ hasText: `Archived ${gone}.` })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: gone })).toHaveCount(0);
  await expect(table.getByRole('checkbox', { name: `Select ${keep}` })).toBeChecked();
  // The count and the bulk target follow: one row is left in the selection.
  await expect(page.getByRole('toolbar', { name: /selected/ })).toHaveAccessibleName('1 work item selected');
});

test('work page: archiving one row from "Select all" keeps every remaining row selected, and the count right', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Table layout.');
  await open(page, '/app/work');
  const table = page.getByRole('table', { name: 'Work items' });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('50 of 310 work items')).toBeVisible();
  await table.getByRole('checkbox', { name: /^Select all/ }).check();
  await page.getByRole('button', { name: 'Select all 310 work items' }).click();
  const bar = page.getByRole('toolbar', { name: /selected/ });
  await expect(bar).toHaveAccessibleName('310 work items selected');
  // Archive the first unlocked row from its own menu.
  const rows = table.locator('tbody tr');
  let gone = '';
  for (let i = 0; i < 50 && !gone; i++) {
    const menu = await openRowMenu(page, rows.nth(i).getByRole('button', { name: /^More actions for/ }));
    const item = menu.getByRole('menuitem', { name: /Archive/ });
    if ((await item.getAttribute('aria-disabled')) === 'true') { await closeMenu(page); continue; }
    gone = (await rows.nth(i).locator('th').innerText()).trim();
    await item.click();
  }
  // Rows, count, paging and the bulk target, together: 309 remain, all of them selected.
  await expect(page.getByText('50 of 309 work items')).toBeVisible();
  await expect(table.getByRole('rowheader', { name: gone })).toHaveCount(0);
  await expect(bar).toHaveAccessibleName('309 work items selected');
  await expect(page.getByText('All 309 work items are selected.')).toBeVisible();
  for (const box of await table.locator('tbody input[type="checkbox"]').all()) await expect(box).toBeChecked();
  await expect(page.getByRole('navigation', { name: 'Pages of work items' })).toContainText('Page 1 of 7');
  // The bulk action acts on exactly those 309: everything unlocked is archived but for the two rows the server refuses,
  // and the locked ones are kept.
  await bar.getByRole('button', { name: 'Archive' }).click();
  const headline = page.getByRole('alert').locator('strong');
  await expect(headline).toHaveText(/^Archived \d+ work items\. Couldn’t archive 2 work items\. \d+ locked items? (was|were) kept\.$/);
  const [archived, failed, kept] = ((await headline.innerText()).match(/\d+/g) ?? []).map(Number);
  expect(archived + failed + kept).toBe(309);
  // What is left is exactly the locked rows and the failed ones, and only the failed ones stay selected.
  await expect(page.locator('.ld-dt-summary')).toHaveText(`${failed + kept} work items`);
  await expect(bar).toHaveAccessibleName('2 work items selected');
});

test('work page: after visiting the last page, archiving a row on the first page updates the total', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Table layout.');
  await open(page, '/app/work');
  const table = page.getByRole('table', { name: 'Work items' });
  const pager = page.getByRole('navigation', { name: 'Pages of work items' });
  await expect(page.getByText('50 of 310 work items')).toBeVisible();
  // The last page gives the total itself, so the count now comes from a page, not from the count request.
  for (let i = 2; i <= 7; i++) {
    await pager.getByRole('button', { name: 'Next' }).click();
    await expect(pager.getByText(`Page ${i} of 7`)).toBeVisible();
  }
  // Wait for the last page's rows: its response is what carries the total.
  await expect(page.locator('.ld-dt-summary')).toHaveText('10 of 310 work items');
  for (let i = 6; i >= 1; i--) {
    await pager.getByRole('button', { name: 'Previous' }).click();
    await expect(pager.getByText(`Page ${i} of 7`)).toBeVisible();
  }
  await expect(table).not.toHaveAttribute('aria-busy');
  const rows = table.locator('tbody tr');
  let done = false;
  for (let i = 0; i < 50 && !done; i++) {
    const menu = await openRowMenu(page, rows.nth(i).getByRole('button', { name: /^More actions for/ }));
    const item = menu.getByRole('menuitem', { name: /Archive/ });
    if ((await item.getAttribute('aria-disabled')) === 'true') { await closeMenu(page); continue; }
    await item.click();
    done = true;
  }
  await expect(page.getByText('50 of 309 work items')).toBeVisible();
});

test.describe('a reader whose locale is en-GB', () => {
  test.use({ locale: 'en-GB' });
  test.skip(({ isMobile }) => isMobile, 'Table layout.');
  const short = (d: Date, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);

  test('the demo and the guide pass locale="en-US", so their dates and times read like their text', async ({ page }) => {
    await open(page, '/app/work');
    const row = page.getByRole('table', { name: 'Work items' }).locator('tbody tr').first();
    const id = (await row.locator('th').innerText()).trim();
    const item = allWorkItems.find((w) => w.id === id)!;
    await expect(row).toContainText(short(dueDate(item), 'en-US'));
    await expect(row).not.toContainText(short(dueDate(item), 'en-GB'));

    await open(page, `/app/work/${id}`);
    const long = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    await expect(page.locator(`time[datetime="${item.due}"]`)).toHaveText(long.format(dueDate(item)));

    await open(page);
    const section = page.locator('section[aria-labelledby="dt-states"]');
    await section.getByRole('radio', { name: 'Stale', exact: true }).check();
    await expect(section.getByText(/^Showing saved data from 10:42\sAM\.$/)).toBeVisible();
  });

  test('a table\'s locale reaches its cells, cards, counts, pager and client sort: de-DE numbers and dates; an Estonian sort', async ({ page }) => {
    await open(page, '/fixtures/data-table');
    const section = page.locator('section[aria-labelledby="fx-locale"]');
    const german = section.getByRole('table', { name: 'German fixture' });
    await expect(section.locator('.ld-dt-summary').first()).toHaveText('2 of 1.234 words');
    await expect(german.locator('tbody tr').filter({ hasText: 'tee' })).toContainText('1.234,5');
    await expect(section.getByRole('navigation', { name: 'Pages of words' })).toContainText('Page 1 of 1.200');
    await german.getByRole('checkbox', { name: 'Select all words on this page' }).check();
    await section.getByRole('button', { name: 'Select all 1.234 words' }).click();
    await expect(section.getByText('All 1.234 words are selected.')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: '1.234 words selected' })).toBeVisible();
    await german.getByRole('checkbox', { name: 'Select zoo' }).uncheck();
    await expect(section.getByText('1.233 words selected.')).toBeVisible();
    // A card's fields and its status are formatted apart from the table's cells.
    const card = section.getByRole('list', { name: 'German cards' }).getByRole('listitem').filter({ hasText: 'tee' });
    const seen = new Date(2026, 9, 5);
    expect(short(seen, 'de-DE')).not.toBe(short(seen, 'en-GB'));
    await expect(card.locator('.ld-dt-card-field')).toHaveText('Number: 1.234,5');
    await expect(card.locator('.ld-row-value')).toHaveText(short(seen, 'de-DE'));
    // Estonian sorts z between s and t; en-US and en-GB put "tee" first.
    await expect(section.getByRole('table', { name: 'Estonian fixture' }).locator('tbody th[scope="row"]')).toHaveText(['zoo', 'tee']);
  });

  test('a mounted table re-sorts and reformats when its locale changes, with the same rows', async ({ page }) => {
    await open(page, '/fixtures/data-table');
    const section = page.locator('section[aria-labelledby="fx-locale"]');
    const table = section.getByRole('table', { name: 'Estonian fixture' });
    const words = table.locator('tbody th[scope="row"]');
    await expect(words).toHaveText(['zoo', 'tee']);
    await section.getByRole('radio', { name: 'en-US', exact: true }).check();
    await expect(words).toHaveText(['tee', 'zoo']);
    await expect(table.locator('tbody tr').first()).toContainText('1,234.5');
    await section.getByRole('radio', { name: 'et', exact: true }).check();
    await expect(words).toHaveText(['zoo', 'tee']);
  });

  test('a table without locale formats in the reader\'s', async ({ page }) => {
    await open(page, '/fixtures/data-table-perf');
    await page.getByRole('button', { name: 'DataTable', exact: true }).click();
    const row = page.getByRole('table', { name: 'DataTable' }).locator('tbody tr').first();
    const id = (await row.locator('th').innerText()).trim();
    const due = dueDate(allWorkItems.find((w) => w.id === id)!);
    await expect(row).toContainText(short(due, 'en-GB'));
  });
});

// A row action whose row stays has ended. Focus that falls to <body> later, as when the control that had it leaves, isn't
// the action's to place, so it doesn't jump to the row.
test('after a row action that keeps its row, focus that falls to <body> stays there', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard: one project is enough.');
  await page.goto('/fixtures/data-table');
  const region = page.getByRole('region', { name: 'Removal' });
  const more = region.getByRole('button', { name: 'More actions for 1' });
  await more.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Refresh' }).focus();
  await page.keyboard.press('Enter');
  await expect(more).toBeFocused();
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.activeElement === document.body ? 'body' : document.activeElement!.textContent)).toBe('body');
});
