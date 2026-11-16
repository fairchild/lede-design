// Choose a part: every registry item a reader installs to build a screen is named, and each link lands on its example.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { CHOICES } from '../src/pages/docs/Choose';

test.skip(({ isMobile }) => isMobile, 'Links and items are the same at every width: one project is enough.');

const registry = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: { name: string; title: string }[] };
// The theme's CSS and the shared utilities come with every item, so nobody picks them.
const IMPLIED = ['lede-theme', 'lede-utils'];
const choices = CHOICES.flatMap((group) => group.choices);

test('every item a reader installs is a choice, under the title the registry gives it', () => {
  const named = new Map(choices.map((c) => [c.item, c.title]));
  const missing = registry.items.filter((item) => !IMPLIED.includes(item.name) && !named.has(item.name)).map((item) => item.name);
  expect(missing, 'items with no choice').toEqual([]);
  for (const item of registry.items.filter((i) => named.has(i.name))) {
    // A title can join two items' names, as "ListGroup & ListRow" does for list.
    expect(item.title.split(/, | & /), item.name).toEqual(named.get(item.name)!.split(/, | & /));
  }
  expect(choices.filter((c) => !registry.items.some((i) => i.name === c.item)).map((c) => c.item), 'unknown items').toEqual([]);
});

test('each choice links to a page that shows it, at an anchor that exists', async ({ page }) => {
  await page.goto('/choose');
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a part' })).toBeVisible();
  await expect(page.locator('main dl dd a')).toHaveCount(choices.length);
  for (const href of [...new Set(choices.map((c) => c.href))]) {
    const [path, hash] = href.split('#');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }), href).toHaveCount(1);
    if (hash) await expect(page.locator(`[id="${hash}"]`), href).toHaveCount(1);
  }
});
