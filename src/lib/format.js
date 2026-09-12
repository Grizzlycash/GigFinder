export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

/** Prices are in Australian dollars — the business is Australian, wherever the rooms are. */
export function money(n) {
  return AUD.format(Number(n));
}

/** Explicit form for anywhere the actual charge is stated. */
export function moneyAud(n) {
  return `${AUD.format(Number(n))} AUD`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
}

export function relTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < day) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < day * 30) return `${Math.round(diff / day)}d ago`;
  return fmtDate(iso);
}

export function initials(name) {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase() || '?'
  );
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

export function milesBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km — this is an Australian product
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * A Google Maps link for a venue, built from what the spreadsheet already has.
 *
 * This is not a substitute for `lat`/`lng`: the in-app map plots its own pins and needs
 * numbers. What this does is answer "where actually is this, and how do I get there" without
 * geocoding anything — Google's search resolves a name plus a street address better than any
 * geocoder we'd run ourselves, and the artist lands on the venue's real listing with
 * directions, hours and street view.
 *
 * Searching on name *and* address is deliberate. The address alone drops a pin on a
 * building; the name gets the business card.
 */
export function mapsUrl(venue) {
  if (!venue) return '';
  const query = [venue.name, venue.address || [venue.city, venue.state].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function download(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
