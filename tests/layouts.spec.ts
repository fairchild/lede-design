import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { WEEK_END, WORKSPACE_PROJECTS, WORKSPACE_STATS } from '../src/data/workspace';

const SECTIONS = ['Full page with left bar', 'Three panels with top bar', 'List and detail'];
const PREVIEWS = [
  { title: 'Full page with left bar', route: '/layouts/sidebar' },
  { title: 'Three panels with top bar', route: '/layouts/workbench' },
];
const frameTitle = (title: string) => `iframe[title="${title}: live preview"]`;
const docsNav = (page: Page) => page.getByRole('navigation', { name: 'Documentation' });

async function openPreview(page: Page, title: string) {
  const frame = page.locator(frameTitle(title));
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute('data-loaded', 'true');
  return page.frameLocator(frameTitle(title));
}

test('Layouts is one of five navigation places, and the demo stays reachable', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(docsNav(page).getByRole('list').first().getByRole('listitem')).toHaveText(['Overview', 'Foundations', 'Components', 'Blocks', 'Layouts']);
  const footer = page.locator('.ld-shell-footer').getByRole('link', { name: 'Demo app' });
  if (isMobile) {
    await expect(footer).toBeHidden();
    await page.locator('.docs-page-foot').getByRole('link', { name: 'Demo app' }).click();
  } else {
    await footer.click();
  }
  await expect(page).toHaveURL(/\/app$/);
  await page.goto('/layouts');
  await expect(docsNav(page).getByRole('link', { name: 'Layouts' })).toHaveAttribute('aria-current', 'page');
});

test('Overview counts what is there', async ({ page }) => {
  await page.goto('/layouts');
  const layouts = await page.locator('main section > h2').count();
  await page.goto('/decisions');
  const decisions = await page.locator('main .ld-disc').count();
  await page.goto('/');
  const registry = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: Array<{ categories?: string[] }> };
  const figure = (title: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) }).locator('.ld-summary-figure');
  await expect(figure('Layouts')).toHaveText(String(layouts));
  await expect(figure('Decisions')).toHaveText(String(decisions));
  await expect(figure('Blocks')).toHaveText(String(registry.items.filter((item) => item.categories?.includes('blocks')).length));
  // A family is a top-level entry with tokens or type styles: color and type count once each.
  const tokens = JSON.parse(readFileSync('tokens/tokens.json', 'utf8')) as Record<string, unknown>;
  const families = Object.values(tokens).filter((v) => typeof v === 'object' && v !== null && ('tokens' in v || 'groups' in v));
  await expect(figure('Foundations')).toHaveText(String(families.length));
});

test('each layout says what it is for, shows its regions and install line, and leads somewhere', async ({ page }) => {
  await page.goto('/layouts');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(SECTIONS);
  for (const title of SECTIONS) {
    const section = page.getByRole('region', { name: title });
    await expect(section.locator('.docs-intro')).toContainText('Pick it');
    await expect(section.getByRole('heading', { level: 3, name: 'Regions' })).toBeVisible();
    await expect(section.locator('dl dt').first()).toBeVisible();
    await expect(section.locator('dl dd').first()).toBeVisible();
    await expect(section.locator('pre code')).toHaveText(/^npx shadcn@latest add @lede\/[a-z-]+$/);
  }
  await page.getByRole('link', { name: 'See it in the demo inbox' }).click();
  await expect(page).toHaveURL(/\/app\/inbox\/m1$/);
});

for (const { title, route } of PREVIEWS) {
  test(`${title}: the preview is a titled frame of its full-page route`, async ({ page }) => {
    await page.goto('/layouts');
    const frame = page.locator(frameTitle(title));
    await expect(frame).toHaveAttribute('src', route);
    await openPreview(page, title);
    const link = page.getByRole('link', { name: `Open full page: ${title}` });
    await expect(link).toHaveAttribute('href', route);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main').getByRole('heading', { level: 1 }).or(page.getByRole('banner').getByRole('heading', { level: 1 }))).toHaveCount(1);
    const back = page.getByRole('link', { name: /Layouts/ }).locator('visible=true').first();
    await back.click();
    await expect(page).toHaveURL(/\/layouts$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Layouts' })).toBeVisible();
  });
}

test('a preview frame has no link back into the docs, so the docs can never nest in themselves', async ({ page }) => {
  await page.goto('/layouts');
  for (const { title } of PREVIEWS) {
    const frame = await openPreview(page, title);
    await expect(frame.locator('h1')).toBeAttached();
    await expect(frame.locator('a[href$="/layouts"]')).toHaveCount(0);
  }
});

test('Wide and Narrow change the frame\'s own viewport, so the real media queries fire', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/layouts');
  const title = 'Three panels with top bar';
  const frame = await openPreview(page, title);
  const element = page.locator(frameTitle(title));
  const section = page.getByRole('region', { name: title });
  await section.getByRole('radio', { name: 'Wide' }).check();
  await expect(frame.getByRole('separator', { name: 'Resize Files' })).toBeVisible();
  await expect(frame.getByRole('group', { name: 'Panel' })).toBeHidden();
  const wide = await element.evaluate((el) => (el as HTMLIFrameElement).contentWindow!.innerWidth);
  expect(wide).toBeGreaterThanOrEqual(1100);
  const stage = (await section.locator('.docs-preview-stage').boundingBox())!;
  const drawn = (await element.boundingBox())!;
  expect(drawn.width).toBeLessThanOrEqual(stage.width + 0.5);
  expect(stage.height).toBeCloseTo(drawn.height, 0);
  await section.getByRole('radio', { name: 'Narrow' }).check();
  await expect(frame.getByRole('group', { name: 'Panel' })).toBeVisible();
  await expect(frame.getByRole('separator')).toHaveCount(0);
  expect(await element.evaluate((el) => (el as HTMLIFrameElement).contentWindow!.innerWidth)).toBeLessThan(1100);
});

test('a frame scales down inside a phone-width column and starts narrow there', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/layouts');
  const section = page.getByRole('region', { name: 'Three panels with top bar' });
  await expect(section.getByRole('radio', { name: 'Narrow' })).toBeChecked();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  const drawn = (await page.locator(frameTitle('Three panels with top bar')).boundingBox())!;
  expect(drawn.x).toBeGreaterThanOrEqual(0);
  expect(drawn.x + drawn.width).toBeLessThanOrEqual(320);
});

test.describe('a preview follows the site\'s theme', () => {
  const themeOf = (scope: { locator: Page['locator'] }) => scope.locator('.ld-theme').first().getAttribute('data-theme');

  test('as it loads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('lede:appearance', JSON.stringify({ highContrast: true, accent: 'teal', shape: 'square' })));
    await page.goto('/layouts');
    const frame = await openPreview(page, 'Three panels with top bar');
    await expect(frame.locator('.ld-theme').first()).toHaveAttribute('data-theme', 'dark-hc');
    await expect(frame.locator('.ld-theme').first()).toHaveAttribute('data-shape', 'square');
    expect(await themeOf(page)).toBe('dark-hc');
  });

  test('when the system scheme changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/layouts');
    const frame = await openPreview(page, 'Three panels with top bar');
    await expect(frame.locator('.ld-theme').first()).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('.ld-theme').first()).toHaveAttribute('data-theme', 'dark');
    await expect(frame.locator('.ld-theme').first()).toHaveAttribute('data-theme', 'dark');
  });

  test('when the appearance settings change', async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/layouts');
    const frame = await openPreview(page, 'Three panels with top bar');
    const settings = await context.newPage();
    await settings.goto('/app/settings/appearance');
    await settings.getByRole('switch', { name: /contrast/i }).click();
    await expect(page.locator('.ld-theme').first()).toHaveAttribute('data-theme', 'light-hc');
    await expect(frame.locator('.ld-theme').first()).toHaveAttribute('data-theme', 'light-hc');
  });
});

test('the left bar stays full height and in place while the page scrolls, and the content fills the width', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The left bar is a wide-screen region; narrow screens use the floating bar.');
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/layouts/sidebar');
  const bar = page.getByRole('navigation', { name: 'Workspace' });
  await expect(bar).toBeVisible();
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(scrollable).toBeGreaterThan(400);
  const before = (await bar.boundingBox())!;
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(600);
  const after = (await bar.boundingBox())!;
  expect(after).toEqual(before);
  expect(after.y).toBe(0);
  expect(after.height).toBe(800);
  const footer = (await page.locator('.ld-shell-footer').boundingBox())!;
  expect(footer.y + footer.height).toBeGreaterThan(740);
  const main = (await page.locator('main').boundingBox())!;
  const table = (await page.locator('.ld-dt').boundingBox())!;
  expect(main.x).toBe(before.width);
  expect(main.x + main.width).toBe(1440);
  expect(table.width).toBeGreaterThan(1100);
});

test('the left bar layout\'s cards agree with its Projects table', () => {
  const card = (title: string) => WORKSPACE_STATS.find((s) => s.title === title)!;
  const week = WORKSPACE_PROJECTS.filter((p) => p.due <= WEEK_END);
  const due = card('Due this week');
  expect(due.figure).toBe(String(week.length));
  for (const status of ['Blocked', 'At risk', 'Not started'] as const) {
    const n = week.filter((p) => p.status === status).length;
    if (n) expect(due.summary).toContain(`${n} ${status.toLowerCase()}`);
  }
  expect(due.status.label).toBe(week.every((p) => p.status === 'On track') ? 'On track' : 'Needs you');
  const blocked = WORKSPACE_PROJECTS.filter((p) => p.status === 'Blocked');
  expect(card('Blocked').figure).toBe(String(blocked.length));
  for (const p of blocked) expect(card('Blocked').summary).toContain(p.name);
});

test('main is named after the current place, so a page and the frames in it stay distinct', async ({ page }) => {
  await page.goto('/layouts');
  await expect(page.getByRole('main', { name: 'Layouts' })).toBeVisible();
  const frame = await openPreview(page, 'Full page with left bar');
  await expect(frame.getByRole('main', { name: 'Overview' })).toBeVisible();
  await page.goto('/layouts/sidebar');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'People' }).click();
  await expect(page.getByRole('main', { name: 'People' })).toBeVisible();
});

test('the left bar\'s places lead to their sections, and the current one is marked', async ({ page }) => {
  await page.goto('/layouts/sidebar');
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'People' }).click();
  await expect(nav.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 2, name: 'People' })).toBeInViewport();
});

test('in a short window the left bar scrolls, so its last link stays reachable', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The left bar is a wide-screen region.');
  await page.setViewportSize({ width: 1280, height: 240 });
  await page.goto('/layouts/sidebar');
  const back = page.locator('.ld-shell-footer').getByRole('link', { name: 'Back to Layouts' });
  await back.focus();
  await expect(back).toBeInViewport({ ratio: 1 });
});

test('MasterDetail: the h1 moves to the open item when the panes stack, and back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone does not cross the breakpoint.');
  const h1 = page.locator('h1').locator('visible=true');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/inbox/m1');
  await expect(h1).toHaveText('Inbox');
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('Q4 budget needs your approval');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('Inbox');
});

test('only a preview frame lets a panel\'s scroll pass to the page around it', async ({ page }) => {
  // Files, the editor and Assistant, in that order. On a phone each is the one panel showing in turn.
  const overscroll = (scope: { locator: Page['locator'] }) => scope.locator('.ld-wb-panel, .ld-wb-content').evaluateAll((els) => els.map((el) => getComputedStyle(el).overscrollBehaviorY));
  await page.goto('/layouts/workbench');
  await expect(page.locator('html')).not.toHaveAttribute('data-embedded');
  expect(await overscroll(page)).toEqual(['contain', 'contain', 'contain']);
  await page.goto('/layouts');
  const frame = await openPreview(page, 'Three panels with top bar');
  await expect(frame.locator('html')).toHaveAttribute('data-embedded');
  expect(await overscroll(frame)).toEqual(['auto', 'auto', 'auto']);
});

test('the current file keeps a focus ring', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The file list is one panel away on a phone; the ring is the same.');
  await page.goto('/layouts/workbench');
  const file = page.getByRole('navigation', { name: 'Files' }).getByRole('link', { name: 'retry.ts', exact: true });
  await file.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(file).toBeFocused();
  const outline = await file.evaluate((el) => { const style = getComputedStyle(el); return { width: style.outlineWidth, color: style.outlineColor }; });
  expect(outline.width).toBe('2px');
  expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
});
