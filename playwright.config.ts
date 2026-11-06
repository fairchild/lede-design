import { defineConfig, devices } from '@playwright/test';

// Outside CI a server already on this port is reused, whichever checkout started it, so concurrent runs each set their own PW_PORT.
// The default stays clear of `npm run preview` (4173 and up), whose build has no /fixtures/* pages.
const port = Number(process.env.PW_PORT || 4300);
// The same pages built with React's development build, where StrictMode runs every effect twice as `npm run dev` does.
const strictPort = port + 1;
/** The focus and keyboard specs, which a layout effect run twice can break. */
const strictSpecs = /focus-arrival|focus-actions|keyboard-paths/;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  // CI splits the suite across runners, and each writes a blob report that .github/workflows/ci.yml merges into one.
  reporter: process.env.CI ? [['github'], ['blob']] : 'list',
  // PW_CHROMIUM lets a machine with a different pre-installed Chromium run the suite; CI installs its own.
  use: { baseURL: `http://localhost:${port}`, launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
  // The tests drive /fixtures/*, which a production build leaves out, so they serve their own build that has them.
  webServer: [
    {
      command: `npx vite build --mode fixtures --outDir dist-fixtures && npx vite preview --outDir dist-fixtures --port ${port} --strictPort`,
      port,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite build --mode fixtures --outDir dist-strict && npx vite preview --outDir dist-strict --port ${strictPort} --strictPort`,
      env: { NODE_ENV: 'development' },
      port: strictPort,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    // Runs first: a reused server without the fixture pages fails here, once, with the reason.
    { name: 'fixtures', use: { ...devices['Desktop Chrome'] }, testMatch: /fixtures\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /perf-budget/, dependencies: ['fixtures'] },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testIgnore: /perf-budget/, dependencies: ['fixtures'] },
    // StrictMode replays effects only in React's development build, so these run the focus rows against that one.
    { name: 'strict-fixtures', use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${strictPort}` }, testMatch: /fixtures\.setup\.ts/ },
    { name: 'strict-desktop', use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${strictPort}` }, testMatch: strictSpecs, dependencies: ['strict-fixtures'] },
    { name: 'strict-phone', use: { ...devices['Pixel 7'], baseURL: `http://localhost:${strictPort}` }, testMatch: strictSpecs, dependencies: ['strict-fixtures'] },
    // The performance budget compares timings, so it runs alone: after the other projects have finished, with nothing
    // else in the browser or on the machine competing for the CPU while it measures. In CI it runs with `--no-deps` on
    // a runner of its own.
    { name: 'perf', use: { ...devices['Desktop Chrome'] }, testMatch: /perf-budget/, dependencies: ['desktop', 'phone', 'strict-desktop', 'strict-phone'] },
  ],
});
