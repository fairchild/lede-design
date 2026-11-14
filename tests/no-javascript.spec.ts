// What a reader without JavaScript gets. A fetch tool reads the shell's HTML, and tools differ on whether they keep
// <noscript>, so the fallback in #root carries the text. A browser with scripts off shows it; with scripts on it never
// paints, and React replaces it. Every file llms.txt links on this site is one the build serves.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'The shell is the same at every width: one project is enough.');

const SITE = 'https://lede.cloudcompute.com';
const URLS = [`${SITE}/llms.txt`, `${SITE}/r/registry.json`, 'https://github.com/fairchild/lede-design'];

test('the shell says what Lede is and links llms.txt, the registry index and the repo, outside head and noscript', async ({ request }) => {
  const html = await (await request.get('/components')).text();
  const head = html.match(/<head>([\s\S]*)<\/head>/)?.[1] ?? '';
  expect(head).toMatch(/<link rel="alternate" href="\/llms\.txt"/);
  const body = html.replace(/<head>[\s\S]*<\/head>/, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  expect(text).toContain('Lede is a design system for React');
  for (const url of URLS) expect(text, url).toContain(url);
});

test('with scripts off, a browser shows the fallback and its links', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/components');
  await expect(page.getByText('Lede is a design system for React')).toBeVisible();
  for (const url of URLS) await expect(page.getByRole('link', { name: url })).toHaveAttribute('href', url);
  await context.close();
});

test('with scripts on, the fallback never paints and is gone once React mounts', async ({ page }) => {
  // The bundle held back: the shell as it stands before React runs.
  await page.route(/\/(assets|src)\/.*\.(js|tsx?)(\?.*)?$/, (route) => route.abort());
  await page.goto('/components');
  await expect(page.locator('#root .docs-fallback')).toBeAttached();
  await expect(page.locator('#root .docs-fallback')).toBeHidden();
  await page.unrouteAll();
  await page.goto('/components');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.docs-fallback')).toHaveCount(0);
});

// /r/v<version>/ and /r/next/ come from the Worker's bucket, which a build doesn't hold.
test('every file llms.txt links on this site is served by the build', async ({ request }) => {
  const links = [...readFileSync('public/llms.txt', 'utf8').matchAll(/\]\((https:\/\/lede\.cloudcompute\.com[^)\s]*)\)/g)].map((m) => new URL(m[1]).pathname);
  const files = links.filter((path) => /\.[A-Za-z0-9]+$/.test(path) && !/^\/r\/(v\d|next\/)/.test(path));
  expect(files).toContain('/r/registry.json');
  for (const path of files) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    // The preview server answers a missing file with the shell, where the Worker answers 404.
    expect(response.headers()['content-type'], path).not.toMatch(/^text\/html/);
  }
});
