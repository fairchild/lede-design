import { defineConfig, devices } from '@playwright/test';

// Screenshots of each look in light and dark (visual/looks.spec.ts), against a build already in dist/:
// npm run build && VISUAL=record npx playwright test -c playwright.visual.config.ts
// `record` writes the baseline to VISUAL_BASELINE_DIR, `compare` reads it there. .github/workflows/visual.yml records on
// develop and compares on pull requests. Locally, record once on develop, then compare on your branch.
const mode = process.env.VISUAL;
if (mode && mode !== 'record' && mode !== 'compare') throw new Error('VISUAL is record or compare');
const port = Number(process.env.PW_PORT || 4400);

export default defineConfig({
  testDir: 'visual',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['list'], ['json', { outputFile: 'visual-results.json' }]] : 'list',
  // A missing baseline fails a comparison rather than being written, so a pull request never becomes its own baseline.
  updateSnapshots: mode === 'record' ? 'all' : 'none',
  snapshotPathTemplate: `${process.env.VISUAL_BASELINE_DIR || 'visual-baseline'}/{arg}{ext}`,
  use: {
    baseURL: `http://localhost:${port}`,
    reducedMotion: 'reduce',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: `npx vite preview --port ${port} --strictPort`, port, reuseExistingServer: false },
  projects: [{ name: 'visual', use: { ...devices['Desktop Chrome'] } }],
});
