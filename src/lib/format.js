export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

/** Prices are in Australian dollars — this is a Melbourne product. */
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
