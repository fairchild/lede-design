import { readdirSync, readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// Each section on these pages ends with how to use it: an install command and, where the item has one, a sample.
// The samples typecheck with the site (`@/components/lede/*` maps to `registry/lede/*`), so this checks the rest.

interface Item { name: string; type: string; categories?: string[]; files: { path: string }[]; registryDependencies?: string[] }
const { items } = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: Item[] };
const PAGES = {
  '/components': items.filter((i) => i.type === 'registry:component').map((i) => i.name),
  '/blocks': items.filter((i) => i.categories?.includes('blocks')).map((i) => i.name),
};
const ROUTES = Object.keys(PAGES) as (keyof typeof PAGES)[];
const SAMPLES = 'src/pages/docs/samples';
const INSTALL = /^npx shadcn@latest add((?: @lede\/[\w-]+)+)$/;
const byName = new Map(items.map((i) => [i.name, i]));

/** The registry files a command installs: its items and, through `registryDependencies`, theirs. */
function installedFiles(names: string[]) {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    byName.get(name)?.registryDependencies?.forEach((dep) => visit(dep.replace(/^@lede\//, '')));
  };
  names.forEach(visit);
  return new Set([...seen].flatMap((name) => byName.get(name)?.files.map((f) => f.path) ?? []));
}

/** Where a sample's import lands once installed: `@/components/lede/x` is `registry/lede/x.tsx` or `.ts`. */
const installTarget = (specifier: string, files: Set<string>) => {
  const match = /^@\/components\/lede\/(.+)$/.exec(specifier);
  return match ? [`registry/lede/${match[1]}.tsx`, `registry/lede/${match[1]}.ts`].find((f) => files.has(f)) : undefined;
};

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
  test(`${route}: every section installs real items, and each of the page’s kind is installed there`, async ({ page }) => {
    await page.goto(route);
    const sections = page.locator('.docs-section');
    await expect(sections.first()).toBeVisible();
    await expect(page.locator('.docs-usage')).toHaveCount(await sections.count());
    const installed = (await usages(page)).flatMap((u) => u.items);
    expect(installed.filter((name) => !byName.has(name)), 'not in registry.json').toEqual([]);
    expect(PAGES[route].filter((name) => !installed.includes(name)), 'not installed from the page').toEqual([]);
  });

  test(`${route}: each sample is its file, character for character`, async ({ page }) => {
    await page.goto(route);
    for (const { items: [first], code } of await usages(page)) {
      const file = `${SAMPLES}/${first}.tsx`;
      const source = readdirSync(SAMPLES).includes(`${first}.tsx`) ? readFileSync(file, 'utf8').trim() : undefined;
      expect(code ?? undefined, file).toBe(source);
    }
  });

  test(`${route}: each sample imports only React and what its command installs`, async ({ page }) => {
    await page.goto(route);
    for (const { items: names, code } of await usages(page)) {
      if (!code) continue;
      const files = installedFiles(names);
      const specifiers = [...code.matchAll(/^import\b[^'"]*['"]([^'"]+)['"]/gm)].map(([, s]) => s);
      expect(specifiers.length).toBeGreaterThan(0);
      const stray = specifiers.filter((s) => s !== 'react' && !installTarget(s, files));
      expect(stray, `${names.join(' ')}: imports it doesn’t install`).toEqual([]);
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
