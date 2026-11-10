import { test, expect, type Locator, type Page } from '@playwright/test';
import { bigWorkItems } from '../src/data/work-items';

const GUIDE = '/blocks/data-table';
const EXAMPLES = ['dt-client', 'dt-server', 'dt-search', 'dt-states', 'dt-narrow'] as const;
type Example = (typeof EXAMPLES)[number];

const example = (page: Page, id: Example) => page.locator(`section[aria-labelledby="${id}"]`);
// A table row's link is named by its id; a card's by its title, then the id and its other fields.
const ROW = /\bWI-\d+/;
type Which = 'first' | 'last';
const rowLink = (page: Page, id: Example, which: Which) => {
  const links = example(page, id).getByRole('link', { name: ROW });
  return which === 'first' ? links.first() : links.last();
};
const itemOf = async (link: Locator) => (await link.innerText()).match(ROW)![0];
const usesRouter = (page: Page) => page.evaluate(() => (window as unknown as { spa?: true }).spa === true);

/** The server-backed examples' rows arrive after the guide does and move what is below them: wait for them before looking. */
async function settled(page: Page) {
  await expect(rowLink(page, 'dt-server', 'first')).toBeVisible();
  await expect(rowLink(page, 'dt-search', 'first')).toBeVisible();
}

/** From the Blocks page to the guide by its link, once its rows are in, marking the document so a full page load shows. */
async function toGuide(page: Page) {
  await page.goto('/blocks');
  await page.getByRole('link', { name: 'Data table guide and examples' }).click();
  await expect(page).toHaveURL(GUIDE);
  await expect(page.getByRole('heading', { level: 1, name: 'Data table' })).toBeVisible();
  await settled(page);
  await page.evaluate(() => { (window as unknown as { spa?: true }).spa = true; });
}

const top = (page: Page, id: Example) => example(page, id).evaluate((el) => Math.round(el.getBoundingClientRect().top));

/** Scrolls one of an example's rows to the middle of the screen. Returns its link and its item id. */
async function pickRow(page: Page, id: Example, which: Which) {
  if (id === 'dt-states') await example(page, id).getByRole('radio', { name: 'Ready', exact: true }).check();
  const link = rowLink(page, id, which);
  await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(link).toBeInViewport();
  return { link, item: await itemOf(link) };
}
/** The item page is up: the URL has changed and its back link has rendered, so a Back now leaves a page that is really there. */
async function expectItem(page: Page, item: string, id: Example) {
  await expect(page).toHaveURL(new RegExp(`${GUIDE}/items/${item}\\?from=${id}$`));
  await expect(page.getByRole('main').getByRole('link', { name: 'Data table' })).toBeVisible();
}

test.describe('Docs data table: a row opens an item inside the guide', () => {
  for (const id of EXAMPLES) {
    for (const which of ['first', 'last'] as const) {
      test(`${id}, ${which} row: the back link returns to the example and focuses its heading`, async ({ page }) => {
        await toGuide(page);
        const { link, item } = await pickRow(page, id, which);
        await link.click();
        await expectItem(page, item, id);
        await expect(page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'Blocks' })).toHaveAttribute('aria-current', 'page');

        await page.getByRole('main').getByRole('link', { name: 'Data table' }).click();
        await expect(page).toHaveURL(`${GUIDE}#${id}`);
        await settled(page);
        await expect.poll(async () => Math.abs(await top(page, id))).toBeLessThan(24);
        await expect(page.locator(`#${id}`)).toBeFocused();
        await page.keyboard.press('Tab');
        expect(await example(page, id).evaluate((el) => el.contains(document.activeElement))).toBe(true);
        expect(await usesRouter(page)).toBe(true);
      });

      test(`${id}, ${which} row: the browser Back button returns to the same place`, async ({ page }) => {
        await toGuide(page);
        const { link, item } = await pickRow(page, id, which);
        const before = await top(page, id);
        await link.click();
        await expectItem(page, item, id);

        await page.goBack();
        await expect(page).toHaveURL(GUIDE);
        await settled(page);
        await expect.poll(async () => Math.abs((await top(page, id)) - before)).toBeLessThan(4);
        expect(await usesRouter(page)).toBe(true);
      });
    }
  }

  test('a second trip keeps its own place: the back link, a further row, then the browser Back button', async ({ page }) => {
    await toGuide(page);
    const narrow = await pickRow(page, 'dt-narrow', 'first');
    await narrow.link.click();
    await page.getByRole('main').getByRole('link', { name: 'Data table' }).click();
    await expect(page).toHaveURL(`${GUIDE}#dt-narrow`);
    await settled(page);

    const { link, item } = await pickRow(page, 'dt-client', 'last');
    const before = await top(page, 'dt-client');
    await link.click();
    await expectItem(page, item, 'dt-client');
    await page.goBack();
    await expect(page).toHaveURL(`${GUIDE}#dt-narrow`);
    await settled(page);
    await expect.poll(async () => Math.abs((await top(page, 'dt-client')) - before)).toBeLessThan(4);
  });

  for (const [back, name] of [['link', 'the back link'], ['browser', 'the browser Back button']] as const) {
    test(`the 500-row option and the States pick survive a return by ${name}`, async ({ page }) => {
      await toGuide(page);
      const client = example(page, 'dt-client');
      await client.getByRole('radio', { name: '500 rows' }).check();
      await expect(client.getByRole('link', { name: ROW })).toHaveCount(500);
      await example(page, 'dt-states').getByRole('radio', { name: 'Error', exact: true }).check();
      const { link } = await pickRow(page, 'dt-client', 'last');
      await link.click();
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Data table');

      if (back === 'link') await page.getByRole('main').getByRole('link', { name: 'Data table' }).click();
      else await page.goBack();
      // Only the client example and the States pick are checked: the server-backed rows that settled() waits for
      // arrive after a 500-row remount, which a busy runner can stretch past the expect timeout.
      await expect(page.getByRole('heading', { level: 1, name: 'Data table' })).toBeVisible();
      await expect(client.getByRole('radio', { name: '500 rows' })).toBeChecked();
      await expect(client.getByRole('link', { name: ROW })).toHaveCount(500);
      await expect(example(page, 'dt-states').getByRole('radio', { name: 'Error', exact: true })).toBeChecked();
    });
  }
});

test('the 500-row option: rows past the first 310 open their item too', async ({ page }) => {
  await toGuide(page);
  const client = example(page, 'dt-client');
  await client.getByRole('radio', { name: '500 rows' }).check();
  const link = client.getByRole('link', { name: new RegExp(`\\b${bigWorkItems[310].id}\\b`) });
  const item = await itemOf(link);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${GUIDE}/items/${item}\\?from=dt-client$`));
  await expect(page.locator('.docs-facts')).toContainText(item);
  await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toHaveCount(0);
});

test.describe('Docs item page back link', () => {
  const back = (page: Page) => page.getByRole('main').getByRole('link', { name: 'Data table' });

  const cases: [string, string][] = [
    ['?from=dt-narrow', `${GUIDE}#dt-narrow`],
    ['', GUIDE],
    ['?from=nope', GUIDE],
    ['?from=%22%3E%3Cscript%3E', GUIDE],
    ['?from=dt-client%23x', GUIDE],
  ];
  for (const [query, href] of cases) {
    test(`${query || 'no query'}: back goes to ${href}`, async ({ page }) => {
      await page.goto(`${GUIDE}/items/WI-1001${query}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(back(page)).toHaveAttribute('href', href);
    });
  }

  test('a missing item has the same back link', async ({ page }) => {
    await page.goto(`${GUIDE}/items/WI-9999?from=dt-server`);
    await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
    await expect(page.getByText('There is no work item WI-9999.', { exact: true })).toBeVisible();
    await expect(back(page)).toHaveAttribute('href', `${GUIDE}#dt-server`);
  });
});

test('Demo app: a row opens the item and the back link returns to the Work list', async ({ page }) => {
  await page.goto('/app/work');
  const link = page.getByRole('main').getByRole('link', { name: ROW }).first();
  await expect(link).toBeVisible();
  const item = await itemOf(link);
  await link.click();
  await expect(page).toHaveURL(`/app/work/${item}`);
  await page.getByRole('main').getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL('/app/work');
  await expect(page.getByRole('heading', { level: 1, name: 'Work' })).toBeVisible();
});
