import { readdirSync, readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// Each section on these pages ends with how to use it: an install command and, where the item has one, a sample.
// The samples typecheck with the site (`@/components/lede/*` maps to `registry/lede/*`), so this checks the rest.

interface Item { name: string; type: string; categories?: string[] }
const { items } = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: Item[] };
const PAGES = {
  '/components': items.filter((i) => i.type === 'registry:component').map((i) => i.name),
  '/blocks': items.filter((i) => i.categories?.includes('blocks')).map((i) => i.name),
};
const ROUTES = Object.keys(PAGES) as (keyof typeof PAGES)[];
const SAMPLES = 'src/pages/docs/samples';
const INSTALL = /^npx shadcn@latest add((?: @lede\/[\w-]+)+)$/;

/** Every section's usage, as the page shows it: the install command's items, and the sample's code if it has one. */
async function usages(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return Promise.all((await page.locator('.docs-usage').all()).map(async (usage) => {
    const [install, sample] = await usage.locator('.docs-code-example').all();
    const command = (await install.locator('code').textContent())!;
    const match = INSTALL.exec(command);
    expect(match, command).not.toBeNull();
    return { items: match![1].trim().split(' ').map((i) => i.slice('@lede/'.length)), code: await sample?.locator('code').textContent() };
  }));
}

for (const route of ROUTES) {
  test(`${route}: every section installs items of the page’s kind, and each of them is on it`, async ({ page }) => {
    await page.goto(route);
    const sections = page.locator('.docs-section');
    await expect(sections.first()).toBeVisible();
    await expect(page.locator('.docs-usage')).toHaveCount(await sections.count());
    const installed = (await usages(page)).flatMap((u) => u.items);
    expect(installed.filter((name) => !PAGES[route].includes(name))).toEqual([]);
    expect([...installed].sort()).toEqual([...PAGES[route]].sort());
  });

  test(`${route}: each sample is its file, character for character`, async ({ page }) => {
    await page.goto(route);
    for (const { items: [first], code } of await usages(page)) {
      const file = `${SAMPLES}/${first}.tsx`;
      const source = readdirSync(SAMPLES).includes(`${first}.tsx`) ? readFileSync(file, 'utf8').trim() : undefined;
      expect(code ?? undefined, file).toBe(source);
    }
  });

  test(`${route}: usage starts closed and fits a 320px screen open`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(route);
    const closed = page.locator('.docs-usage').getByRole('button', { expanded: false });
    await expect(page.locator('.docs-usage').getByRole('button', { expanded: true })).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    while (await closed.count()) await closed.first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}

test('Every sample is named for a registry item', () => {
  const names = new Set(items.map((i) => i.name));
  expect(readdirSync(SAMPLES).filter((file) => !names.has(file.replace(/\.tsx$/, '')))).toEqual([]);
});
