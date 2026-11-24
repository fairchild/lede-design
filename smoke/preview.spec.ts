// What a deploy can break that CI's local preview can't see: the Worker's routing, the assets and headers the edge
// serves, and the build that's actually live. A handful of pages render in a browser; the registry and the agent
// files are read as a fetcher reads them.
import { createHash } from 'node:crypto';
import { test, expect, type APIResponse } from '@playwright/test';

/** One page of each kind: docs, a block, the demo app and a nested app route. */
const PAGES = ['/', '/components', '/blocks/data-table', '/app/inbox', '/app/settings/appearance'];
/** The SPA shell, which a Worker that lost a route would answer with. */
const SHELL = /<div id="root"|^\s*<!doctype html/i;

const sha256 = async (response: APIResponse) => createHash('sha256').update(await response.body()).digest('hex');

for (const path of PAGES) {
  test(`${path} renders`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const origin = new URL(baseURL!).origin;
    const failed: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400 && new URL(response.url()).origin === origin) failed.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toHaveCount(0);
    expect(errors, `${path} threw`).toEqual([]);
    expect(failed, `${path} requested something the site doesn't serve`).toEqual([]);
  });
}

test('a route that doesn’t exist says so', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

test('llms.txt and llms-full.txt are this build’s', async ({ request }) => {
  for (const path of ['/llms.txt', '/llms-full.txt']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toBe('text/plain; charset=utf-8');
    expect(await response.text(), path).not.toMatch(SHELL);
  }
  const expected = process.env.SMOKE_LLMS_SHA256;
  if (expected) expect(await sha256(await request.get('/llms.txt')), '/llms.txt matches the build').toBe(expected);
});

test('a docs page asked for as Markdown gets its Markdown', async ({ request }) => {
  const response = await request.get('/components', { headers: { accept: 'text/markdown' } });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('text/plain; charset=utf-8');
  expect(await response.text()).toMatch(/^---\n|^# /);
});

test('the registry serves every item it lists', async ({ request }) => {
  const index = await request.get('/r/registry.json');
  expect(index.status()).toBe(200);
  expect(index.headers()['content-type']).toMatch(/^application\/json/);
  expect(index.headers()['access-control-allow-origin']).toBe('*');
  const expected = process.env.SMOKE_REGISTRY_SHA256;
  if (expected) expect(await sha256(index), '/r/registry.json matches the build').toBe(expected);
  const { items } = (await index.json()) as { items: { name: string }[] };
  expect(items.length).toBeGreaterThan(0);
  // A few at a time, so a slow edge doesn't see a burst of a hundred requests.
  const missing: string[] = [];
  for (let i = 0; i < items.length; i += 8) {
    await Promise.all(
      items.slice(i, i + 8).map(async ({ name }) => {
        const response = await request.get(`/r/${name}.json`, { failOnStatusCode: false });
        const ok = response.status() === 200 && ((await response.json().catch(() => null)) as { name?: string } | null)?.name === name;
        if (!ok) missing.push(`${response.status()} /r/${name}.json`);
      }),
    );
  }
  expect(missing, 'registry items the site doesn’t serve').toEqual([]);
});

test('a missing file or registry item is a 404, not the app', async ({ request }) => {
  for (const path of ['/no-such-file.txt', '/r/no-such-item.json']) {
    const response = await request.get(path, { failOnStatusCode: false });
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).not.toMatch(SHELL);
  }
});
