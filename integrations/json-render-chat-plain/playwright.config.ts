import { defineConfig, devices } from '@playwright/test';
import { fakeLog } from './tests/fake-log';

// The chat in a browser. `mock` runs the scripted replies on this entry's preview port, 4871. `real` runs the build
// that posts to /api/chat, on 4873, through the preview's proxy to server/chat.ts on 4877, which calls a fake
// Anthropic on 4875 with a fake key. Each build is fresh each run.
const server = { ANTHROPIC_API_KEY: 'fake', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4875/v1', PORT: '4877' };

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.e2e.ts',
  workers: 2,
  projects: [
    { name: 'mock', testIgnore: 'real.e2e.ts', use: { baseURL: 'http://localhost:4871', ...devices['Desktop Chrome'] } },
    { name: 'real', testMatch: 'real.e2e.ts', use: { baseURL: 'http://localhost:4873', ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    { command: 'vite build && vite preview --port 4871 --strictPort', url: 'http://localhost:4871', reuseExistingServer: false },
    { command: 'tsx tests/fake-anthropic.ts', env: { FAKE_PORT: '4875', FAKE_LOG: fakeLog }, port: 4875, reuseExistingServer: false },
    { command: 'tsx server/chat.ts', env: server, port: 4877, reuseExistingServer: false },
    {
      command: 'VITE_CHAT_API=/api/chat vite build --outDir dist-real && vite preview --outDir dist-real --port 4873 --strictPort',
      env: { PORT: '4877' },
      url: 'http://localhost:4873',
      reuseExistingServer: false,
    },
  ],
});
