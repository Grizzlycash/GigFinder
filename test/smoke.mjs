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
// An explicit context so clipboard permissions can be granted for the feedback check.
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

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

await step('the build is marked noindex', async () => {
  const robots = await page.getAttribute('meta[name=robots]', 'content');
  if (!/noindex/.test(robots || '')) throw new Error(`missing noindex: ${robots}`);
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
  await page.click('[data-genre="Rock"]');
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

await step('the prototype notice states what is not real', async () => {
  await page.waitForSelector('[data-notice-ack]');
  const notice = await page.textContent('[role=dialog]');
  for (const claim of [/No email is ever sent/i, /venues are real, but unverified/i, /lives in this browser/i]) {
    if (!claim.test(notice)) throw new Error(`notice is missing a disclosure: ${claim}`);
  }
  await shot('23-prototype-notice');
  await page.click('[data-notice-ack]');
  await page.waitForTimeout(300);
  if (await page.locator('[data-prototype]').count() === 0) throw new Error('no standing prototype marker');

  // Acknowledged once, not on every page load.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (await page.locator('[data-notice-ack]').count() !== 0) throw new Error('notice reappeared after acknowledgement');
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
  await page.waitForSelector('[data-marker], [data-map-empty]');

  // The venue database ships without coordinates until someone runs the importer with
  // --geocode, so the map legitimately has nothing to plot. Assert whichever state is real
  // rather than failing on a database that simply hasn't been geocoded yet.
  if (await page.locator('[data-map-empty]').count()) {
    console.log('     (no coordinates in the venue data — map empty state)');
    await shot('07-map');
    return;
  }
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
  await page.waitForFunction(() => document.querySelector('[data-body]')?.value.length > 40);
  const body = await page.inputValue('[data-body]');
  if (!body.includes('garage rock')) throw new Error('email body not populated from EPK short bio');
  if (body.includes('{contact}')) throw new Error('placeholder was not substituted for display');
  // Tone presets must actually change the draft
  await page.getByRole('button', { name: 'Warm', exact: true }).click();
  await page.waitForTimeout(300);
  const warm = await page.inputValue('[data-body]');
  if (warm === body) throw new Error('tone preset did not change the draft');
  await shot('10-send');
});

await step('rewrites are Pro-gated on Basic', async () => {
  const disabled = await page.getAttribute('[data-rewrite="tighten"]', 'disabled');
  if (disabled === null) throw new Error('rewrite should be disabled on Basic');
});

await step('the PDF press kit is Pro-gated on Basic', async () => {
  if (await page.locator('[data-kit-edit]').count() !== 0) throw new Error('Basic should not get the kit builder');
  if (!/part of Pro/.test(await page.textContent('[data-send]'))) throw new Error('no upgrade prompt on the attachment step');
});

await step('disclosure never shows the contact', async () => {
  await page.click('[data-disclosure]');
  await page.waitForSelector('[role=dialog]');
  const shown = await page.textContent('[role=dialog]');
  if (/Sarah|Tom |Jess |bookings@/.test(shown)) throw new Error('disclosure leaked contact details');
  await shot('18-disclosure');
  await page.keyboard.press('Escape');
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

await step('rewrites work once on Pro', async () => {
  await page.goto(`${BASE}/#/send`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-body]')?.value.length > 40);
  const before = await page.inputValue('[data-body]');
  await page.click('[data-rewrite="personalise"]');
  await page.waitForTimeout(400);
  const after = await page.inputValue('[data-body]');
  if (after === before) throw new Error('rewrite did not change the draft');
  if (after.includes('{contact}')) throw new Error('placeholder leaked into the visible draft');
  await shot('19-rewrite');
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
  await page.waitForSelector('[data-kit-preview]');
  const kit = await page.textContent('[data-kit-preview]');
  if (!/garage rock/.test(kit)) throw new Error('press kit preview is not built from the EPK bio');
  await shot('14-epk-preview');
  await page.keyboard.press('Escape');
});

await step('press kit — edit the document before it goes out', async () => {
  await page.goto(`${BASE}/#/send`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-kit-edit]');
  await page.click('[data-kit-edit]');
  await page.waitForSelector('[data-kit-section="bio"]');

  // Reword a section, retitle it and drop another — all three must reach the preview.
  await page.getByLabel('Biography text').fill('Rewritten for this booker: loud, hooky, and cheap to book.');
  await page.getByLabel('Biography heading').fill('About the band');
  await page.locator('[data-kit-section="rider"] input[type=checkbox], [data-kit-section="rider"] button[role=checkbox]').first().click();
  await page.waitForTimeout(300);
  await shot('20-press-kit-editor');

  await page.click('[data-kit-preview-open]');
  await page.waitForSelector('[data-kit-preview]');
  const shown = await page.textContent('[data-kit-preview]');
  if (!shown.includes('Rewritten for this booker')) throw new Error('edited copy did not reach the preview');
  if (!shown.includes('About the band')) throw new Error('renamed heading did not reach the preview');
  if (/Technical rider/i.test(shown)) throw new Error('excluded section still printed');
  await shot('21-press-kit-preview');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
});

await step('press kit — downloads a real PDF', async () => {
  const wait = page.waitForEvent('download', { timeout: 60000 });
  await page.click('[data-kit-download]');
  const download = await wait;
  const name = download.suggestedFilename();
  if (!/press-kit\.pdf$/.test(name)) throw new Error(`unexpected filename: ${name}`);

  const file = await download.path();
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('downloaded file is not a PDF');
  if (bytes.length < 8000) throw new Error(`PDF is suspiciously small: ${bytes.length} bytes`);

  // The brand faces have to be embedded, or the kit prints in Helvetica on the booker's machine.
  const raw = bytes.toString('latin1');
  for (const face of ['Anton', 'Inter']) {
    if (!raw.includes(`/BaseFont /${face}`) && !raw.includes(`/BaseFont/${face}`)) {
      throw new Error(`${face} is not embedded in the PDF`);
    }
  }
  if ((raw.match(/\/FontFile2/g) || []).length < 2) throw new Error('font programs are not embedded');
  if (!/Rewritten for this booker/.test(raw) && !raw.includes('FlateDecode')) {
    throw new Error('PDF has neither the edited copy nor compressed streams');
  }
});

await step('the send records what was attached', async () => {
  await page.click('[data-send] button[type=submit]');
  await page.waitForSelector('table, [data-card]', { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.click('[data-open] >> nth=0');
  await page.waitForSelector('[data-attachment]');
  const attached = await page.textContent('[data-attachment]');
  if (!/press-kit\.pdf/.test(attached)) throw new Error('the outreach record does not name the attachment');
  if (!/pages as sent/.test(attached)) throw new Error('the outreach record does not record the page count');
  await shot('22-attachment-on-record');
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

await step('adding a venue warns about an existing one', async () => {
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Back Room');
  await page.fill('#av-city', 'Brunswick');
  await page.waitForSelector('[data-duplicate]', { timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
});

await step('submit a venue to the shared database', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Old Signal Box');
  await page.fill('#av-city', 'Thornbury');
  await page.click('#vis-shared');
  await page.click('[data-add-save]');
  // Held back from the shared list, but the submitter can see it's in review.
  await page.waitForSelector('[data-submission="pending"]', { timeout: 5000 });
  await page.fill('[data-q]', 'Old Signal Box');
  await page.waitForTimeout(400);
  if (await page.locator('.stub').count() !== 0) throw new Error('pending venue leaked into the shared list');
  await shot('15-venue-submissions');
  await page.fill('[data-q]', '');
});

await step('admin declines a submission with a reason', async () => {
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: /admin access/i }).click();
  await page.click('[data-settings] button[type=submit]');
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/#/admin/overview`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Coverage by suburb');
  await shot('16-admin-overview');
  await page.click('a[href="#/admin/submissions"]');
  await page.waitForSelector('[data-review]');
  await page.click('[data-review]');
  await page.waitForSelector('[data-reject-reason]');
  await shot('17-admin-review');
  await page.fill('[data-reject-reason]', 'Already listed as The Signal, Thornbury');
  await page.click('[data-reject]');
  await page.waitForSelector('text=Queue is clear', { timeout: 5000 });
});

await step('the submitter is told why, and can clear it', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-submission="rejected"]');
  const text = await page.locator('[data-submission="rejected"]').innerText();
  if (!text.includes('Already listed as The Signal')) throw new Error('rejection reason not shown to the submitter');
  await page.click('[data-dismiss]');
  await page.waitForTimeout(400);
  if (await page.locator('[data-submission]').count() !== 0) throw new Error('dismissed submission still listed');
});

await step('admin edits a submission, then publishes it', async () => {
  await page.click('[data-add]');
  await page.waitForSelector('#av-name');
  await page.fill('#av-name', 'The Old Signal Box');
  await page.fill('#av-city', 'Thornbury');
  await page.click('#vis-shared');
  await page.click('[data-add-save]');
  await page.waitForSelector('[data-submission="pending"]');

  await page.goto(`${BASE}/#/admin/submissions`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-review]');
  await page.click('[data-review]');
  await page.waitForSelector('#r-name');
  await page.fill('#r-name', 'The Signal Box');
  await page.fill('#r-capacity', '220');
  await page.click('[data-approve]');
  await page.waitForSelector('text=Queue is clear', { timeout: 5000 });

  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.fill('[data-q]', 'Signal Box');
  await page.waitForTimeout(400);
  if (await page.locator('.stub').count() !== 1) throw new Error('approved venue is not in the shared list');
  if (await page.locator('[data-submission]').count() !== 0) throw new Error('approved venue is still shown as a submission');
  await page.fill('[data-q]', '');
});

await step('admin — CSV import', async () => {
  await page.goto(`${BASE}/#/admin/import`, { waitUntil: 'networkidle' });
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
  await shot('18-admin-venues');
});

await step('the send screen says nothing is actually emailed', async () => {
  await page.goto(`${BASE}/#/send`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-simulated]');
  const warning = await page.textContent('[data-simulated]');
  if (!/Nothing is actually emailed/i.test(warning)) throw new Error('send screen does not disclose the simulation');
});

await step('a tester can export their round', async () => {
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  const wait = page.waitForEvent('download', { timeout: 30000 });
  await page.click('[data-export-state]');
  const download = await wait;
  const dump = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  if (dump.app !== 'gigfinder') throw new Error('export is not tagged as a GigFinder file');
  if (!Array.isArray(dump.state?.venues) || !dump.state.venues.length) throw new Error('export carries no venues');
  if (!dump.state.outreach.length) throw new Error('export carries no outreach — the point is seeing what they did');
});

await step('feedback captures the screen it was raised on', async () => {
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('[data-feedback]');
  await page.waitForTimeout(400);
  const report = await page.evaluate(() => navigator.clipboard.readText());
  if (!/#\/venues/.test(report)) throw new Error(`report does not name the screen: ${report}`);
  if (!/Browser:/.test(report)) throw new Error('report carries no diagnostics');
});

await step('admin can clear the sample venues for good', async () => {
  await page.goto(`${BASE}/#/admin/venues`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-remove-samples]');
  page.once('dialog', (d) => d.accept());
  await page.click('[data-remove-samples]');
  await page.waitForTimeout(600);
  if (await page.locator('[data-remove-samples]').count() !== 0) throw new Error('sample venues survived the purge');

  // The seed used to be topped back up on every load — deletion has to stick.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const resurrected = await page.evaluate(
    () => JSON.parse(localStorage.getItem('gigfinder:v1')).venues.filter((v) => v.source === 'seed').length,
  );
  if (resurrected !== 0) throw new Error(`${resurrected} sample venues came back after reload`);
  await shot('24-samples-cleared');
});

await step('mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/venues`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stub');
  await shot('19-mobile-venues');
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
