import { defineConfig, devices } from '@playwright/test';
import { fakeLog } from './tests/fake-log';

// The chat in a browser. `mock` runs the scripted replies on this entry's preview port, 4881. `real` runs the build
// that posts to /api/chat, on 4883, through the preview's proxy to server/chat.ts on 4887, which calls a fake
// Anthropic on 4885 with a fake key. Each build is fresh each run. `PW_PORT` moves all four, from the mock's port up,
// to run beside a server that holds them.
const base = Number(process.env.PW_PORT ?? 4881);
const [mock, real, fake, api] = [base, base + 2, base + 4, base + 6];
const server = { ANTHROPIC_API_KEY: 'fake', ANTHROPIC_BASE_URL: `http://127.0.0.1:${fake}/v1`, PORT: `${api}` };

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.e2e.ts',
  workers: 2,
  projects: [
    { name: 'mock', testIgnore: 'real.e2e.ts', use: { baseURL: `http://localhost:${mock}`, ...devices['Desktop Chrome'] } },
    { name: 'real', testMatch: 'real.e2e.ts', use: { baseURL: `http://localhost:${real}`, ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    { command: `npm run tokens && vite build && vite preview --port ${mock} --strictPort`, url: `http://localhost:${mock}`, reuseExistingServer: false },
    { command: 'tsx tests/fake-anthropic.ts', env: { FAKE_PORT: `${fake}`, FAKE_LOG: fakeLog }, port: fake, reuseExistingServer: false },
    { command: 'tsx server/chat.ts', env: server, port: api, reuseExistingServer: false },
    {
      command: `VITE_CHAT_API=/api/chat vite build --outDir dist-real && vite preview --outDir dist-real --port ${real} --strictPort`,
      env: { PORT: `${api}` },
      url: `http://localhost:${real}`,
      reuseExistingServer: false,
    },
  ],
});
