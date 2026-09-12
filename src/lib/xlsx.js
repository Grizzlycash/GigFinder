/**
 * Reading .xlsx, so the master spreadsheet can be imported without an export-to-CSV step
 * first. Every extra manual step before an import is a chance to import last week's data.
 *
 * An .xlsx is a zip of XML. `fflate` does the unzip (isomorphic and synchronous, so this
 * module works unchanged in Node and in the browser), and the XML is scanned rather than
 * parsed into a DOM — the files Excel and Sheets emit are machine-generated and regular,
 * and a DOM parser isn't available in Node without a dependency.
 *
 * Only what an import needs: the first worksheet, as rows of strings. No formatting, no
 * formulas, no merged cells. Numbers come through as their stored text, which is what the
 * importer wants — it parses them itself.
 */

import { unzipSync, strFromU8 } from 'fflate';

/** "AB12" → 27 (zero-based column index). */
function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(String(ref).toUpperCase())?.[0] || 'A';
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return ENTITIES[code] ?? whole;
  });
}

/** Text of every <t> inside a chunk, concatenated — a styled cell is split across runs. */
function textRuns(chunk) {
  let out = '';
  for (const [, body] of chunk.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g)) {
    out += decodeXml(body ?? '');
  }
  return out;
}

/** The shared-string table, which is where most cell text actually lives. */
function sharedStrings(files) {
  const raw = files['xl/sharedStrings.xml'];
  if (!raw) return [];
  const xml = strFromU8(raw);
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(([, body]) => textRuns(body));
}

/**
 * The first worksheet's path, following workbook.xml → its rels. Sheet order in
 * workbook.xml is the order of the tabs, which is not necessarily sheet1.xml.
 */
function firstSheetPath(files) {
  const workbook = files['xl/workbook.xml'] && strFromU8(files['xl/workbook.xml']);
  const rels = files['xl/_rels/workbook.xml.rels'] && strFromU8(files['xl/_rels/workbook.xml.rels']);

  if (workbook && rels) {
    const id = /<sheet\b[^>]*\sr:id="([^"]+)"/.exec(workbook)?.[1];
    if (id) {
      const target = new RegExp(`<Relationship\\b[^>]*\\sId="${id}"[^>]*\\sTarget="([^"]+)"`).exec(rels)?.[1]
        || new RegExp(`<Relationship\\b[^>]*\\sTarget="([^"]+)"[^>]*\\sId="${id}"`).exec(rels)?.[1];
      if (target) return `xl/${String(target).replace(/^\/?xl\//, '').replace(/^\//, '')}`;
    }
  }

  // Fall back to whatever worksheet is present, lowest-numbered first.
  const sheets = Object.keys(files).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort();
  return sheets[0] || null;
}

/**
 * Rows of the first worksheet as arrays of strings, gaps included so column positions
 * line up with the header row.
 *
 * Accepts anything fflate takes: Uint8Array, ArrayBuffer, or Node Buffer.
 */
export function readXlsx(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = unzipSync(bytes);
  const sheetPath = firstSheetPath(files);
  if (!sheetPath || !files[sheetPath]) {
    throw new Error("That .xlsx has no worksheet this can read — export it as CSV instead");
  }

  const strings = sharedStrings(files);
  const xml = strFromU8(files[sheetPath]);
  const rows = [];

  for (const [, rowAttrs, rowBody] of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    let cursor = 0;

    for (const match of rowBody.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, attrs, body = ''] = match;
      const ref = /\sr="([^"]+)"/.exec(attrs)?.[1];
      const at = ref ? columnIndex(ref) : cursor;
      // Blank cells are omitted from the XML entirely; pad so the columns still align.
      while (cells.length < at) cells.push('');

      const type = /\st="([^"]+)"/.exec(attrs)?.[1];
      let text = '';
      if (type === 's') {
        const index = Number(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1]);
        text = strings[index] ?? '';
      } else if (type === 'inlineStr') {
        text = textRuns(body);
      } else {
        text = decodeXml(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
      }

      cells.push(text.trim());
      cursor = at + 1;
    }

    // Rows can be skipped too; keep the sheet's own row numbers meaningful.
    const number = Number(/\sr="(\d+)"/.exec(rowAttrs)?.[1]);
    if (Number.isFinite(number)) while (rows.length < number - 1) rows.push([]);

    rows.push(cells);
  }

  return rows.filter((row) => row.some((cell) => cell !== ''));
}

/** True when a filename looks like a workbook rather than a text file. */
export function isSpreadsheetFile(name) {
  return /\.xlsx?$|\.xlsm$/i.test(String(name || ''));
}
