import { defineConfig, devices } from '@playwright/test';
import { fakeLog } from './tests/fake-log';

// The chat in a browser. `mock` runs the scripted replies on this entry's preview port, 4881. `real` runs the build
// that posts to /api/chat, on 4883, through the preview's proxy to server/chat.ts on 4887, which calls a fake
// Anthropic on 4885 with a fake key. Each build is fresh each run.
const server = { ANTHROPIC_API_KEY: 'fake', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4885/v1', PORT: '4887' };

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.e2e.ts',
  workers: 2,
  projects: [
    { name: 'mock', testIgnore: 'real.e2e.ts', use: { baseURL: 'http://localhost:4881', ...devices['Desktop Chrome'] } },
    { name: 'real', testMatch: 'real.e2e.ts', use: { baseURL: 'http://localhost:4883', ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    { command: 'npm run tokens && vite build && vite preview --port 4881 --strictPort', url: 'http://localhost:4881', reuseExistingServer: false },
    { command: 'tsx tests/fake-anthropic.ts', env: { FAKE_PORT: '4885', FAKE_LOG: fakeLog }, port: 4885, reuseExistingServer: false },
    { command: 'tsx server/chat.ts', env: server, port: 4887, reuseExistingServer: false },
    {
      command: 'VITE_CHAT_API=/api/chat vite build --outDir dist-real && vite preview --outDir dist-real --port 4883 --strictPort',
      env: { PORT: '4887' },
      url: 'http://localhost:4883',
      reuseExistingServer: false,
    },
  ],
});
