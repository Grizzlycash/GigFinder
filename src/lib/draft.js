/**
 * Booking-email drafting.
 *
 * The seam between "the app writes the email" and "a model writes the email".
 *
 * Privacy boundary — the one rule this module exists to enforce:
 *   The booking contact's name and email address NEVER go into the payload.
 *   The artist's bio is their own marketing copy and is fine to send; the venue's
 *   booking details are business data from the shared database. The contact is a
 *   third party who never agreed to be processed by a model vendor, so drafts
 *   carry the literal placeholder `{contact}` and the real name is substituted
 *   in the browser after the text comes back.
 *
 * Everything here runs on-device by default. `setDraftProvider()` is the single
 * hook a backend implementation plugs into; if it is absent or throws, drafting
 * falls back to the deterministic local version so the app keeps working offline.
 */

export const CONTACT_PLACEHOLDER = '{contact}';

export const TONES = [
  { id: 'straight', label: 'Straight up' },
  { id: 'warm', label: 'Warm' },
  { id: 'short', label: 'Short' },
];

export const REWRITES = [
  { id: 'tighten', label: 'Tighten', hint: 'Cut the filler words' },
  { id: 'warmer', label: 'Warm it up', hint: 'Open with something about the room' },
  { id: 'shorten', label: 'Shorten', hint: 'Bio down to the essentials' },
  { id: 'personalise', label: 'Personalise', hint: "Work in this venue's booking notes" },
];

/* ------------------------------------------------------------------ *
 * Payload
 * ------------------------------------------------------------------ */

/**
 * Everything a model needs to draft the email, and nothing it doesn't.
 * Deliberately built by allow-list: new venue or user fields are excluded until
 * someone adds them here on purpose.
 */
export function buildPayload({ user = {}, venue = {}, epk = {} }) {
  const music = epk.music || {};
  return {
    artist: {
      name: user.artistName || '',
      signOff: user.realName || user.artistName || '',
      genres: epk.genres || user.genres || [],
      basedIn: epk.homeCity || user.homeCity || '',
      typicalDraw: user.drawSize || '',
      setLength: epk.setLength || '',
    },
    bio: epk.shortBio || '',
    notable: epk.notable || '',
    links: {
      tracks: (epk.tracks || []).filter((t) => t.url).slice(0, 2).map((t) => ({ title: t.title || 'Listen', url: t.url })),
      primary: music.spotify || music.bandcamp || music.soundcloud || music.appleMusic || '',
      video: music.youtube || '',
    },
    venue: {
      name: venue.name || '',
      suburb: venue.city || '',
      type: venue.type || '',
      capacity: venue.capacity || 0,
      genres: venue.genres || [],
      bookingNotes: venue.notes || '',
      payType: venue.payType || '',
      // No contactName. No contactEmail. See the module header.
    },
  };
}

/** Swap a real contact name back out for the placeholder before anything leaves. */
export function redactContact(text, contactName) {
  if (!text) return '';
  const name = String(contactName || '').trim();
  if (!name) return text;
  const parts = [name, name.split(/\s+/)[0]].filter(Boolean);
  return parts.reduce((out, part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return out.replace(new RegExp(`\\b${escaped}\\b`, 'g'), CONTACT_PLACEHOLDER);
  }, text);
}

/** Put the contact's first name back in, for display only. */
export function applyContact(text, contactName) {
  const first = String(contactName || '').trim().split(/\s+/)[0] || 'there';
  return String(text || '').replaceAll(CONTACT_PLACEHOLDER, first);
}

/* ------------------------------------------------------------------ *
 * Local (deterministic) drafting
 * ------------------------------------------------------------------ */

const paragraphs = (text) => String(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const join = (parts) => parts.filter(Boolean).join('\n\n');

function sentences(text) {
  return String(text).match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) || [];
}

function warmOpener(payload) {
  const { venue } = payload;
  return `Big fan of what you've been putting on at ${venue.name || 'the venue'} — it's exactly the kind of room we want to play.`;
}

function personalLine(payload) {
  const { venue, artist } = payload;
  const shared = (venue.genres || []).filter((g) => (artist.genres || []).includes(g));
  if (shared.length) {
    return `We saw you book ${shared.slice(0, 2).join(' and ')} — that's our lane, and ${venue.capacity ? `a ${venue.capacity}-cap room` : 'a room like yours'} is about where we're drawing.`;
  }
  if (venue.bookingNotes) {
    return `Noted that you ${venue.bookingNotes.charAt(0).toLowerCase()}${venue.bookingNotes.slice(1).replace(/\.$/, '')} — happy to work to that.`;
  }
  return `${venue.name} looks like the right size room for where we're at${artist.typicalDraw ? `, drawing ${artist.typicalDraw.toLowerCase()}` : ''}.`;
}

/** The base draft. Always emits `{contact}`, never a real name. */
export function localCompose({ payload, tone = 'straight' }) {
  const { artist, bio, links, venue } = payload;
  const parts = [`Hi ${CONTACT_PLACEHOLDER},`];

  if (tone === 'warm') parts.push(warmOpener(payload));
  if (tone === 'short') parts.push(`${artist.name || 'We'} would love a date at ${venue.name || 'your venue'}.`);

  parts.push(bio || 'Add a short bio to your EPK and it will appear here.');

  const linkLines = [];
  if (links.tracks.length) links.tracks.forEach((t) => linkLines.push(`${t.title}: ${t.url}`));
  else if (links.primary) linkLines.push(`Listen: ${links.primary}`);
  if (links.video && tone !== 'short') linkLines.push(`Live video: ${links.video}`);
  if (linkLines.length) parts.push(linkLines.join('\n'));

  if (tone !== 'short') {
    parts.push(
      `We'd love to be considered for a date at ${venue.name || 'your venue'}${
        artist.typicalDraw ? `. We usually pull ${artist.typicalDraw.toLowerCase()} in-market` : ''
      }. Full EPK, photos and press are attached.`,
    );
  }

  parts.push([tone === 'warm' ? 'Thanks so much for your time,' : 'Thanks for your time,', artist.signOff].filter(Boolean).join('\n'));
  return join(parts);
}

const FILLER = [
  'just ', 'really ', 'very ', 'quite ', 'actually ', 'basically ', 'honestly ',
  'I think ', 'we think ', 'a bit of ', 'sort of ', 'kind of ',
];

/**
 * On-device approximations of the rewrite actions. These are what run when no
 * model provider is configured — deliberately conservative, since they operate on
 * the artist's own words.
 */
export function localRewrite({ text, action, payload }) {
  const parts = paragraphs(text);
  if (!parts.length) return text;

  switch (action) {
    case 'tighten': {
      return join(parts.map((p) => FILLER.reduce(
        (out, word) => out.replace(new RegExp(`\\b${word}`, 'gi'), ''),
        p,
      ).replace(/ {2,}/g, ' ').trim()));
    }

    case 'warmer': {
      const opener = warmOpener(payload);
      if (text.includes(opener)) return text;
      return join([parts[0], opener, ...parts.slice(1)]);
    }

    case 'shorten': {
      const [greeting, ...rest] = parts;
      const bodyParas = rest.filter((p) => !/^(thanks)/i.test(p));
      const closing = rest.find((p) => /^(thanks)/i.test(p));
      const trimmed = bodyParas.map((p, i) => (i === 0 ? sentences(p).slice(0, 2).join(' ') : p));
      // Keep the greeting, a two-sentence bio, the links, and the sign-off.
      const links = trimmed.find((p) => p.includes('http')) || '';
      return join([greeting, trimmed[0], links, closing]);
    }

    case 'personalise': {
      const line = personalLine(payload);
      if (text.includes(line)) return text;
      const insertAt = Math.min(2, parts.length - 1);
      return join([...parts.slice(0, insertAt), line, ...parts.slice(insertAt)]);
    }

    default:
      return text;
  }
}

/* ------------------------------------------------------------------ *
 * Provider hook
 * ------------------------------------------------------------------ */

let provider = null;
const cache = new Map();
const cacheKey = (o) => JSON.stringify(o);

/**
 * Register the backend that talks to a model.
 *
 *   setDraftProvider(async ({ payload, action, tone, text, signal }) => {
 *     const res = await fetch('/api/draft', {
 *       method: 'POST',
 *       headers: { 'content-type': 'application/json' },
 *       body: JSON.stringify({ payload, action, tone, text }),
 *       signal,
 *     });
 *     if (!res.ok) throw new Error(`draft failed: ${res.status}`);
 *     return (await res.json()).text;   // must keep {contact} intact
 *   });
 *
 * The API key lives on that backend, never in this bundle.
 */
export function setDraftProvider(fn) {
  provider = typeof fn === 'function' ? fn : null;
  // Drafts cached from the previous configuration are stale the moment the
  // provider changes — otherwise connecting a backend would silently keep
  // serving on-device text.
  cache.clear();
}

export function hasDraftProvider() {
  return Boolean(provider);
}

/**
 * Draft or rewrite the email.
 * Returns { text, source } where source is 'remote' | 'local' | 'cache'.
 * `text` still contains {contact} — call applyContact() before display.
 */
export async function draftEmail({ payload, action = null, tone = 'straight', text = '', signal } = {}) {
  const key = cacheKey({
    remote: Boolean(provider),
    v: payload?.venue?.name,
    b: payload?.bio,
    action,
    tone,
    text: action ? text : '',
  });
  if (cache.has(key)) return { text: cache.get(key), source: 'cache' };

  const fallback = () => (action ? localRewrite({ text, action, payload }) : localCompose({ payload, tone }));

  if (!provider) {
    const local = fallback();
    cache.set(key, local);
    return { text: local, source: 'local' };
  }

  try {
    const remote = await provider({ payload, action, tone, text, signal });
    const clean = String(remote || '').trim();
    if (!clean) throw new Error('empty draft');
    cache.set(key, clean);
    return { text: clean, source: 'remote' };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    console.warn('Draft provider failed, falling back to the local draft:', err);
    return { text: fallback(), source: 'local', error: err };
  }
}

/** Exactly what would be transmitted — used by the "what gets sent" disclosure. */
export function previewTransmission({ payload, action, tone, text, contactName }) {
  return {
    action: action || `compose (${tone})`,
    payload,
    text: action ? redactContact(text, contactName) : undefined,
  };
}
