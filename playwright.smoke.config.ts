import { defineConfig, devices } from '@playwright/test';

// Smoke tests for a deployed site, which deploy-preview.yml runs against the preview after each deploy to develop:
// SMOKE_URL=https://lede-preview.cloudcompute.com npx playwright test -c playwright.smoke.config.ts
// The deploy passes what it built (SMOKE_ENTRY, SMOKE_REGISTRY_SHA256, SMOKE_LLMS_SHA256), so the run first waits
// for the site to serve that build and then checks it is the one live. Without them the checks read whatever is live.
const baseURL = process.env.SMOKE_URL;
// smoke/looks.spec.ts: `record` writes the screenshots, `compare` reads them, from SMOKE_SCREENSHOTS_DIR.
const screenshots = process.env.SMOKE_SCREENSHOTS;
if (screenshots && screenshots !== 'record' && screenshots !== 'compare') throw new Error('SMOKE_SCREENSHOTS is record or compare');
if (!baseURL) throw new Error('Set SMOKE_URL to the site to check, such as https://lede-preview.cloudcompute.com');

export default defineConfig({
  testDir: 'smoke',
  fullyParallel: true,
  // The network between a runner and the edge can drop a request; a check that fails twice is the site.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // A missing screenshot fails a comparison rather than being written, so production never becomes its own baseline.
  updateSnapshots: screenshots === 'record' ? 'all' : 'none',
  snapshotPathTemplate: `${process.env.SMOKE_SCREENSHOTS_DIR || 'smoke-screenshots'}/{arg}{ext}`,
  use: {
    baseURL,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'deployed', use: { ...devices['Desktop Chrome'] }, testMatch: /deployed\.setup\.ts/ },
    { name: 'smoke', use: { ...devices['Desktop Chrome'] }, testMatch: /\.spec\.ts$/, dependencies: ['deployed'] },
  ],
});
