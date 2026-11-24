import { defineConfig, devices } from '@playwright/test';

// Smoke tests for a deployed site, which deploy-preview.yml runs against the preview after each deploy to develop:
// SMOKE_URL=https://lede-preview.cloudcompute.com npx playwright test -c playwright.smoke.config.ts
// The deploy passes what it built (SMOKE_ENTRY, SMOKE_REGISTRY_SHA256, SMOKE_LLMS_SHA256), so the run first waits
// for the site to serve that build and then checks it is the one live. Without them the checks read whatever is live.
const baseURL = process.env.SMOKE_URL;
if (!baseURL) throw new Error('Set SMOKE_URL to the site to check, such as https://lede-preview.cloudcompute.com');

export default defineConfig({
  testDir: 'smoke',
  fullyParallel: true,
  // The network between a runner and the edge can drop a request; a check that fails twice is the site.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'deployed', use: { ...devices['Desktop Chrome'] }, testMatch: /deployed\.setup\.ts/ },
    { name: 'smoke', use: { ...devices['Desktop Chrome'] }, testMatch: /\.spec\.ts$/, dependencies: ['deployed'] },
  ],
});
