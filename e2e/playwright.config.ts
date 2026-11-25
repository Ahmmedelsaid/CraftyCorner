import { defineConfig } from '@playwright/test';

/**
 * Browser tests for the main path of the shop. They need the site and the API to be running:
 *
 *   - CI / Docker image:  E2E_BASE_URL=http://localhost:8080   (the site and /api on one address)
 *   - local dev servers:  E2E_BASE_URL=http://localhost:4200  E2E_API_URL=http://localhost:5034/api
 *
 * E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD let the tests act as the shop owner (mark an order delivered,
 * add tracking). Without them those tests are skipped.
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './tests',
  // one flow after another: they share one database and one cart per user
  workers: 1,
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // CI installs Playwright's Chromium; on a developer machine the installed Chrome is enough
    channel: process.env['CI'] ? undefined : (process.env['E2E_CHANNEL'] ?? 'chrome'),
  },
});
