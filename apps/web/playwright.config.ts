import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real stack: built web app + API + PostgreSQL.
 *
 *   CI:    the workflow builds everything, migrates and seeds, then this config
 *          starts the API (NODE_ENV=test: dev helpers on, rate limit off) and
 *          `next start`.
 *   Local: run `arrancar.bat` first; the servers already running are reused.
 *
 * The web build must have NEXT_PUBLIC_DEV_TOOLS=true so the simulated email
 * outbox, KYC and payment buttons exist.
 */
const WEB = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: WEB,
    locale: 'en-US',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node ../api/dist/main.js',
          url: `${API}/health/live`,
          env: { NODE_ENV: 'test', CHAIN_WORKER_INTERVAL_MS: '0' },
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: 'pnpm start --hostname 127.0.0.1',
          url: WEB,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
