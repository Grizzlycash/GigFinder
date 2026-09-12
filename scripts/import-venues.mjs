#!/usr/bin/env node
/**
 * Turn the GigBook venue spreadsheet into `src/data/venues.js`.
 *
 *   node scripts/import-venues.mjs path/to/GigBook_Database.xlsx
 *   node scripts/import-venues.mjs path/to/file.csv --geocode
 *   node scripts/import-venues.mjs path/to/file.xlsx --keep-duplicates
 *
 * Reads .xlsx (first worksheet) or .csv. Rooms entered twice are merged by default; pass
 * --keep-duplicates to import the sheet verbatim instead.
 *
 * Kept as a script rather than a one-off edit because the spreadsheet is the source of
 * truth and will change. Re-run it and commit the result.
 *
 * Expected columns (case-insensitive, extras ignored, aliases in IDX below):
 *   Name, Address, Suburb, City, State/Region, Country, Postcode, Website, Phone, Email,
 *   Genres, Capacity, Description
 * Latitude/Longitude are used when present. When they're absent, `--geocode` looks the
 * addresses up through OpenStreetMap's Nominatim, rate-limited to one request a second per
 * their usage policy, cached in .venue-geocode-cache.json so a re-run costs nothing.
 * Without coordinates a venue simply doesn't appear on the map.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// One alias table, shared with the admin import screen — two copies is how they drifted.
import { ALIASES, normaliseHeader, parseCsv, parseCapacity, cellValue as value } from '../src/lib/importMap.js';
import { readXlsx, isSpreadsheetFile } from '../src/lib/xlsx.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, '.venue-geocode-cache.json');
const OUT = path.join(ROOT, 'src', 'data', 'venues.js');

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
    const key = [row.address || row.name, row.city, row.state, row.country]
      .filter(Boolean).join(', ');
    if (!(key in cache)) {
      // No country filter: the database spans nine of them, and pinning the search to AU
      // would silently fail every overseas room.
      const url = 'https://nominatim.openstreetmap.org/search'
        + `?format=json&limit=1&q=${encodeURIComponent(key)}`;
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
  return `// The GigBook venue database.
//
// GENERATED FILE. Do not hand-edit: re-run the importer and commit the result.
//   node scripts/import-venues.mjs ${source}
//
// ${rows.length} venues across ${new Set(rows.map((v) => v.country).filter(Boolean)).size} countries${rows.filter((v) => v.lat && v.lng).length ? '' : ' (no coordinates yet — see below)'}.
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
    // state and country come from the spreadsheet, per row — the database is not
    // Australia-only, so they must not be stamped here.
    ...row,
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
  console.error('usage: node scripts/import-venues.mjs <csv|xlsx> [--geocode] [--keep-duplicates]');
  process.exit(2);
}

// The master sheet lives as .xlsx, so read it directly — an export-to-CSV step before every
// import is one more chance to import last week's data.
const table = isSpreadsheetFile(csvPath)
  ? readXlsx(fs.readFileSync(csvPath))
  : parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = table[0].map(normaliseHeader);
/** First alias present wins, so preference comes from ALIASES rather than column order. */
const col = (field) => {
  for (const want of ALIASES[field] || [field]) {
    const i = header.indexOf(want);
    if (i >= 0) return i;
  }
  return -1;
};

// Aliases are listed most-preferred first, and `col()` returns the first one present — so
// preference comes from this list, not from which column sits further left in the sheet.
// `city` takes Suburb ahead of City deliberately: the sheet's City is the metro ("Melbourne")
// while the app's city is the locality on every venue card and the key for duplicate
// matching. Taking City would label two hundred rooms "Melbourne" and merge them.
const IDX = {
  name: col('name'),
  address: col('address'),
  city: col('city'),
  metro: col('metro'),
  state: col('state'),
  country: col('country'),
  postcode: col('postcode'),
  website: col('website'),
  phone: col('phone'),
  email: col('contactEmail'),
  genres: col('genres'),
  capacity: col('capacity'),
  description: col('notes'),
  lat: col('lat'),
  lng: col('lng'),
};
if (IDX.name < 0) throw new Error(`no venue-name column in: ${table[0].join(', ')}`);

const seen = new Map();
const rows = [];

for (const line of table.slice(1)) {
  const cell = (i) => (i >= 0 ? value(line[i]) : '');
  const name = cell(IDX.name);
  if (!name) continue;

  const address = cell(IDX.address);
  // Prefer the sheet's own columns; only fall back to picking the address apart when it
  // doesn't have them. Parsing "…, Brunswick VIC 3056" was always a guess, and it can't
  // work at all for the non-Australian rows.
  const parsed = IDX.city >= 0 && IDX.postcode >= 0 ? null : parseAddress(address);
  const suburb = cell(IDX.city) || cell(IDX.metro) || parsed?.suburb || '';
  const postcode = cell(IDX.postcode) || parsed?.postcode || '';
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
    metro: cell(IDX.metro),
    state: cell(IDX.state),
    country: cell(IDX.country),
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
 * The same room entered twice — usually a different address format and a different booking
 * email. Merged field by field rather than by dropping one row: between two partial
 * records, each tends to hold something the other is missing.
 *
 * The fuller row wins ties, and every genuine conflict is printed. A conflict means the
 * spreadsheet disagrees with itself, and no import can resolve that — only whoever keeps
 * the sheet knows which booking address is current.
 */
function mergeDuplicates(all) {
  const groups = new Map();
  for (const row of all) {
    const key = `${row.name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${row.city.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const filled = (row) => Object.values(row).filter((v) => v !== '' && v !== 0 && v != null
    && !(Array.isArray(v) && v.length === 0)).length;
  const isEmpty = (v) => v === '' || v === 0 || v == null || (Array.isArray(v) && !v.length);

  const merged = [];
  const conflicts = [];
  let collapsed = 0;

  for (const group of groups.values()) {
    if (group.length === 1) { merged.push(group[0]); continue; }

    // Richest row first, so it supplies the values and the others only fill its gaps.
    const [base, ...rest] = [...group].sort((a, b) => filled(b) - filled(a));
    const winner = { ...base };

    for (const other of rest) {
      for (const [field, value] of Object.entries(other)) {
        if (field === 'id' || isEmpty(value)) continue;
        if (isEmpty(winner[field])) { winner[field] = value; continue; }
        if (Array.isArray(value)) {
          // Genre lists just union.
          winner[field] = [...new Set([...winner[field], ...value])];
          continue;
        }
        if (String(winner[field]) !== String(value) && ['contactEmail', 'website', 'phone', 'capacity'].includes(field)) {
          conflicts.push({ name: winner.name, city: winner.city, field, kept: winner[field], dropped: value });
        }
      }
    }

    merged.push(winner);
    collapsed += group.length - 1;
  }

  return { merged, conflicts, collapsed, groups: [...groups.values()].filter((g) => g.length > 1) };
}

if (flags.includes('--keep-duplicates')) {
  const { groups } = mergeDuplicates(rows);
  if (groups.length) {
    console.warn(`\n⚠  ${groups.length} venue(s) appear more than once and were kept as-is:`);
    for (const group of groups) console.warn(`   ${group[0].name} (${group[0].city}) ×${group.length}`);
    console.warn('');
  }
} else {
  const { merged, conflicts, collapsed, groups } = mergeDuplicates(rows);
  if (collapsed) {
    console.log(`\nmerged ${collapsed} duplicate row(s) into ${groups.length} venue(s):`);
    for (const group of groups) console.log(`   ${group[0].name} (${group[0].city}) ×${group.length}`);
  }
  if (conflicts.length) {
    console.warn(`\n⚠  ${conflicts.length} field(s) disagreed between duplicate rows. The first value`);
    console.warn('   was kept — check these in the spreadsheet, since only you know which is current:');
    for (const c of conflicts) {
      console.warn(`   ${c.name} (${c.city}) · ${c.field}: kept "${c.kept}", dropped "${c.dropped}"`);
    }
  }
  console.log('');
  rows.length = 0;
  rows.push(...merged);
}

/**
 * Rows whose location fields disagree with themselves.
 *
 * Reported, never corrected. A wrong country is a fact about the spreadsheet, and guessing
 * at it would hide the problem instead of fixing the source — but shipping it silently puts
 * "Collingwood, New Zealand" in front of a tester, which costs more trust than it saves
 * effort.
 */
function locationWarnings(all) {
  const AU_SIGNAL = /\b(VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\b|\bAustralia\b/;
  const mislabelled = all.filter((v) => v.country && v.country !== 'Australia'
    && AU_SIGNAL.test(`${v.address} ${v.state}`));
  // Suburb, City and State/Region all holding the same value is a fill error, not a place.
  const collapsed = all.filter((v) => v.city && v.city === v.metro && v.city === v.state);
  // A postcode in a place-name column. Both feed filter menus, where "Queenstown 9300"
  // and "3810" become their own entries and split a town's rooms across two lines.
  const numbered = all.filter((v) => /\d{4}/.test(v.city || '') || /\d{4}/.test(v.metro || ''));
  // No region at all. On its own that's only a gap in a filter menu, but it reliably marks
  // rows that were entered by hand in a hurry — every one of the 19 found this way also had
  // the wrong country or a postcode where the town should be.
  const stateless = all.filter((v) => !v.state);
  return { mislabelled, collapsed, numbered, stateless };
}

{
  const { mislabelled, collapsed, numbered, stateless } = locationWarnings(rows);
  if (mislabelled.length) {
    console.warn(`\n⚠  ${mislabelled.length} row(s) have an Australian address but a different Country.`);
    console.warn('   Imported exactly as the sheet has them — fix the sheet, not the import:');
    for (const v of mislabelled) {
      console.warn(`   ${v.name} · ${v.address || v.city} → Country "${v.country}"`);
    }
  }
  if (collapsed.length) {
    console.warn(`\n⚠  ${collapsed.length} row(s) repeat the same value in Suburb, City and`);
    console.warn(`   State/Region (e.g. ${collapsed[0].name}: "${collapsed[0].city}"), which usually`);
    console.warn('   means a column was filled down. Harmless to import, wrong on screen.');
  }
  if (numbered.length) {
    console.warn(`\n⚠  ${numbered.length} row(s) carry a postcode in Suburb or City, which splits`);
    console.warn('   a town across two entries in the venue filters:');
    for (const v of numbered) console.warn(`   ${v.name} · Suburb "${v.city}" · City "${v.metro}"`);
  }
  if (stateless.length) {
    console.warn(`\n⚠  ${stateless.length} row(s) have no State/Region. Worth reading the whole row —`);
    console.warn('   a blank region usually comes with other fields in the wrong column:');
    for (const v of stateless) console.warn(`   ${v.name} · ${v.address || v.city} · ${v.country || 'no country'}`);
  }
  if (mislabelled.length || collapsed.length || numbered.length || stateless.length) console.warn('');
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
