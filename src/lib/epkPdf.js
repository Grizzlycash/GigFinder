/**
 * The press kit, printed.
 *
 * Renders the document model from `epkDocument.js` to a real PDF — vector text in the
 * product's own type, not a screenshot of the preview. jsPDF and the two TrueType faces
 * are ~500KB together, so everything here is behind a dynamic import: the app only pays
 * for it when someone actually builds a kit.
 *
 * The TTFs are the same faces as the web build (the .woff2 files next to them),
 * decompressed, because jsPDF embeds TrueType and cannot read woff2.
 */

import antonUrl from '@/assets/fonts/anton-400.ttf?url';
import interUrl from '@/assets/fonts/inter-var.ttf?url';
import { printableSections, sectionPhotos, documentFilename } from '@/lib/epkDocument';

/* ---------- page geometry (A4, points) ---------- */
const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = { x: 52, top: 58, bottom: 62 };
const COL = PAGE.w - MARGIN.x * 2;

/* ---------- the palette, straight off the design brief ---------- */
const INK = '#12151c';
const PAPER = '#f6f1e3';
const PAPER_INK = '#1a1712';
const PAPER_MUTED = '#6a6252';
const PAPER_LINE = '#d8cdb3';
const FLASH_RED = '#b23a2e';
const BONE = '#f1ede1';
const BONE_MUTED = '#9b9686';

let toolkit = null;

async function base64(url) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/** jsPDF plus the embedded faces, fetched once per session. */
async function load() {
  if (toolkit) return toolkit;
  const [{ jsPDF }, anton, inter] = await Promise.all([
    import('jspdf'),
    base64(antonUrl),
    base64(interUrl),
  ]);
  toolkit = { jsPDF, anton, inter };
  return toolkit;
}

/** Natural dimensions, so photos are placed to their own aspect rather than squashed. */
function measureImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function imageFormat(src) {
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(src || '');
  if (!match) return null;
  const kind = match[1].toLowerCase();
  return kind === 'png' ? 'PNG' : kind === 'webp' ? 'WEBP' : 'JPEG';
}

/**
 * A page the text flows down, breaking when it runs out of room. Everything that draws
 * goes through here so pagination is decided in exactly one place.
 */
class Sheet {
  constructor(doc, { headline }) {
    this.doc = doc;
    this.headline = headline;
    this.y = MARGIN.top;
    this.page = 1;
  }

  contentPage() {
    this.doc.setFillColor(PAPER);
    this.doc.rect(0, 0, PAGE.w, PAGE.h, 'F');
    this.footer();
    this.y = MARGIN.top;
  }

  footer() {
    const y = PAGE.h - 34;
    this.doc.setDrawColor(PAPER_LINE);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN.x, y - 12, PAGE.w - MARGIN.x, y - 12);
    this.doc.setFont('Inter', 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(PAPER_MUTED);
    this.doc.text(this.headline.toUpperCase(), MARGIN.x, y, { charSpace: 0.6 });
    this.doc.text(String(this.page), PAGE.w - MARGIN.x, y, { align: 'right' });
  }

  /** Make sure `height` points are available, starting a new page if not. */
  room(height) {
    if (this.y + height <= PAGE.h - MARGIN.bottom) return;
    this.doc.addPage();
    this.page += 1;
    this.contentPage();
  }

  /**
   * `keepWith` is how much of what follows has to stay on the page with the heading —
   * a heading stranded at the foot of a page with its content overleaf looks broken.
   */
  heading(text, keepWith = 30) {
    this.room(34 + keepWith);
    this.doc.setDrawColor(FLASH_RED);
    this.doc.setLineWidth(1.6);
    this.doc.line(MARGIN.x, this.y, MARGIN.x + 34, this.y);
    this.y += 16;
    this.doc.setFont('Anton', 'normal');
    this.doc.setFontSize(15);
    this.doc.setTextColor(PAPER_INK);
    this.doc.text(String(text || '').toUpperCase(), MARGIN.x, this.y, { charSpace: 0.9 });
    this.y += 16;
  }

  /**
   * Body copy. "Label — value" lines print the label in the display face so the rider
   * and the link list read as data rather than as a wall of prose.
   */
  paragraphs(text) {
    const LEADING = 14.5;
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) { this.y += 6; continue; }

      const pair = /^(.{1,28}?) — (.+)$/.exec(line);
      if (pair) {
        this.room(LEADING);
        this.doc.setFont('Anton', 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(PAPER_MUTED);
        this.doc.text(pair[1].toUpperCase(), MARGIN.x, this.y, { charSpace: 0.7 });
        this.doc.setFont('Inter', 'normal');
        this.doc.setFontSize(10);
        this.doc.setTextColor(PAPER_INK);
        const value = this.doc.splitTextToSize(pair[2], COL - 118);
        this.doc.text(value, MARGIN.x + 118, this.y);
        this.y += LEADING * value.length;
        continue;
      }

      this.doc.setFont('Inter', 'normal');
      this.doc.setFontSize(10);
      this.doc.setTextColor(PAPER_INK);
      for (const wrapped of this.doc.splitTextToSize(line, COL)) {
        this.room(LEADING);
        this.doc.text(wrapped, MARGIN.x, this.y);
        this.y += LEADING;
      }
    }
    this.y += 12;
  }

  /** Two per row, each to its own aspect, captions underneath. */
  photos(images) {
    const GAP = 14;
    const width = (COL - GAP) / 2;
    let rowHeight = 0;
    let column = 0;

    for (const photo of images) {
      const ratio = photo.size ? photo.size.h / photo.size.w : 0.68;
      const height = Math.min(width * ratio, 250);
      if (column === 0) { this.room(height + 30); rowHeight = 0; }

      const x = MARGIN.x + column * (width + GAP);
      try {
        this.doc.addImage(photo.src, photo.format, x, this.y, width, height, undefined, 'FAST');
      } catch {
        // A photo the PDF engine can't read shouldn't cost the artist the whole kit.
        this.doc.setDrawColor(PAPER_LINE);
        this.doc.rect(x, this.y, width, height);
      }
      if (photo.label) {
        this.doc.setFont('Inter', 'normal');
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(PAPER_MUTED);
        this.doc.text(this.doc.splitTextToSize(photo.label, width)[0], x, this.y + height + 11);
      }

      rowHeight = Math.max(rowHeight, height + (photo.label ? 18 : 6));
      column += 1;
      if (column === 2) { this.y += rowHeight + GAP; column = 0; }
    }
    if (column === 1) this.y += rowHeight + GAP;
    this.y += 4;
  }
}

/**
 * The cover. The type block is laid out from the bottom of the page upwards — a gig
 * poster hangs its name off the bottom edge, and building it downwards from the photo
 * leaves a hole in the middle of the sheet.
 */
function cover(doc, document, coverPhoto) {
  doc.setFillColor(INK);
  doc.rect(0, 0, PAGE.w, PAGE.h, 'F');

  let bandBottom = 0;
  if (coverPhoto) {
    const height = 320;
    try {
      doc.addImage(coverPhoto.src, coverPhoto.format, 0, 0, PAGE.w, height, undefined, 'FAST');
      bandBottom = height;
    } catch { /* fall through to the type-only cover */ }
  }

  let y = PAGE.h - 54;

  if (document.contact) {
    const contact = String(document.contact).split('\n').filter(Boolean);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BONE_MUTED);
    doc.text(contact, MARGIN.x, y - (contact.length - 1) * 13);
    y -= (contact.length - 1) * 13 + 40;
  }

  if (document.strapline) {
    doc.setFont('Anton', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(FLASH_RED);
    doc.text(String(document.strapline).toUpperCase(), MARGIN.x, y, { charSpace: 1.1 });
    y -= 30;
  }

  if (document.tagline) {
    doc.setFont('Inter', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(BONE_MUTED);
    const tagline = doc.splitTextToSize(document.tagline, COL);
    doc.text(tagline, MARGIN.x, y - (tagline.length - 1) * 18);
    y -= (tagline.length - 1) * 18 + 34;
  }

  const headline = String(document.headline || 'Press kit').toUpperCase();
  doc.setFont('Anton', 'normal');
  doc.setTextColor(BONE);

  // Long names step down until the block both fits the width and clears the photo band.
  let size = headline.length > 26 ? 34 : headline.length > 16 ? 44 : 54;
  let lines;
  let top;
  for (;;) {
    doc.setFontSize(size);
    lines = doc.splitTextToSize(headline, COL);
    top = y - (lines.length - 1) * size * 1.02 - size * 0.73; // 0.73 ≈ Anton's cap height
    if ((lines.length <= 3 && top > bandBottom + 34) || size <= 22) break;
    size -= 4;
  }
  doc.text(lines, MARGIN.x, y - (lines.length - 1) * size * 1.02, { lineHeightFactor: 1.02, charSpace: 0.5 });

  doc.setDrawColor(FLASH_RED);
  doc.setLineWidth(2.5);
  doc.line(MARGIN.x, top - 20, MARGIN.x + 64, top - 20);
}

/**
 * Build the PDF. Returns the blob plus the filename and page count, so the caller can
 * download it, preview it, or record what was attached to a send.
 */
export async function generateEpkPdf({ document, epk, user }) {
  const { jsPDF, anton, inter } = await load();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  doc.addFileToVFS('anton.ttf', anton);
  doc.addFont('anton.ttf', 'Anton', 'normal');
  doc.addFileToVFS('inter.ttf', inter);
  doc.addFont('inter.ttf', 'Inter', 'normal');

  doc.setProperties({
    title: `${document.headline} — press kit`,
    subject: document.tagline || 'Electronic press kit',
    author: user?.artistName || document.headline,
    creator: 'GigFinder',
  });

  const sections = printableSections(document);

  // Photos are measured up front: the layout needs their aspect ratios, and reading them
  // is async while drawing is not.
  const wanted = new Map();
  for (const section of sections) {
    if (section.kind !== 'photos') continue;
    for (const photo of sectionPhotos(section, epk)) wanted.set(photo.id, photo);
  }
  const coverPhoto = (epk?.photos || []).find((p) => p.id === document.coverPhotoId) || null;
  if (coverPhoto) wanted.set(coverPhoto.id, coverPhoto);

  const measured = new Map();
  await Promise.all([...wanted.values()].map(async (photo) => {
    const format = imageFormat(photo.src);
    if (!format) return;
    measured.set(photo.id, { ...photo, format, size: await measureImage(photo.src) });
  }));

  cover(doc, document, measured.get(document.coverPhotoId) || null);

  const sheet = new Sheet(doc, { headline: document.headline || 'Press kit' });
  doc.addPage();
  sheet.page = 2;
  sheet.contentPage();

  for (const section of sections) {
    if (section.kind === 'photos') {
      const images = sectionPhotos(section, epk).map((p) => measured.get(p.id)).filter(Boolean);
      if (!images.length) continue;
      // Keep the heading with the first row of photos.
      const width = (COL - 14) / 2;
      const ratio = images[0].size ? images[0].size.h / images[0].size.w : 0.68;
      sheet.heading(section.title, Math.min(width * ratio, 250) + 30);
      sheet.photos(images);
    } else {
      sheet.heading(section.title);
      sheet.paragraphs(section.body);
    }
  }

  if (document.contact) {
    sheet.heading('Get in touch');
    sheet.paragraphs(document.contact);
  }

  return {
    blob: doc.output('blob'),
    filename: documentFilename(document),
    pages: doc.getNumberOfPages(),
  };
}
