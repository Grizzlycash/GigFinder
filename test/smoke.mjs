// End-to-end smoke test: drives the whole product in a real browser and fails on any
// console/page error. Run with `npm test`.
//
// It starts its own static server and shuts it down afterwards. Screenshots of every
// major screen land in test/screenshots/ (gitignored) — useful for eyeballing a change.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 4178);
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, 'test', 'screenshots');

/* ---------- Playwright: local install, or the one on PATH ---------- */
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    // Fall back to a global install (some sandboxes ship one).
    for (const dir of ['/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
      const entry = path.join(dir, 'playwright', 'index.mjs');
      if (fs.existsSync(entry)) return (await import(entry)).chromium;
    }
    console.error('Playwright not found. Install it with:  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
  return null;
}

/* ---------- Static server ---------- */
async function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js'), String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start on ${BASE}`);
}

/* ---------- Runner ---------- */
const chromium = await loadChromium();
fs.mkdirSync(SHOTS, { recursive: true });
const server = await startServer();

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const step = async (label, fn) => {
  try { await fn(); console.log(`ok   ${label}`); }
  catch (e) { console.log(`FAIL ${label}: ${e.message}`); errors.push(`${label}: ${e.message}`); }
};
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

await step('landing loads', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.auth-hero h1');
  await shot('01-landing');
});

await step('sign up', async () => {
  await page.fill('#su-artist', 'The Paper Lanterns');
  await page.fill('#su-email', 'alex@example.com');
  await page.click('[data-form="signup"] button[type=submit]');
  await page.waitForSelector('.onboard');
});

await step('onboarding 1 — profile', async () => {
  await page.fill('#ob-real', 'Alex Rivera');
  await page.fill('#ob-city', 'Nashville');
  await page.fill('#ob-state', 'TN');
  await page.click('[data-genre="Americana"]');
  await page.click('[data-genre="Folk"]');
  await shot('02-onboarding-profile');
  await page.click('[data-step-form] button[type=submit]');
  await page.waitForSelector('#ob-spotify');
});

await step('onboarding 2 — links', async () => {
  await page.fill('#ob-spotify', 'https://open.spotify.com/artist/demo');
  await page.fill('#ob-youtube', 'https://youtube.com/watch?v=demo');
  await page.click('[data-step-form] button[type=submit]');
  await page.waitForSelector('#ob-short');
});

await step('onboarding 3 — short bio', async () => {
  await page.fill('#ob-tagline', 'Close-harmony Americana from East Nashville');
  await page.fill('#ob-short', 'The Paper Lanterns are a four-piece from Nashville playing close-harmony Americana. We released our second EP in March, draw 80-120 in market, and are routing the Southeast this autumn.');
  await shot('03-onboarding-bio');
  await page.click('[data-step-form] button[type=submit]');
  await page.waitForSelector('[data-plans]');
});

await step('onboarding 4 — plan', async () => {
  await page.click('[data-cycle] [data-c="annual"]');
  await page.waitForSelector('[data-plans]');
  await shot('04-onboarding-plan');
  await page.click('[data-step-form] button[type=submit]');
  await page.waitForSelector('.shell');
});

await step('dashboard', async () => {
  await page.waitForSelector('.stat-value');
  const greeting = await page.textContent('.topbar h1');
  if (!/Good (morning|afternoon|evening), Alex/.test(greeting)) throw new Error(`unexpected greeting: ${greeting}`);
  await shot('05-dashboard');
});

await step('venues — split view, filters, detail', async () => {
  await page.click('a[href="#/venues"]');
  await page.waitForSelector('.lrow');
  await page.waitForSelector('.detail-head');           // detail auto-selects the first row
  await page.fill('[data-q]', 'nashville');
  await page.waitForTimeout(400);
  if (await page.locator('.lrow').count() === 0) throw new Error('search returned no venues');
  await page.fill('[data-q]', '');
  await page.waitForTimeout(400);
  await page.click('[data-filter="size"][data-value="mid"]');
  await page.waitForTimeout(250);
  await page.click('[data-filter="size"][data-value="mid"]');  // toggle back off
  await page.waitForTimeout(250);
  await page.click('.lrow >> nth=3');
  await page.waitForSelector('.detail-head');
  await shot('06-venues');
});

await step('map — pins, panel, nearby', async () => {
  await page.click('a[href="#/map"]');
  await page.waitForSelector('.map-marker');
  await page.click('.map-marker >> nth=0');
  await page.waitForSelector('.map-panel-actions');     // pins must actually be selectable
  if (await page.locator('[data-pick]').count() === 0) throw new Error('nearby venues missing');
  await shot('07-map');
});

await step('EPK generator — Basic sees the Pro sections locked', async () => {
  await page.click('a[href="#/epk"]');
  await page.waitForSelector('.card');
  await page.click('a[href^="#/epk/epk_"]');
  await page.waitForSelector('#e-title');
  await page.fill('#e-tag', 'Four-part harmony, three chords, one van');
  await page.click('[data-save]');
  await page.waitForTimeout(200);
  await shot('08-epk-bio');
  await page.click('[data-section="2"]');
  await page.waitForSelector('.locked');
  await shot('09-epk-locked');
});

await step('send flow — body auto-filled from the short bio', async () => {
  await page.goto(`${BASE}/#/send`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-send]');
  const body = await page.inputValue('[data-body]');
  if (!body.includes('close-harmony Americana')) throw new Error('email body not populated from EPK short bio');
  await shot('10-send');
  await page.click('[data-send] button[type=submit]');
  await page.waitForSelector('.board, .empty');
});

await step('tracker — board and table', async () => {
  await page.waitForSelector('.board-card');
  await page.click('[data-mode="table"]');
  await page.waitForSelector('table.table');
  await page.selectOption('[data-status]', 'replied');
  await page.waitForTimeout(200);
  await page.click('[data-mode="board"]');
  await page.waitForSelector('.board');
});

await step('sample pipeline', async () => {
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.click('[data-demo]');
  await page.waitForSelector('.board-card');
  await shot('11-tracker');
});

await step('pricing — annual maths, upgrade to Pro', async () => {
  await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.price-card');
  if (await page.getAttribute('[data-cycle]', 'aria-checked') !== 'true') {
    await page.click('[data-cycle]');
    await page.waitForTimeout(250);
  }
  const price = await page.textContent('.price-card.featured .price-amount');
  if (!price.includes('15.99')) throw new Error(`annual Pro price wrong: ${price}`);
  await shot('12-pricing');
  await page.click('[data-choose="pro"]');
  await page.waitForTimeout(300);
});

await step('EPK generator unlocked on Pro', async () => {
  await page.goto(`${BASE}/#/epk`, { waitUntil: 'networkidle' });
  await page.click('a[href^="#/epk/epk_"]');
  await page.waitForSelector('.epk-rail');
  await page.click('[data-section="2"]');
  await page.waitForSelector('[data-link="music.spotify"]');
  await page.fill('[data-link="music.soundcloud"]', 'soundcloud.com/paperlanterns');
  await page.click('[data-add-track]');
  await page.fill('[data-track-title="0"]', 'Wire and Wick');
  await page.fill('[data-track-url="0"]', 'https://open.spotify.com/track/demo');
  await page.click('[data-save]');
  await page.waitForTimeout(250);
  await shot('13-epk-music');
  await page.click('[data-section="4"]');
  await page.waitForSelector('#r-format');
  await page.click('[data-preview]');
  await page.waitForSelector('.modal');
  await shot('14-epk-preview');
  await page.click('[data-modal-close]');
});

await step('saved lists (Pro)', async () => {
  await page.goto(`${BASE}/#/lists`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.empty, .card');
});

await step('add a private venue', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Back Room');
  await page.fill('#av-city', 'Nashville');
  await page.fill('#av-state', 'TN');
  await page.click('[data-add-save]');
  // Saving navigates to the new venue — wait for the re-render, not the stale DOM.
  await page.waitForFunction(
    () => document.querySelector('.split-list-head')?.textContent.includes('Private:'),
    null, { timeout: 5000 },
  );
});

await step('submit a venue to the shared database', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Old Signal Box');
  await page.fill('#av-city', 'Athens');
  await page.fill('#av-state', 'GA');
  await page.check('input[name="visibility"][value="shared"]');
  await page.click('[data-add-save]');
  await page.waitForTimeout(300);
});

await step('admin — submissions queue', async () => {
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.check('input[name="isAdmin"]');
  await page.click('[data-settings] button[type=submit]');
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/#/admin/overview`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell-admin .stat-value');
  await shot('15-admin-overview');
  await page.click('a[href="#/admin/submissions"]');
  await page.waitForSelector('[data-approve]');
  await page.click('[data-approve]');
  await page.waitForTimeout(300);
});

await step('admin — CSV import', async () => {
  await page.click('a[href="#/admin/import"]');
  await page.waitForSelector('#csv-paste');
  await page.fill('#csv-paste', 'Venue,City,State,Capacity,Booking Email,Genres,Latitude,Longitude\nThe Rusted Kettle,Portland,OR,180,booking@rusted.example.com,Indie; Folk,45.52,-122.68');
  await page.click('[data-parse-paste]');
  await page.waitForSelector('[data-run-import]');
  await page.click('[data-run-import]');
  await page.waitForTimeout(400);
  await page.click('a[href="#/admin/venues"]');
  await page.fill('[data-q]', 'Rusted');
  await page.waitForTimeout(400);
  if (await page.locator('table.table tbody tr').count() !== 1) throw new Error('imported venue not found');
  await shot('16-admin-venues');
});

await step('mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stat-value');
  await shot('17-mobile');
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  if (scrollW > clientW + 2) throw new Error(`horizontal overflow on mobile: ${scrollW} > ${clientW}`);
  await page.setViewportSize({ width: 1440, height: 950 });
});

await browser.close();
server.kill();

console.log('\n--- console/page errors ---');
console.log(errors.length ? errors.join('\n') : 'none');
console.log(`\nScreenshots: ${SHOTS}`);
process.exit(errors.length ? 1 : 0);
