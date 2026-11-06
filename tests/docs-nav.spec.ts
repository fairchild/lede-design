import { test, expect, type Page } from '@playwright/test';

// The docs keep their way out on every page and at every width: the sidebar's foot on wide screens, the page's foot on
// narrow ones. The Mode and contrast controls there edit the same appearance as the demo's Settings → Appearance.
const DOCS = ['/', '/foundations', '/components', '/blocks', '/layouts', '/decisions'];
const LINKS = ['Demo app', 'Decisions', 'GitHub', /^Version \d+\.\d+\.\d+$/];

const footer = (page: Page) => page.locator('.ld-shell-footer, .docs-page-foot').filter({ visible: true });

for (const route of DOCS) {
  test(`${route} · links to the demo app, Decisions, GitHub and the changelog at every width`, async ({ page }) => {
    await page.goto(route);
    await expect(footer(page)).toHaveCount(1);
    for (const name of LINKS) await expect(footer(page).getByRole('link', { name })).toBeVisible();
    await expect(footer(page).getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/fairchild/lede-design');
    await expect(footer(page).getByRole('link', { name: LINKS[3] })).toHaveAttribute('href', /\/blob\/main\/CHANGELOG\.md$/);
  });
}

test('Mode and Increase contrast theme the docs, keep focus and carry into the demo’s Appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/foundations');
  const root = page.locator('.app-root');
  await expect(root).toHaveAttribute('data-theme', 'light');
  const dark = footer(page).getByRole('radio', { name: 'Dark' });
  await dark.check();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(dark).toBeFocused();
  const contrast = footer(page).getByRole('switch', { name: 'Increase contrast' });
  await contrast.click();
  await expect(root).toHaveAttribute('data-theme', 'dark-hc');
  await expect(contrast).toBeFocused();
  await page.getByRole('link', { name: 'Settings → Appearance' }).first().click();
  await expect(page).toHaveURL(/\/app\/settings\/appearance$/);
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Increase contrast' })).toBeChecked();
});

test('robots.txt is a text file that lets every crawler in', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await response.text()).toBe('User-agent: *\nAllow: /\n');
});
