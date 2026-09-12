// Unit tests for reading .xlsx.
//
// The workbooks are built here with fflate rather than committed as fixtures, so the test
// states the file format it expects instead of hiding it in a binary. Each one covers a
// shape real spreadsheets actually produce: shared strings (Excel's default), inline
// strings (what some exporters emit), skipped cells, and a sheet that isn't sheet1.xml.

import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { readXlsx, isSpreadsheetFile } from '../src/lib/xlsx.js';

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOC_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** A minimal but structurally honest workbook. */
function workbook({ sheetXml, shared = null, sheetPath = 'xl/worksheets/sheet1.xml' }) {
  const files = {
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook xmlns="${SHEET_NS}" xmlns:r="${DOC_REL}">`
      + '<sheets><sheet name="Master Venues CRM" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships xmlns="${REL_NS}">`
      + `<Relationship Id="rId1" Type="${DOC_REL}/worksheet" Target="${sheetPath.replace('xl/', '')}"/>`
      + '</Relationships>',
    ),
    [sheetPath]: strToU8(`<?xml version="1.0"?><worksheet xmlns="${SHEET_NS}"><sheetData>${sheetXml}</sheetData></worksheet>`),
  };
  if (shared) {
    files['xl/sharedStrings.xml'] = strToU8(
      `<?xml version="1.0"?><sst xmlns="${SHEET_NS}" count="${shared.length}" uniqueCount="${shared.length}">`
      + shared.map((s) => `<si><t>${s}</t></si>`).join('')
      + '</sst>',
    );
  }
  return zipSync(files);
}

const sharedCell = (ref, index) => `<c r="${ref}" t="s"><v>${index}</v></c>`;
const inlineCell = (ref, text) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
const numberCell = (ref, n) => `<c r="${ref}"><v>${n}</v></c>`;

test('reads a shared-strings workbook, which is what Excel writes', () => {
  const file = workbook({
    shared: ['Name', 'Suburb', 'Capacity', 'Brunswick Ballroom', 'Brunswick'],
    sheetXml:
      `<row r="1">${sharedCell('A1', 0)}${sharedCell('B1', 1)}${sharedCell('C1', 2)}</row>`
      + `<row r="2">${sharedCell('A2', 3)}${sharedCell('B2', 4)}${numberCell('C2', 468)}</row>`,
  });
  assert.deepEqual(readXlsx(file), [
    ['Name', 'Suburb', 'Capacity'],
    ['Brunswick Ballroom', 'Brunswick', '468'],
  ]);
});

test('reads inline strings too', () => {
  const file = workbook({
    sheetXml:
      `<row r="1">${inlineCell('A1', 'Name')}${inlineCell('B1', 'City')}</row>`
      + `<row r="2">${inlineCell('A2', 'Nippon Budokan')}${inlineCell('B2', 'Tokyo')}</row>`,
  });
  assert.deepEqual(readXlsx(file), [['Name', 'City'], ['Nippon Budokan', 'Tokyo']]);
});

test('a blank cell keeps its column position', () => {
  // No <c> for B2 at all — the row must still put "Melbourne" in the third column, or
  // every field after the gap reads from the wrong column.
  const file = workbook({
    sheetXml:
      `<row r="1">${inlineCell('A1', 'Name')}${inlineCell('B1', 'Suburb')}${inlineCell('C1', 'City')}</row>`
      + `<row r="2">${inlineCell('A2', 'Some Room')}${inlineCell('C2', 'Melbourne')}</row>`,
  });
  assert.deepEqual(readXlsx(file), [
    ['Name', 'Suburb', 'City'],
    ['Some Room', '', 'Melbourne'],
  ]);
});

test('columns past Z are placed correctly', () => {
  const file = workbook({
    sheetXml: `<row r="1">${inlineCell('A1', 'first')}${inlineCell('AB1', 'twenty-eighth')}</row>`,
  });
  const [row] = readXlsx(file);
  assert.equal(row.length, 28);
  assert.equal(row[0], 'first');
  assert.equal(row[27], 'twenty-eighth');
});

test('follows the workbook rels rather than assuming sheet1.xml', () => {
  const file = workbook({
    sheetPath: 'xl/worksheets/theRealOne.xml',
    sheetXml: `<row r="1">${inlineCell('A1', 'Name')}</row>`,
  });
  assert.deepEqual(readXlsx(file), [['Name']]);
});

test('XML entities are decoded, not left as escapes', () => {
  const file = workbook({
    shared: ['Rock &amp; Roll', 'Caf&#233; du Nord', '&lt;tag&gt;'],
    sheetXml: `<row r="1">${sharedCell('A1', 0)}${sharedCell('B1', 1)}${sharedCell('C1', 2)}</row>`,
  });
  assert.deepEqual(readXlsx(file), [['Rock & Roll', 'Café du Nord', '<tag>']]);
});

test('styled text split across runs comes back whole', () => {
  // Excel splits a cell with mixed formatting into several <r><t> runs.
  const file = zipSync({
    'xl/workbook.xml': strToU8(`<workbook xmlns="${SHEET_NS}" xmlns:r="${DOC_REL}"><sheets><sheet name="s" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${DOC_REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/sharedStrings.xml': strToU8(`<sst xmlns="${SHEET_NS}"><si><r><t>The </t></r><r><t>Tote</t></r></si></sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet xmlns="${SHEET_NS}"><sheetData><row r="1">${sharedCell('A1', 0)}</row></sheetData></worksheet>`),
  });
  assert.deepEqual(readXlsx(file), [['The Tote']]);
});

test('entirely empty rows are dropped', () => {
  const file = workbook({
    sheetXml:
      `<row r="1">${inlineCell('A1', 'Name')}</row>`
      + '<row r="2"></row>'
      + `<row r="4">${inlineCell('A4', 'After a gap')}</row>`,
  });
  assert.deepEqual(readXlsx(file), [['Name'], ['After a gap']]);
});

test('a file with no worksheet says so instead of returning nothing', () => {
  const notAWorkbook = zipSync({ 'hello.txt': strToU8('not a spreadsheet') });
  assert.throws(() => readXlsx(notAWorkbook), /no worksheet/i);
});

test('spreadsheet filenames are recognised, other files are not', () => {
  for (const name of ['venues.xlsx', 'VENUES.XLSX', 'book.xlsm', 'old.xls']) {
    assert.equal(isSpreadsheetFile(name), true, name);
  }
  for (const name of ['venues.csv', 'notes.txt', '', undefined]) {
    assert.equal(isSpreadsheetFile(name), false, String(name));
  }
});
