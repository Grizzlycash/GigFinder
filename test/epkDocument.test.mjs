// Unit tests for the press-kit document model — the layer between the EPK's fields and
// the printed PDF. The PDF renderer needs a browser; this doesn't, so the rules about
// what gets printed, in what order, live here where they can be checked cheaply.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDocument, documentFor, printableSections, reorderSection, updateSection,
  sectionPhotos, estimatePages, documentFilename,
} from '../src/lib/epkDocument.js';

const USER = { artistName: 'The Rustlers', realName: 'Alex Rivera', email: 'alex@example.com' };

const EPK = {
  id: 'epk_1',
  title: 'The Rustlers — EPK',
  tagline: 'Grimy four-piece garage rock',
  shortBio: 'Loud, hooky garage rock from Brunswick.',
  longBio: 'Formed in a Coburg share-house in 2022.',
  notable: 'The Tote, Feb 2026',
  homeCity: 'Brunswick, VIC',
  genres: ['Punk', 'Garage'],
  setLength: '45 minutes',
  audienceSize: '80–120',
  music: { spotify: 'https://open.spotify.com/artist/demo', bandcamp: '', appleMusic: '', soundcloud: '', youtube: '' },
  socials: { instagram: '@therustlers', website: '', facebook: '', tiktok: '', x: '' },
  rider: { format: 'Four-piece', pa: 'Venue to provide', mics: '', di: '', monitors: '', setupTime: '', notes: '', hospitality: '' },
  tracks: [{ id: 't1', title: 'Wire Fence', url: 'https://example.com/track' }],
  pressQuotes: [{ id: 'q1', text: 'The best live band on the northside.', source: 'Beat' }],
  photos: [{ id: 'img1', src: 'data:image/jpeg;base64,AAAA', label: 'Live' }],
};

test('builds a document from the EPK fields', () => {
  const doc = buildDocument(EPK, USER);
  assert.equal(doc.headline, 'The Rustlers');   // the " — EPK" suffix is an app label, not a cover
  assert.equal(doc.tagline, 'Grimy four-piece garage rock');
  assert.match(doc.strapline, /Brunswick, VIC/);
  assert.match(doc.strapline, /Punk · Garage/);
  assert.equal(doc.coverPhotoId, 'img1');
  assert.match(doc.contact, /alex@example\.com/);
});

test('both bios print, in order', () => {
  const bio = buildDocument(EPK, USER).sections.find((s) => s.kind === 'bio');
  assert.ok(bio.body.indexOf('Loud, hooky') < bio.body.indexOf('Formed in a Coburg'));
});

test('structured fields flatten to editable "label — value" lines', () => {
  const doc = buildDocument(EPK, USER);
  const listen = doc.sections.find((s) => s.kind === 'music');
  assert.match(listen.body, /^Spotify — https:\/\/open\.spotify\.com\/artist\/demo$/m);
  assert.match(listen.body, /^Wire Fence — https:\/\/example\.com\/track$/m);

  const rider = doc.sections.find((s) => s.kind === 'rider');
  assert.match(rider.body, /^Format — Four-piece$/m);
  // Empty rider fields are left out rather than printed blank.
  assert.doesNotMatch(rider.body, /Monitors/);
});

test('empty sections are left out entirely', () => {
  const bare = buildDocument({ shortBio: 'Just a bio.', music: {}, socials: {}, rider: {} }, USER);
  const kinds = bare.sections.map((s) => s.kind);
  assert.deepEqual(kinds, ['bio']);
});

test('a press quote keeps its attribution', () => {
  const quotes = buildDocument(EPK, USER).sections.find((s) => s.kind === 'quotes');
  assert.equal(quotes.body, '“The best live band on the northside.”\n— Beat');
});

test('excluded and empty sections do not print', () => {
  let doc = buildDocument(EPK, USER);
  const before = printableSections(doc).length;
  doc = updateSection(doc, 'sec_bio', { include: false });
  assert.equal(printableSections(doc).length, before - 1);

  doc = updateSection(doc, 'sec_notable', { body: '   ' });
  assert.equal(printableSections(doc).length, before - 2);
});

test('a photo section with no photos does not print', () => {
  let doc = buildDocument(EPK, USER);
  doc = updateSection(doc, 'sec_photos', { photoIds: [] });
  assert.equal(printableSections(doc).some((s) => s.kind === 'photos'), false);
});

test('reordering moves a section and keeps the order contiguous', () => {
  const doc = buildDocument(EPK, USER);
  const [first, second] = doc.sections;
  const moved = reorderSection(doc, first.id, 1);
  const order = printableSections(moved).map((s) => s.id);
  assert.equal(order[0], second.id);
  assert.equal(order[1], first.id);
  assert.deepEqual(moved.sections.map((s) => s.order), moved.sections.map((_, i) => i));
});

test('reordering past either end is a no-op', () => {
  const doc = buildDocument(EPK, USER);
  const last = doc.sections[doc.sections.length - 1];
  assert.deepEqual(reorderSection(doc, doc.sections[0].id, -1), doc);
  assert.deepEqual(reorderSection(doc, last.id, 1), doc);
});

test("the artist's edits win over the derived document", () => {
  const edited = { ...buildDocument(EPK, USER), headline: 'RUSTLERS' };
  edited.sections = edited.sections.map((s) => (s.kind === 'bio' ? { ...s, body: 'Rewritten by hand.' } : s));
  const doc = documentFor({ ...EPK, document: edited }, USER);
  assert.equal(doc.headline, 'RUSTLERS');
  assert.equal(doc.sections.find((s) => s.kind === 'bio').body, 'Rewritten by hand.');
});

test('an EPK with no stored document falls back to the derived one', () => {
  assert.deepEqual(documentFor({ ...EPK, document: null }, USER), buildDocument(EPK, USER));
  assert.deepEqual(documentFor({ ...EPK, document: { sections: [] } }, USER), buildDocument(EPK, USER));
});

test('photos resolve against the EPK, and missing ones are skipped', () => {
  const doc = buildDocument(EPK, USER);
  const photos = doc.sections.find((s) => s.kind === 'photos');
  assert.equal(sectionPhotos(photos, EPK).length, 1);
  assert.equal(sectionPhotos({ ...photos, photoIds: ['gone'] }, EPK).length, 0);
});

test('page estimate always counts the cover, and grows with content', () => {
  const empty = buildDocument({ shortBio: 'Short.' }, USER);
  assert.ok(estimatePages(empty, EPK) >= 2);

  const long = buildDocument({ ...EPK, longBio: 'word '.repeat(3000) }, USER);
  assert.ok(estimatePages(long, EPK) > estimatePages(buildDocument(EPK, USER), EPK));
});

test('the filename is slugged from the headline', () => {
  assert.equal(documentFilename({ headline: 'The Rustlers' }), 'the-rustlers-press-kit.pdf');
  assert.equal(documentFilename({ headline: '!!!' }), 'press-kit.pdf');
  assert.equal(documentFilename({}), 'press-kit.pdf');
});
