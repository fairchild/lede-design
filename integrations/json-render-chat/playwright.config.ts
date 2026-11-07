import { defineConfig, devices } from '@playwright/test';

// The chat in a browser, with the scripted replies: what a person does and where focus goes. Port 4881 is this entry's
// preview port, and the build is fresh each run.
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.e2e.ts',
  workers: 2,
  use: { baseURL: 'http://localhost:4881', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run tokens && vite build && vite preview --port 4881 --strictPort', url: 'http://localhost:4881', reuseExistingServer: false },
});
