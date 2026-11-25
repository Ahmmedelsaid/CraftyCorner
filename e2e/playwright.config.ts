import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the shop and the owner dashboard. They need the site and the API running:
 *
 *   - CI / Docker image:  E2E_BASE_URL=http://localhost:5034   (the site and /api on one address)
 *   - local dev servers:  E2E_BASE_URL=http://localhost:4200  E2E_API_URL=http://localhost:5034/api
 *
 * The dashboard is a separate Angular app. Set E2E_START_ADMIN=1 to let Playwright serve its production build
 * (run `npx ng build admin` first) on port 4201, forwarding /api to E2E_API_ORIGIN (default http://localhost:5034).
 * Without it, point E2E_ADMIN_URL at a dashboard that is already running (for example `ng serve admin`).
 * E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are the owner account; without them the dashboard tests are skipped.
 *
 * Projects: customer (desktop), mobile (a phone), admin (desktop) and admin-mobile.
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const adminURL = process.env['E2E_ADMIN_URL'] ?? 'http://localhost:4201';

export default defineConfig({
  testDir: './tests',
  // one flow after another: they share one database
  workers: 1,
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // CI installs Playwright's Chromium; on a developer machine the installed Chrome is enough
    channel: process.env['CI'] ? undefined : (process.env['E2E_CHANNEL'] ?? 'chrome'),
  },
  projects: [
    {
      name: 'customer',
      testMatch: /(shop|checkout-map)\.spec\.ts/,
      use: { baseURL },
    },
    {
      name: 'mobile',
      // not admin-mobile.spec.ts, which belongs to the dashboard project below
      testMatch: /tests[\\/]mobile\.spec\.ts$/,
      use: { ...devices['Pixel 5'], baseURL },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      use: { baseURL: adminURL },
    },
    {
      name: 'admin-mobile',
      testMatch: /admin-mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'], baseURL: adminURL },
    },
  ],
  webServer: process.env['E2E_START_ADMIN']
    ? {
        // the web server starts in the folder of this file, so the path is relative to it
        command: 'node serve-admin.mjs',
        url: adminURL,
        reuseExistingServer: true,
        timeout: 240_000,
      }
    : undefined,
});
