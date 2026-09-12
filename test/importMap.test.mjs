// Unit tests for spreadsheet column mapping.
//
// The cost of getting this wrong is a silently mis-shaped venue database: no error, no
// crash, just two hundred rooms labelled "Melbourne" and merged into each other because
// `city` was mapped to the sheet's City column instead of its Suburb column. Cheap to
// assert, expensive to notice in production.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIELDS, ALIASES, guessColumn, guessMapping, parseCapacity, cellValue, parseCsv,
} from '../src/lib/importMap.js';

// The master spreadsheet's header row, verbatim.
const MASTER = ['Name', 'Address', 'Street', 'Suburb', 'City', 'State/Region', 'Country',
  'Postcode', 'Website', 'Phone', 'Email', 'Genres', 'Capacity', 'Description'];

test('every column of the master sheet is claimed by some field', () => {
  const mapping = guessMapping(MASTER);
  const claimed = new Set(Object.values(mapping).filter((i) => i >= 0));
  const unclaimed = MASTER.filter((_, i) => !claimed.has(i));
  // Street is deliberately unclaimed — Address already contains it.
  assert.deepEqual(unclaimed, ['Street']);
});

test('the master sheet maps onto the fields it should', () => {
  const m = guessMapping(MASTER);
  assert.equal(MASTER[m.name], 'Name');
  assert.equal(MASTER[m.address], 'Address');
  assert.equal(MASTER[m.state], 'State/Region');
  assert.equal(MASTER[m.country], 'Country');
  assert.equal(MASTER[m.postcode], 'Postcode');
  assert.equal(MASTER[m.contactEmail], 'Email');
  assert.equal(MASTER[m.notes], 'Description');
  assert.equal(MASTER[m.phone], 'Phone');
});

test('city takes Suburb and metro takes City — never the other way round', () => {
  const m = guessMapping(MASTER);
  assert.equal(MASTER[m.city], 'Suburb');
  assert.equal(MASTER[m.metro], 'City');
});

test('preference beats column order', () => {
  // City first, Suburb second: the mapping must still prefer Suburb for `city`.
  const reversed = ['Name', 'City', 'Suburb'];
  assert.equal(reversed[guessColumn(reversed, 'city')], 'Suburb');
  assert.equal(reversed[guessColumn(reversed, 'metro')], 'City');
});

test('a sheet with only a City column still yields a locality', () => {
  const cityOnly = ['Name', 'City', 'Country'];
  // `city` falls back to City when there's no Suburb, so overseas rows aren't dropped.
  assert.equal(cityOnly[guessColumn(cityOnly, 'city')], 'City');
});

test('headers match regardless of case, spacing and punctuation', () => {
  for (const header of ['State/Region', 'state region', 'STATE_REGION', ' State/Region ']) {
    assert.equal(guessColumn(['Name', header], 'state'), 1, header);
  }
});

test('an unknown column maps to nothing rather than guessing', () => {
  assert.equal(guessColumn(['Name', 'Vibe'], 'capacity'), -1);
});

test('the two required fields are the ones an import cannot do without', () => {
  assert.deepEqual(FIELDS.filter(([, , required]) => required).map(([key]) => key), ['name', 'city']);
});

test('every field has at least one alias', () => {
  for (const [key] of FIELDS) {
    assert.ok(ALIASES[key]?.length, `${key} has no aliases`);
  }
});

test('messy capacity keeps a sortable number and the original text', () => {
  assert.deepEqual(parseCapacity('468 (Standing), 270 (Seated)'),
    { capacity: 468, capacityNote: '468 (Standing), 270 (Seated)' });
  assert.deepEqual(parseCapacity('1,200'), { capacity: 1200, capacityNote: '' });
  assert.deepEqual(parseCapacity('400'), { capacity: 400, capacityNote: '' });
  assert.deepEqual(parseCapacity(''), { capacity: 0, capacityNote: '' });
  // No digits at all — still no crash, and the words are worth keeping.
  assert.deepEqual(parseCapacity('Club/Tavern'), { capacity: 0, capacityNote: 'Club/Tavern' });
});

test('the sheet\'s several ways of writing "we do not know" all read as empty', () => {
  for (const blank of ['N/A', 'n/a', 'NA', '-', '—', 'TBC', 'unknown', '  ']) {
    assert.equal(cellValue(blank), '', blank);
  }
  assert.equal(cellValue('info@venue.example'), 'info@venue.example');
});

test('CSV parsing survives quotes, commas and CRLF', () => {
  const rows = parseCsv('Name,Address\r\n"The Tote","71 Johnston St, Collingwood"\r\n"He said ""no""",x\r\n');
  assert.deepEqual(rows, [
    ['Name', 'Address'],
    ['The Tote', '71 Johnston St, Collingwood'],
    ['He said "no"', 'x'],
  ]);
});
