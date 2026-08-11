// Unit tests for the drafting seam. Run via `npm test` (before the browser suite).
//
// The first block is the important one: it asserts the booking contact's name and
// email address cannot reach a model provider. If someone adds a field to the payload
// without thinking, these fail.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPayload, localCompose, localRewrite, redactContact, applyContact,
  draftEmail, setDraftProvider, hasDraftProvider, previewTransmission,
  CONTACT_PLACEHOLDER,
} from '../src/lib/draft.js';

const USER = {
  artistName: 'The Rustlers',
  realName: 'Alex Rivera',
  drawSize: '50–100',
  homeCity: 'Brunswick',
  genres: ['Punk', 'Garage'],
};

const VENUE = {
  name: 'The Rusted Anchor',
  city: 'Fitzroy',
  type: 'Band Room',
  capacity: 220,
  genres: ['Punk', 'Garage', 'Post-punk'],
  notes: 'Books 6-8 weeks out. Email only, no phone calls.',
  payType: 'Door split 70/30',
  contactName: 'Sarah Liu',
  contactEmail: 'bookings@the-rusted-anchor.example.com',
  website: 'https://the-rusted-anchor.example.com',
};

const EPK = {
  shortBio: 'The Rustlers are a four-piece from Brunswick playing loud, hooky garage rock.',
  notable: 'Supported Amyl at the Corner.',
  genres: ['Punk', 'Garage'],
  homeCity: 'Brunswick',
  setLength: '45 minutes',
  music: { spotify: 'https://open.spotify.com/artist/demo', youtube: 'https://youtu.be/demo' },
  tracks: [{ title: 'Wire and Wick', url: 'https://open.spotify.com/track/demo' }],
};

/* ---------------- the privacy boundary ---------------- */

test('payload excludes the booking contact entirely', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const serialised = JSON.stringify(payload);

  assert.ok(!serialised.includes('Sarah'), 'contact first name leaked into the payload');
  assert.ok(!serialised.includes('Liu'), 'contact surname leaked into the payload');
  assert.ok(!serialised.includes('bookings@'), 'contact email leaked into the payload');
  assert.ok(!serialised.includes('example.com'), 'a venue email or URL leaked into the payload');

  assert.equal(payload.venue.contactName, undefined);
  assert.equal(payload.venue.contactEmail, undefined);
});

test('payload still carries what a model actually needs', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  assert.equal(payload.artist.name, 'The Rustlers');
  assert.equal(payload.venue.name, 'The Rusted Anchor');
  assert.equal(payload.venue.capacity, 220);
  assert.match(payload.bio, /garage rock/);
  assert.equal(payload.venue.bookingNotes, VENUE.notes);
});

test('the composed draft carries a placeholder, never a real name', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const text = localCompose({ payload, tone: 'warm' });
  assert.ok(text.includes(CONTACT_PLACEHOLDER), 'draft should contain the contact placeholder');
  assert.ok(!text.includes('Sarah'), 'draft should not contain the contact name');
  assert.equal(applyContact(text, 'Sarah Liu').split('\n')[0], 'Hi Sarah,');
});

test('an edited draft is re-redacted before it goes anywhere', () => {
  const edited = 'Hi Sarah,\n\nSarah, we would love a date. Thanks — Alex';
  const redacted = redactContact(edited, 'Sarah Liu');
  assert.ok(!redacted.includes('Sarah'), 'the contact name survived redaction');
  assert.equal((redacted.match(/\{contact\}/g) || []).length, 2);
});

test('previewTransmission shows exactly what would leave the device', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const preview = previewTransmission({
    payload, action: 'tighten', text: 'Hi Sarah, we are keen.', contactName: 'Sarah Liu',
  });
  assert.ok(!JSON.stringify(preview).includes('Sarah'));
});

/* ---------------- drafting behaviour ---------------- */

test('tone presets change the draft', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const straight = localCompose({ payload, tone: 'straight' });
  const warm = localCompose({ payload, tone: 'warm' });
  const short = localCompose({ payload, tone: 'short' });
  assert.notEqual(straight, warm);
  assert.notEqual(straight, short);
  assert.ok(short.length < straight.length, 'the short tone should be shorter');
});

test('local rewrites actually change the text', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const base = 'Hi {contact},\n\nWe are just really a very good band. We play loud. We tour often.\n\nListen: https://x.example\n\nThanks for your time,\nAlex';

  const tightened = localRewrite({ text: base, action: 'tighten', payload });
  assert.ok(!/\bjust\b|\breally\b|\bvery\b/.test(tightened), 'filler words should be gone');

  const warmer = localRewrite({ text: base, action: 'warmer', payload });
  assert.ok(warmer.includes('The Rusted Anchor'), 'the warm opener should name the room');
  assert.equal(localRewrite({ text: warmer, action: 'warmer', payload }), warmer, 'warming twice should be a no-op');

  const shortened = localRewrite({ text: base, action: 'shorten', payload });
  assert.ok(shortened.length < base.length);
  assert.ok(shortened.includes('https://x.example'), 'shortening should keep the link');

  const personalised = localRewrite({ text: base, action: 'personalise', payload });
  assert.ok(personalised.length > base.length);
});

test('rewrites preserve the contact placeholder', () => {
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const base = localCompose({ payload, tone: 'straight' });
  for (const action of ['tighten', 'warmer', 'shorten', 'personalise']) {
    const out = localRewrite({ text: base, action, payload });
    assert.ok(out.includes(CONTACT_PLACEHOLDER), `${action} dropped the placeholder`);
  }
});

/* ---------------- provider hook ---------------- */

test('with no provider, drafting stays local', async () => {
  setDraftProvider(null);
  assert.equal(hasDraftProvider(), false);
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const { source } = await draftEmail({ payload, tone: 'straight' });
  assert.equal(source, 'local');
});

test('a provider is used when registered, and only sees the payload', async () => {
  let seen = null;
  setDraftProvider(async ({ payload, action }) => {
    seen = { payload, action };
    return 'Hi {contact},\n\nRewritten by the model.\n\nThanks,\nAlex';
  });

  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const { text, source } = await draftEmail({ payload, action: 'tighten', text: 'Hi {contact}, hello.' });

  assert.equal(source, 'remote');
  assert.match(text, /Rewritten by the model/);
  assert.ok(!JSON.stringify(seen).includes('Sarah'));
  assert.ok(!JSON.stringify(seen).includes('bookings@'));
  setDraftProvider(null);
});

test('a failing provider falls back to the local draft', async () => {
  setDraftProvider(async () => { throw new Error('502 from the model'); });
  const payload = buildPayload({ user: USER, venue: VENUE, epk: EPK });
  const { text, source } = await draftEmail({ payload, tone: 'straight', action: null, text: 'x' });
  assert.equal(source, 'local');
  assert.ok(text.includes(CONTACT_PLACEHOLDER));
  setDraftProvider(null);
});
