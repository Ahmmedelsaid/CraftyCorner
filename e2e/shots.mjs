// Takes screenshots of public pages for a quick visual check (nothing is created or changed):
//   node e2e/shots.mjs /contact /register
import { chromium } from '@playwright/test';

const base = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const out = process.env.SHOTS_DIR ?? 'test-results/shots';
const paths = process.argv.slice(2).map((p) => (p.startsWith('/') ? p : '/' + p.replace(/^.*Git/, '')));

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome' });
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['phone', { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport, locale: 'en-US', reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('craftycorner.lang', 'en'));
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const file = `${out}/${path.replaceAll('/', '_') || 'home'}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await context.close();
}
await browser.close();
