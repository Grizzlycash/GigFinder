/**
 * Mapping spreadsheet columns onto venue fields.
 *
 * One table, used by both importers — the admin screen and `scripts/import-venues.mjs`.
 * They had a copy each, which is how the two quietly disagreed about which column the
 * suburb comes from.
 *
 * Pure and dependency-free so `node --test` can cover it: the cost of getting this wrong is
 * a silently mis-shaped database, which is expensive to notice and worse to undo.
 */

/** The columns the master spreadsheet carries. `true` marks a field the import needs. */
export const FIELDS = [
  ['name', 'Venue name', true],
  ['address', 'Address'],
  ['city', 'Suburb / locality', true],
  ['metro', 'City'],
  ['state', 'State / region'],
  ['country', 'Country'],
  ['postcode', 'Postcode'],
  ['website', 'Website'],
  ['phone', 'Phone'],
  ['contactEmail', 'Booking email'],
  ['genres', 'Genres'],
  ['capacity', 'Capacity'],
  ['notes', 'Description'],
  ['contactName', 'Booking contact'],
  ['type', 'Venue type'],
  ['payType', 'Pay structure'],
  ['submissionMethod', 'Submission method'],
  ['lat', 'Latitude'],
  ['lng', 'Longitude'],
];

/**
 * Header names recognised for each field, **most preferred first**.
 *
 * `city` and `metro` are the pair that matters. The master sheet has both a Suburb
 * ("Brunswick", "Chiyoda-ku") and a City ("Melbourne", "Tokyo"). The app's `city` is the
 * locality printed on every venue card and the key for duplicate matching, so it takes
 * Suburb; City lands on `metro`. Map `city` to City instead and two hundred rooms are all
 * labelled "Melbourne" and collapse into one another.
 */
export const ALIASES = {
  name: ['name', 'venue', 'venuename'],
  address: ['address', 'streetaddress', 'fulladdress', 'street'],
  city: ['suburb', 'locality', 'town', 'city'],
  metro: ['city', 'metro', 'metroarea'],
  state: ['stateregion', 'state', 'region', 'province'],
  country: ['country'],
  postcode: ['postcode', 'postalcode', 'zip', 'zipcode'],
  capacity: ['capacity', 'cap', 'size'],
  type: ['type', 'venuetype', 'category'],
  genres: ['genres', 'genre', 'styles'],
  contactName: ['contact', 'contactname', 'booker', 'bookingcontact'],
  contactEmail: ['email', 'contactemail', 'bookingemail'],
  phone: ['phone', 'telephone', 'contactnumber'],
  website: ['website', 'url', 'site'],
  lat: ['latitude', 'lat'],
  lng: ['longitude', 'lng', 'lon', 'long'],
  payType: ['pay', 'paytype', 'deal', 'payment'],
  submissionMethod: ['submission', 'submissionmethod', 'submitvia', 'method'],
  notes: ['description', 'notes', 'note', 'comments'],
};

export const normaliseHeader = (text) => String(text).toLowerCase().replace(/[^a-z]/g, '');

/**
 * Index of the column to read a field from, or -1.
 *
 * Preference comes from ALIASES, not from which column sits further left. The earlier
 * version scanned the headers and took the first that matched *any* alias, so a sheet
 * listing City before Suburb silently mapped the wrong one.
 */
export function guessColumn(headers, field) {
  const normalised = headers.map(normaliseHeader);
  for (const want of ALIASES[field] || [String(field).toLowerCase()]) {
    const found = normalised.indexOf(want);
    if (found >= 0) return found;
  }
  return -1;
}

/** Every field mapped against a header row at once. */
export function guessMapping(headers) {
  const mapping = {};
  for (const [key] of FIELDS) mapping[key] = guessColumn(headers, key);
  return mapping;
}

/**
 * "468 (Standing), 270 (Seated)" → { capacity: 468, capacityNote: the original }.
 * The number drives sorting and the room-size filter; the full string is what a booker
 * actually needs to read.
 */
export function parseCapacity(raw) {
  const text = String(raw ?? '').trim();
  const first = /(\d[\d,]*)/.exec(text);
  return {
    capacity: first ? Number(first[1].replace(/,/g, '')) : 0,
    capacityNote: text && !/^\d[\d,]*$/.test(text) ? text : '',
  };
}

/** The spreadsheet writes unknowns several ways; they all mean "we don't have it". */
export function cellValue(raw) {
  const v = String(raw ?? '').trim();
  return /^(n\/?a|na|-|—|tbc|unknown)$/i.test(v) ? '' : v;
}

/** Minimal RFC-ish CSV reader: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text) {
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
