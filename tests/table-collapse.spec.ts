// A collapsible table (Table.Root `collapsible`): the caption is a real button, the table keeps its name, and a
// collapsed table shows only its caption, to sight and to assistive tech. Progressive disclosure: the caption carries
// the summary, so a collapsed table still says what it holds.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DOCS = '/blocks/data-table';
async function open(page: Page) {
  await page.goto(DOCS);
  await expect(page.locator('main')).toBeVisible();
}
const section = (page: Page) => page.locator('section[aria-labelledby="dt-collapse"]');
const table = (page: Page) => section(page).getByRole('table', { name: /Quarter totals/ });
const toggle = (page: Page) => section(page).getByRole('button', { name: /Quarter totals/ });

test('open by default: the caption is a button, expanded, and the rows are there', async ({ page }) => {
  await open(page);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(table(page)).toHaveAccessibleName(/Quarter totals.*2 quarters/);
  await expect(table(page).getByRole('row')).toHaveCount(3);
});

test('collapsed: only the caption shows, and the rows leave the accessibility tree', async ({ page }) => {
  await open(page);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(table(page)).toBeVisible();
  await expect(table(page)).toHaveAccessibleName(/Quarter totals.*2 quarters/);
  await expect(table(page).getByRole('row')).toHaveCount(0);
  await expect(table(page).getByRole('columnheader')).toHaveCount(0);
  await expect(section(page).getByText('Q3', { exact: true })).toBeHidden();
  // Opening again brings them back.
  await toggle(page).click();
  await expect(table(page).getByRole('row')).toHaveCount(3);
});

test('the keyboard toggles it, and focus stays on the caption button', async ({ page }) => {
  await open(page);
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(page)).toBeFocused();
});

test('a table without `collapsible` has a plain caption, no button', async ({ page }) => {
  await open(page);
  const parts = page.locator('section[aria-labelledby="dt-parts"]');
  await expect(parts.getByRole('table', { name: 'Quarter totals' })).toBeVisible();
  await expect(parts.getByRole('button', { name: /Quarter totals/ })).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe finds nothing in the collapsible table, open and collapsed (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    const scan = async () => (await new AxeBuilder({ page }).include('section[aria-labelledby="dt-collapse"]').analyze())
      .violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(await scan()).toEqual([]);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await scan()).toEqual([]);
  });
}
