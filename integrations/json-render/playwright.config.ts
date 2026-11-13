import { defineConfig, devices } from '@playwright/test';

// SpecView in a browser, on the dev server, which also serves tests/fixture.html. `PW_PORT` moves it, to run beside a
// server that holds 4892.
const port = Number(process.env.PW_PORT ?? 4892);

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.e2e.ts',
  workers: 2,
  use: { baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'] },
  webServer: { command: `npm run tokens && vite --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: false },
});
