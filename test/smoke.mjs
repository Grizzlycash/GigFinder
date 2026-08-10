// End-to-end smoke test: builds the app, drives the whole product in a real browser,
// and fails on any console or page error. Run with `npm test`.
//
// Screenshots of every major screen land in test/screenshots/ (gitignored) — useful for
// eyeballing a design change against the brief.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 4178);
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, 'test', 'screenshots');

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    for (const dir of ['/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
      const entry = path.join(dir, 'playwright', 'index.mjs');
      if (fs.existsSync(entry)) return (await import(entry)).chromium;
    }
    console.error('Playwright not found. Install it with:  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
  return null;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function startPreview() {
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`preview server did not start on ${BASE}`);
}

/* ---------- Radix helpers: these are buttons + portals, not native controls ---------- */
async function pickSelect(page, triggerSelector, optionText) {
  await page.click(triggerSelector);
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

console.log('building…');
await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);

const chromium = await loadChromium();
fs.mkdirSync(SHOTS, { recursive: true });
const server = await startPreview();

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
  await page.waitForSelector('#su-artist');
  await shot('01-landing');
});

await step('sign up', async () => {
  await page.fill('#su-artist', 'The Rustlers');
  await page.fill('#su-email', 'alex@example.com');
  await page.click('form:has(#su-artist) button[type=submit]');
  await page.waitForSelector('[data-step-form]');
});

await step('onboarding 1 — profile', async () => {
  await page.fill('#ob-real', 'Alex Rivera');
  await page.fill('#ob-city', 'Brunswick');
  await page.click('[data-genre="Punk"]');
  await page.click('[data-genre="Garage"]');
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
  await page.fill('#ob-tagline', 'Grimy four-piece garage rock out of Brunswick');
  await page.fill('#ob-short', 'The Rustlers are a four-piece from Brunswick playing loud, hooky garage rock. Second EP out in March, we pull 80-120 in-market, and we are putting a Victorian run together for spring.');
  await shot('03-onboarding-bio');
  await page.click('[data-step-form] button[type=submit]');
  await page.waitForSelector('[data-plan="pro"]');
});

await step('onboarding 4 — plan', async () => {
  await shot('04-onboarding-plan');
  await page.click('[data-step-form] button[type=submit]');
  await page.waitForSelector('[data-tile]');
});

await step('dashboard', async () => {
  const greeting = await page.textContent('header h1');
  if (!/(Morning|Afternoon|Evening), Alex/.test(greeting)) throw new Error(`unexpected greeting: ${greeting}`);
  await shot('05-dashboard');
});

await step('venues — flash sheet, filters, detail', async () => {
  await page.click('a[href="#/venues"]');
  await page.waitForSelector('.stub');
  await page.fill('[data-q]', 'fitzroy');
  await page.waitForTimeout(300);
  if (await page.locator('.stub').count() === 0) throw new Error('search returned no venues');
  await page.fill('[data-q]', '');
  await page.waitForTimeout(300);
  await page.click('[data-filter="size"][data-value="mid"]');
  await page.waitForTimeout(200);
  await page.click('[data-filter="size"][data-value="mid"]');
  await page.waitForTimeout(200);
  await page.click('.stub >> nth=2');
  await page.waitForTimeout(300);
  await shot('06-venues');
});

await step('map — pins are selectable', async () => {
  await page.click('a[href="#/map"]');
  await page.waitForSelector('[data-marker]');
  await page.click('[data-marker] >> nth=0');
  await page.waitForSelector('[data-panel]');
  if (await page.locator('[data-pick]').count() === 0) throw new Error('nearby rooms missing');
  await shot('07-map');
});

await step('EPK — Basic sees the Pro sections locked', async () => {
  await page.click('a[href="#/epk"]');
  await page.waitForSelector('a[href^="#/epk/epk_"]');
  await page.click('a[href^="#/epk/epk_"]');
  await page.waitForSelector('#e-title');
  await page.fill('#e-tag', 'Three chords, one van');
  await page.click('[data-save]');
  await page.waitForTimeout(200);
  await shot('08-epk-bio');
  await page.click('[data-section="2"]');
  await page.waitForSelector('text=part of the Pro generator');
  await shot('09-epk-locked');
});

await step('email generator — body from the short bio', async () => {
  await page.goto(`${BASE}/#/send`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-send]');
  const body = await page.inputValue('[data-body]');
  if (!body.includes('garage rock')) throw new Error('email body not populated from EPK short bio');
  // Tone presets must actually change the draft
  await page.getByRole('button', { name: 'Warm', exact: true }).click();
  await page.waitForTimeout(200);
  const warm = await page.inputValue('[data-body]');
  if (warm === body) throw new Error('tone preset did not change the draft');
  await shot('10-send');
  await page.click('[data-send] button[type=submit]');
  await page.waitForSelector('table, [data-card]');
});

await step('tracker — table, status change', async () => {
  await page.waitForSelector('[data-status]');
  await pickSelect(page, '[data-status] >> nth=0', 'Replied');
  await page.waitForTimeout(300);
  await page.click('[data-mode="board"]');
  await page.waitForSelector('[data-col]');
  await page.click('[data-mode="table"]');
  await page.waitForSelector('table');
});

await step('sample pipeline', async () => {
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.click('[data-demo]');
  await page.waitForSelector('table');
  await shot('11-tracker');
});

await step('pricing — annual maths, upgrade to Pro', async () => {
  await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-choose="pro"]');
  if (await page.getAttribute('[data-cycle]', 'aria-checked') !== 'true') {
    await page.click('[data-cycle]');
    await page.waitForTimeout(250);
  }
  const text = await page.textContent('[data-choose="pro"] >> xpath=ancestor::div[contains(@class,"border-2")]');
  if (!text.includes('15.99')) throw new Error('annual Pro price wrong');
  await shot('12-pricing');
  await page.click('[data-choose="pro"]');
  await page.waitForTimeout(300);
});

await step('EPK generator unlocked on Pro', async () => {
  await page.goto(`${BASE}/#/epk`, { waitUntil: 'networkidle' });
  await page.click('a[href^="#/epk/epk_"]');
  await page.waitForSelector('[data-section="2"]');
  await page.click('[data-section="2"]');
  await page.waitForSelector('[data-link="music.spotify"]');
  await page.fill('[data-link="music.soundcloud"]', 'soundcloud.com/therustlers');
  await page.click('[data-add-track]');
  await page.fill('[data-track-title="0"]', 'Wire and Wick');
  await page.fill('[data-track-url="0"]', 'https://open.spotify.com/track/demo');
  await page.click('[data-save]');
  await page.waitForTimeout(250);
  await shot('13-epk-music');
  await page.click('[data-section="4"]');
  await page.waitForSelector('#r-format');
  await page.click('[data-preview]');
  await page.waitForSelector('[role=dialog]');
  await shot('14-epk-preview');
  await page.keyboard.press('Escape');
});

await step('add a private venue', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Back Room');
  await page.fill('#av-city', 'Brunswick');
  await page.click('[data-add-save]');
  await page.waitForFunction(
    () => document.body.textContent.includes('private'),
    null, { timeout: 5000 },
  );
});

await step('submit a venue to the shared database', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Old Signal Box');
  await page.fill('#av-city', 'Thornbury');
  await page.click('#vis-shared');
  await page.click('[data-add-save]');
  await page.waitForTimeout(400);
});

await step('admin — submissions queue', async () => {
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: /admin access/i }).click();
  await page.click('[data-settings] button[type=submit]');
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/#/admin/overview`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Coverage by suburb');
  await shot('15-admin-overview');
  await page.click('a[href="#/admin/submissions"]');
  await page.waitForSelector('[data-approve]');
  await page.click('[data-approve]');
  await page.waitForTimeout(300);
});

await step('admin — CSV import', async () => {
  await page.click('a[href="#/admin/import"]');
  await page.waitForSelector('#csv-paste');
  await page.fill('#csv-paste', 'Venue,Suburb,Capacity,Booking Email,Genres,Latitude,Longitude\nThe Rusted Kettle,Northcote,180,bookings@rusted.example.com,Indie; Folk,-37.77,145.00');
  await page.click('[data-parse-paste]');
  await page.waitForSelector('[data-run-import]');
  await page.click('[data-run-import]');
  await page.waitForTimeout(400);
  await page.click('a[href="#/admin/venues"]');
  await page.fill('[data-q]', 'Rusted Kettle');
  await page.waitForTimeout(400);
  if (await page.locator('table tbody tr').count() !== 1) throw new Error('imported venue not found');
  await shot('16-admin-venues');
});

await step('mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stub');
  await shot('17-mobile-venues');
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  if (scrollW > clientW + 2) throw new Error(`horizontal overflow on mobile: ${scrollW} > ${clientW}`);
  await page.setViewportSize({ width: 1440, height: 950 });
});

await step('keyboard focus is visible', async () => {
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { width: cs.outlineWidth, style: cs.outlineStyle };
  });
  if (!outline || outline.style === 'none' || parseFloat(outline.width) < 1) {
    throw new Error(`no visible focus ring: ${JSON.stringify(outline)}`);
  }
});

await browser.close();
server.kill();

console.log('\n--- console/page errors ---');
console.log(errors.length ? errors.join('\n') : 'none');
console.log(`\nScreenshots: ${SHOTS}`);
process.exit(errors.length ? 1 : 0);
