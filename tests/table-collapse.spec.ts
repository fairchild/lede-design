// A collapsible table (Table.Root `collapsible`): the caption is a real button, the table keeps its name, and a
// collapsed table shows only its caption, to sight and to assistive tech. Progressive disclosure: the caption carries
// the summary, so a collapsed table still says what it holds.
import { createElement } from 'react';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { TableRootProps } from '../registry/lede/table';

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

test('the toggle is named by the title and the summary, so a collapsed table still says what it holds', async ({ page }) => {
  await open(page);
  await expect(toggle(page)).toHaveAccessibleName(/^Quarter totals.*2 quarters/);
});

test('a collapsible caption and summary are text: a link would sit inside the button', () => {
  // @ts-expect-error A collapsible table's caption is a string.
  const linked: TableRootProps = { caption: createElement('a', { href: '#x' }, 'link'), collapsible: true, children: null };
  // @ts-expect-error So is its summary.
  const summarized: TableRootProps = { caption: 'Quarter totals', collapsible: { summary: createElement('a', { href: '#x' }, 'link') }, children: null };
  const plain: TableRootProps = { caption: createElement('span', null, 'Quarter totals'), children: null };
  expect([linked, summarized, plain]).toHaveLength(3);
});

test('the toggle’s corners follow the box: its top ones open, all four collapsed', async ({ page }) => {
  await open(page);
  const box = section(page).locator('.ld-table-scroll');
  const radius = await box.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  const corners = () => toggle(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
  });
  expect(await corners()).toEqual([radius, radius, '0px', '0px']);
  await toggle(page).click();
  expect(await corners()).toEqual([radius, radius, radius, radius]);
});

test('in high contrast the box’s edge runs past the sticky header, which doesn’t paint over it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: true })));
  await open(page);
  const box = (await section(page).locator('.ld-table-scroll').boundingBox())!;
  const header = (await table(page).getByRole('columnheader').first().boundingBox())!;
  expect(header.x, 'the header starts inside the 1px edge').toBeGreaterThanOrEqual(box.x + 1);
  expect(header.x + header.width).toBeLessThanOrEqual(box.x + box.width - 1);
});

test('a development build warns once when `open` stops being passed', async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, 'One project is enough.');
  // The strict server, on the next port, serves React's development build, where the warning runs.
  const strict = new URL(baseURL!);
  strict.port = String(Number(strict.port) + 1);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('/fixtures/table', strict).href);
  const button = page.getByRole('button', { name: /Quarter totals/ });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(errors.filter((e) => e.startsWith('Table:'))).toEqual([]);
  await page.getByRole('button', { name: 'Stop passing open' }).click();
  await expect.poll(() => errors.filter((e) => e.startsWith('Table:'))).toEqual([
    'Table: `collapsible.open` switched from controlled to uncontrolled. Pass `open` from the first render or never.',
  ]);
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
