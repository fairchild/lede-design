import { test as setup, expect } from '@playwright/test';

// Outside CI, Playwright reuses whatever server is on its port. A production build there has no /fixtures/* pages:
// tests that drive them would time out with no clue why, and their axe checks would pass against the not-found page.
setup('the server has the fixture pages', async ({ page, baseURL }) => {
  const logged: string[] = [];
  page.on('console', (m) => logged.push(m.text()));
  await page.goto('/fixtures/data-table');
  const heading = page.getByRole('heading', { level: 1, name: 'Data table fixtures' });
  await expect(heading, `${baseURL} serves a build without /fixtures/*. Stop that server, or set PW_PORT to a free port.`).toBeVisible();
  // React's development build, and only it, suggests its DevTools on load. Without it StrictMode replays nothing.
  const development = logged.some((text) => text.includes('React DevTools'));
  const strict = setup.info().project.name.startsWith('strict');
  expect(development, `${baseURL} serves React’s ${development ? 'development' : 'production'} build. Stop that server, or set PW_PORT to a free port.`).toBe(strict);
});
