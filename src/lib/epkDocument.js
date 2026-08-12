/**
 * The press kit as a *document* rather than a form.
 *
 * The EPK generator stores structured fields (music links, rider, quotes). A PDF needs
 * something flatter: an ordered run of titled blocks the artist can reword, reorder or
 * leave out. This module is the conversion, and it is deliberately pure — no browser, no
 * jsPDF — so the layout and the tests can both rely on it.
 *
 * Every block carries plain text, including the ones built from structured data. One
 * textarea per block is the whole editing model, and an artist who wants to write
 * "Spotify — we're the loud one" instead of a bare URL can just type it.
 */

const LINE = ' — ';

const MUSIC_LABELS = {
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  appleMusic: 'Apple Music',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
};

const SOCIAL_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  website: 'Website',
};

const RIDER_LABELS = {
  format: 'Format',
  pa: 'PA',
  mics: 'Microphones',
  di: 'DI boxes',
  monitors: 'Monitors',
  setupTime: 'Set-up time',
  hospitality: 'Hospitality',
  notes: 'Notes',
};

/** "Key — value" lines, skipping anything empty. */
function pairs(source, labels) {
  return Object.entries(labels)
    .map(([key, label]) => [label, String(source?.[key] || '').trim()])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}${LINE}${value}`)
    .join('\n');
}

function clean(text) {
  return String(text || '').trim();
}

/**
 * Build the document from the EPK. Sections with nothing in them are left out entirely
 * rather than printed empty — a press kit with a blank "Press" heading reads worse than
 * one without the heading.
 */
export function buildDocument(epk, user = {}) {
  const e = epk || {};
  const tracks = (e.tracks || []).filter((t) => t.url || t.title);
  const quotes = (e.pressQuotes || []).filter((q) => clean(q.text));
  const photos = (e.photos || []).filter((p) => p.src);

  const listen = [
    pairs(e.music, MUSIC_LABELS),
    tracks.map((t) => `${clean(t.title) || 'Untitled'}${t.url ? LINE + t.url : ''}`).join('\n'),
  ].filter(Boolean).join('\n');

  const live = [
    e.setLength && `Set length${LINE}${e.setLength}`,
    e.audienceSize && `Typical draw${LINE}${e.audienceSize}`,
    e.rider?.format && `Format${LINE}${e.rider.format}`,
    e.homeCity && `Based in${LINE}${e.homeCity}`,
  ].filter(Boolean).join('\n');

  const candidates = [
    { kind: 'bio', title: 'Biography', body: [clean(e.shortBio), clean(e.longBio)].filter(Boolean).join('\n\n') },
    { kind: 'notable', title: 'Notable shows', body: clean(e.notable) },
    { kind: 'quotes', title: 'Press', body: quotes.map((q) => `“${clean(q.text)}”${q.source ? `\n— ${clean(q.source)}` : ''}`).join('\n\n') },
    { kind: 'live', title: 'The live show', body: live },
    { kind: 'music', title: 'Listen', body: listen },
    { kind: 'photos', title: 'Photos', body: '', photoIds: photos.map((p) => p.id) },
    { kind: 'links', title: 'Find us', body: pairs(e.socials, SOCIAL_LABELS) },
    { kind: 'rider', title: 'Technical rider', body: pairs(e.rider, RIDER_LABELS) },
  ];

  return {
    headline: clean(e.title?.replace(/\s+—\s+EPK$/, '')) || clean(user.artistName) || 'Press kit',
    tagline: clean(e.tagline),
    strapline: [clean(e.homeCity), (e.genres || []).join(' · ')].filter(Boolean).join('  ·  '),
    coverPhotoId: photos[0]?.id || null,
    contact: [
      clean(user.realName) || clean(user.artistName),
      clean(user.email),
      clean(e.socials?.website),
    ].filter(Boolean).join('\n'),
    sections: candidates
      .filter((s) => (s.kind === 'photos' ? s.photoIds.length > 0 : Boolean(s.body)))
      .map((s, i) => ({ id: `sec_${s.kind}`, include: true, order: i, ...s })),
  };
}

/** The document to work from: the artist's edited one if they have it, otherwise a fresh build. */
export function documentFor(epk, user) {
  const stored = epk?.document;
  if (!stored || !Array.isArray(stored.sections) || !stored.sections.length) return buildDocument(epk, user);
  return { ...buildDocument(epk, user), ...stored, sections: stored.sections.map((s) => ({ ...s })) };
}

/** Sections that will actually print, in order. */
export function printableSections(doc) {
  return (doc?.sections || [])
    .filter((s) => s.include !== false && (s.kind === 'photos' ? (s.photoIds || []).length > 0 : clean(s.body)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Move a section up or down, renumbering so the order stays contiguous. */
export function reorderSection(doc, id, direction) {
  const sections = [...(doc.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const from = sections.findIndex((s) => s.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= sections.length) return doc;
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return { ...doc, sections: sections.map((s, i) => ({ ...s, order: i })) };
}

export function updateSection(doc, id, patch) {
  return { ...doc, sections: (doc.sections || []).map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** Photos referenced by a photo section, resolved against the EPK. */
export function sectionPhotos(section, epk) {
  const byId = new Map((epk?.photos || []).map((p) => [p.id, p]));
  return (section.photoIds || []).map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Roughly how long the printed document runs. Used for "3 pages" in the UI before the
 * PDF is built — the renderer paginates for real, this only has to be close.
 */
export function estimatePages(doc, epk) {
  const CHARS_PER_PAGE = 2600;
  const load = printableSections(doc).reduce((total, s) => {
    if (s.kind === 'photos') return total + sectionPhotos(s, epk).length * 900;
    return total + clean(s.body).length + 260; // 260 ≈ the heading and its air
  }, 0);
  return 1 + Math.max(1, Math.ceil(load / CHARS_PER_PAGE)); // cover + content
}

export function documentFilename(doc) {
  const slug = String(doc?.headline || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug ? `${slug}-press-kit.pdf` : 'press-kit.pdf';
}
