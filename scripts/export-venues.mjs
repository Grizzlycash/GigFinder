#!/usr/bin/env node
/**
 * Write the current venue database back out as a spreadsheet.
 *
 *   node scripts/export-venues.mjs                       → both .xlsx and .csv
 *   node scripts/export-venues.mjs --out ~/Desktop
 *
 * Generated from `src/data/venues.js` — the file the app actually ships — so what you open
 * is what your testers see, rather than a re-export of whatever the spreadsheet said.
 * Round-trips: the output's headers are the ones the importer reads, so this can go straight
 * back into the sheet and be imported again.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { seedVenues } from '../src/data/venues.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Column order matches the master sheet, with the fields the importer adds on the end.
const COLUMNS = [
  ['Name', (v) => v.name],
  ['Address', (v) => v.address],
  ['Suburb', (v) => v.city],
  ['City', (v) => v.metro],
  ['State/Region', (v) => v.state],
  ['Country', (v) => v.country],
  ['Postcode', (v) => v.postcode],
  ['Website', (v) => v.website],
  ['Phone', (v) => v.phone],
  ['Email', (v) => v.contactEmail],
  ['Genres', (v) => (v.genres || []).join(', ')],
  ['Capacity', (v) => (v.capacityNote || (v.capacity || '')), 'text'],
  ['Capacity (number)', (v) => v.capacity || '', 'number'],
  ['Venue type', (v) => v.type],
  ['Latitude', (v) => v.lat || '', 'number'],
  ['Longitude', (v) => v.lng || '', 'number'],
  ['Description', (v) => v.notes],
];

const venues = seedVenues().sort((a, b) => a.name.localeCompare(b.name));
const rows = venues.map((v) => COLUMNS.map(([, read]) => read(v) ?? ''));

/* ---------- CSV ---------- */
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = [COLUMNS.map(([label]) => label), ...rows]
  .map((row) => row.map(csvCell).join(','))
  .join('\r\n');

/* ---------- XLSX ---------- */
const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  // Excel rejects most control characters outright.
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

const columnRef = (index) => {
  let ref = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    ref = String.fromCharCode(65 + rem) + ref;
    n = Math.floor((n - 1) / 26);
  }
  return ref;
};

/** Inline strings rather than a shared-string table: bigger file, far simpler to generate. */
function sheetXml() {
  const body = [COLUMNS.map(([label]) => label), ...rows].map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${columnRef(c)}${r + 1}`;
      const numeric = r > 0 && COLUMNS[c][2] === 'number' && value !== '' && Number.isFinite(Number(value));
      if (value === '' || value == null) return '';
      return numeric
        ? `<c r="${ref}"><v>${Number(value)}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');

  const widths = COLUMNS.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 34 : i === 1 || i === COLUMNS.length - 1 ? 46 : 16}" customWidth="1"/>`).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols>${widths}</cols>`
    + `<sheetData>${body}</sheetData></worksheet>`;
}

const xlsx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '</Types>'),
  '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>'),
  'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets><sheet name="Master Venues CRM" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '</Relationships>'),
  'xl/worksheets/sheet1.xml': strToU8(sheetXml()),
}, { level: 6 });

/* ---------- write ---------- */
const outFlag = process.argv.indexOf('--out');
const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : ROOT;
const stamp = new Date().toISOString().slice(0, 10);
const base = path.join(outDir, `gigbook-venues-${stamp}`);

fs.writeFileSync(`${base}.csv`, csv);
fs.writeFileSync(`${base}.xlsx`, xlsx);

const withCoords = venues.filter((v) => v.lat && v.lng).length;
console.log(`wrote ${path.relative(process.cwd(), base)}.xlsx and .csv`);
console.log(`  ${venues.length} venues · ${new Set(venues.map((v) => v.country).filter(Boolean)).size} countries`
  + ` · ${withCoords} with coordinates · ${venues.filter((v) => !v.contactEmail).length} without a booking email`);
