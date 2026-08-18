#!/usr/bin/env node
/**
 * Turn the GigBook venue spreadsheet into `src/data/venues.js`.
 *
 *   node scripts/import-venues.mjs path/to/GigBook_Database.csv
 *   node scripts/import-venues.mjs path/to/file.csv --geocode
 *
 * Kept as a script rather than a one-off edit because the spreadsheet is the source of
 * truth and will change. Re-run it and commit the result.
 *
 * Expected columns (case-insensitive, extras ignored):
 *   Venue, Address, Website, Phone, Email, Genres, Capacity, Description
 * Latitude/Longitude are used when present. When they're absent, `--geocode` looks the
 * addresses up through OpenStreetMap's Nominatim, rate-limited to one request a second per
 * their usage policy, cached in .venue-geocode-cache.json so a re-run costs nothing.
 * Without coordinates a venue simply doesn't appear on the map.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, '.venue-geocode-cache.json');
const OUT = path.join(ROOT, 'src', 'data', 'venues.js');

/* ---------- CSV ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

/** The spreadsheet writes unknowns several ways; they all mean "we don't have it". */
function value(raw) {
  const v = String(raw ?? '').trim();
  return /^(n\/?a|na|-|—|tbc|unknown)$/i.test(v) ? '' : v;
}

/* ---------- field parsing ---------- */

/** "314 Sydney Rd, Brunswick VIC 3056" → { suburb: 'Brunswick', postcode: '3056' } */
function parseAddress(address) {
  const m = /,\s*([A-Za-z'\- ]+?),?\s+VIC\.?\s*(\d{4})/i.exec(address);
  if (m) return { suburb: m[1].trim(), postcode: m[2] };
  // Fall back to the second-to-last comma-separated part, which is the suburb often enough.
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const guess = parts.length >= 2 ? parts[parts.length - 2] : '';
  return { suburb: guess.replace(/\s+VIC\.?\s*\d{4}$/i, '').trim(), postcode: '' };
}

/**
 * "468 (Standing), 270 (Seated)" → 468, keeping the original around: the number drives
 * sorting and the room-size filter, the full string is what a booker actually needs.
 */
function parseCapacity(raw) {
  const text = value(raw);
  const first = /(\d[\d,]*)/.exec(text);
  const capacity = first ? Number(first[1].replace(/,/g, '')) : 0;
  const detail = text && !/^\d[\d,]*$/.test(text) ? text : '';
  return { capacity, capacityNote: detail };
}

const TYPE_RULES = [
  [/brewer|brewing|taproom/i, 'Brewery'],
  [/theatre|theater|ballroom|opera|cinema|arts centre|town hall/i, 'Theatre'],
  [/listening|recital|chapel|church|library/i, 'Listening Room'],
  [/warehouse|factory|shed/i, 'Warehouse'],
  [/night ?club|\bclub\b/i, 'Club'],
  [/band ?room/i, 'Band Room'],
  [/hotel|\bpub\b|tavern|\binn\b|arms$/i, 'Pub'],
  [/\bbar\b|wine|cellar|lounge/i, 'Bar'],
];

/** Best guess from the name and blurb; 'Venue' when nothing in the data says. */
function inferType(name, description, genres) {
  const hay = `${name} ${description} ${genres}`;
  for (const [pattern, type] of TYPE_RULES) if (pattern.test(hay)) return type;
  return 'Venue';
}

function splitGenres(raw) {
  return value(raw)
    .split(/[,/;]/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => g.replace(/\s+/g, ' '));
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ---------- geocoding (opt-in) ---------- */
async function geocode(rows) {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  let looked = 0;

  for (const row of rows) {
    if (row.lat && row.lng) continue;
    const key = row.address || `${row.name}, ${row.city} VIC`;
    if (!(key in cache)) {
      const url = 'https://nominatim.openstreetmap.org/search'
        + `?format=json&limit=1&countrycodes=au&q=${encodeURIComponent(key)}`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'GigBook venue import (one-off)' } });
        const [hit] = res.ok ? await res.json() : [];
        cache[key] = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
      } catch (err) {
        console.warn(`  geocode failed for ${key}: ${err.message}`);
        cache[key] = null;
      }
      looked += 1;
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim: 1 request per second, max
    }
    const hit = cache[key];
    if (hit) { row.lat = hit.lat; row.lng = hit.lng; }
  }

  console.log(`  geocoded ${looked} new address(es); cache at ${path.relative(ROOT, CACHE)}`);
}

/* ---------- output ---------- */
function render(rows, { source, genres, types }) {
  const body = rows.map((v) => `  ${JSON.stringify(v)},`).join('\n');
  return `// The GigBook venue database — real Victorian rooms.
//
// GENERATED FILE. Do not hand-edit: re-run the importer and commit the result.
//   node scripts/import-venues.mjs ${source}
//
// ${rows.length} venues${rows.filter((v) => v.lat && v.lng).length ? '' : ' (no coordinates yet — see below)'}.
// Coordinates: ${rows.filter((v) => v.lat && v.lng).length} of ${rows.length} rows have them. Venues
// without coordinates are excluded from the map by design rather than plotted at 0,0. Run
// the importer with --geocode on a machine with network access to fill them in.

const ROWS = [
${body}
];

export function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function seedVenues() {
  return ROWS.map((row, i) => ({
    ...row,
    state: 'VIC',
    country: 'Australia',
    contactName: '',
    payType: '',
    status: 'active',
    visibility: 'shared',
    ownerId: null,
    source: 'seed',
    addedAt: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
  }));
}

export const VENUE_TYPES = ${JSON.stringify(types)};

// Only genres carried by enough rooms to be worth filtering on. Venues keep every tag the
// spreadsheet gave them; a genre one venue claims is a label, not a filter.
export const ALL_GENRES = ${JSON.stringify(genres)};
`;
}

/* ---------- run ---------- */
const [, , csvPath, ...flags] = process.argv;
if (!csvPath) {
  console.error('usage: node scripts/import-venues.mjs <csv> [--geocode]');
  process.exit(2);
}

const table = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = table[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
const col = (...names) => {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
};

const IDX = {
  name: col('venue', 'venuename', 'name'),
  address: col('address'),
  website: col('website', 'url'),
  phone: col('phone', 'telephone'),
  email: col('email', 'bookingemail'),
  genres: col('genres', 'genre'),
  capacity: col('capacity'),
  description: col('description', 'notes'),
  lat: col('latitude', 'lat'),
  lng: col('longitude', 'lng', 'long'),
};
if (IDX.name < 0) throw new Error(`no venue-name column in: ${table[0].join(', ')}`);

const seen = new Map();
const rows = [];

for (const line of table.slice(1)) {
  const cell = (i) => (i >= 0 ? value(line[i]) : '');
  const name = cell(IDX.name);
  if (!name) continue;

  const address = cell(IDX.address);
  const { suburb, postcode } = parseAddress(address);
  const { capacity, capacityNote } = parseCapacity(IDX.capacity >= 0 ? line[IDX.capacity] : '');
  const email = cell(IDX.email);

  // Two rooms can share a name across suburbs, so the id carries both.
  let id = `ven_${slug(name)}`;
  if (seen.has(id)) id = `ven_${slug(name)}-${slug(suburb) || seen.get(id) + 1}`;
  seen.set(id, (seen.get(id) || 0) + 1);

  rows.push({
    id,
    name,
    city: suburb,
    address,
    postcode,
    lat: Number(cell(IDX.lat)) || 0,
    lng: Number(cell(IDX.lng)) || 0,
    capacity,
    capacityNote,
    type: inferType(name, cell(IDX.description), cell(IDX.genres)),
    genres: splitGenres(IDX.genres >= 0 ? line[IDX.genres] : ''),
    contactEmail: email,
    phone: cell(IDX.phone),
    website: cell(IDX.website),
    submissionMethod: email ? 'Email' : (cell(IDX.website) ? 'Booking form' : ''),
    notes: cell(IDX.description),
  });
}

/**
 * The same room entered twice, usually with a different address format and a different
 * booking email. Reported rather than merged: picking a winner would pick who gets pitched,
 * and only the person who keeps the spreadsheet knows which address is current.
 */
const byRoom = new Map();
for (const row of rows) {
  const key = `${row.name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${row.city.toLowerCase()}`;
  if (!byRoom.has(key)) byRoom.set(key, []);
  byRoom.get(key).push(row);
}
const dupes = [...byRoom.values()].filter((g) => g.length > 1);
if (dupes.length) {
  console.warn(`\n⚠  ${dupes.length} venue(s) appear more than once — fix the spreadsheet and re-run:`);
  for (const group of dupes) {
    console.warn(`   ${group[0].name} (${group[0].city})`);
    for (const row of group) {
      console.warn(`     · ${row.contactEmail || 'no email'} · cap ${row.capacity || '—'} · ${row.address}`);
    }
  }
  console.warn('');
}

if (flags.includes('--geocode')) {
  console.log('geocoding…');
  await geocode(rows);
}

// Filter chips are for narrowing a list of 222 rooms, so they only carry genres that
// actually divide it. Three rooms is the smallest group worth its own chip.
const tally = new Map();
for (const row of rows) for (const g of row.genres) tally.set(g, (tally.get(g) || 0) + 1);
const genres = [...tally.entries()].filter(([, n]) => n >= 3).map(([g]) => g).sort();

const types = [...new Set(rows.map((r) => r.type))].sort();

fs.writeFileSync(OUT, render(rows, { source: path.basename(csvPath), genres, types }));

const mapped = rows.filter((r) => r.lat && r.lng).length;
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(`  ${rows.length} venues · ${mapped} with coordinates · ${genres.length} filterable genres`);
console.log(`  ${rows.filter((r) => !r.contactEmail).length} without a booking email`);
console.log(`  types: ${types.join(', ')}`);
