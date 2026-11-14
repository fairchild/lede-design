import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// The Integrations page: Overview's card reaches it, its install command names this release, its SpecView example
// draws and works, and its links name folders that exist. The folders are read from disk, so a renamed or added
// example app fails here.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const FOLDERS = readdirSync('integrations', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const SPEC = readFileSync('src/pages/docs/examples/json-render-spec.json', 'utf8').trim();
const REPO = 'https://github.com/fairchild/lede-design';

const section = (page: Page, id: string) => page.locator(`section[aria-labelledby="${id}"]`);

test('Overview’s Integrations card counts the example apps and opens the page, with Overview current', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('main').getByRole('article').filter({ has: page.getByRole('link', { name: 'Integrations', exact: true }) });
  await expect(card.locator('.ld-summary-figure')).toHaveText(String(FOLDERS.length));
  await card.getByRole('link').click();
  await expect(page).toHaveURL(/\/integrations$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Integrations' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
});

test('the install command names this release’s registry', async ({ page }) => {
  await page.goto('/integrations');
  const install = page.locator('.docs-code-example').filter({ has: page.getByRole('button', { name: 'Install commands for SpecView' }) });
  await expect(install.locator('code')).toHaveText(
    `npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v${version}/{name}.json'\nnpx shadcn@latest add @lede/theme-provider @lede/json-render`,
  );
});

test('SpecView draws the spec it shows, and its switches write the spec’s state', async ({ page }) => {
  await page.goto('/integrations');
  const example = section(page, 'json-render-example');
  await expect(example.locator('.docs-spec').getByRole('heading', { level: 3, name: 'Notifications' })).toBeVisible();
  await expect(example.getByRole('heading', { level: 4, name: 'Delivery' })).toBeVisible();
  const push = example.getByRole('switch', { name: 'Push alerts' });
  const email = example.getByRole('switch', { name: 'Email alerts' });
  await expect(push).toBeChecked();
  await expect(email).not.toBeChecked();
  await email.click();
  await expect(email).toBeChecked();
  const json = example.locator('.docs-code-example').filter({ has: page.getByRole('button', { name: 'The spec as JSON' }) });
  expect(await json.locator('code').textContent()).toBe(SPEC);
});

test('each example app links to its folder on GitHub, and every folder in integrations/ is listed', async ({ page }) => {
  await page.goto('/integrations');
  const links = section(page, 'example-apps').getByRole('link');
  await expect(links).toHaveCount(FOLDERS.length + 1);
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  const folders = hrefs.flatMap((href) => href.match(/\/tree\/main\/(integrations\/[\w-]+)$/)?.[1] ?? []);
  for (const folder of folders) expect(existsSync(`${folder}/README.md`), `${folder}/README.md exists`).toBe(true);
  expect(folders.map((f) => f.replace('integrations/', '')).sort()).toEqual(FOLDERS);
  const files = hrefs.flatMap((href) => href.match(/\/blob\/main\/(integrations\/.+)$/)?.[1] ?? []);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) expect(existsSync(file), `${file} exists`).toBe(true);
  for (const href of hrefs) expect(href.startsWith(`${REPO}/`), href).toBe(true);
});

test('the Claude section links the design system on claude.ai and the canvas, and shows how an artifact copies the stylesheet', async ({ page }) => {
  await page.goto('/integrations');
  const claude = section(page, 'claude');
  await expect(claude.getByRole('heading', { level: 2, name: 'Claude' })).toBeVisible();
  await expect(claude.getByRole('link', { name: 'The Lede design system' })).toHaveAttribute('href', 'https://claude.ai/artifact/Cw9GgaD1zxRk9ewxGMHv4x');
  await expect(claude.getByRole('link', { name: 'The Lede canvas' })).toHaveAttribute('href', /^https:\/\/claude\.ai\/artifact\/7eECQYRQWxSkaJhwRtT4rJ/);
  const code = claude.locator('.docs-code-example').filter({ has: page.getByRole('button', { name: 'Lede in an HTML artifact' }) });
  expect(await code.locator('code').textContent()).toContain('"path": "project/components/bundle.css"');
});
