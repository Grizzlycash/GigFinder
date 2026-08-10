// Shared UI helpers: escaping, icons, formatting, toasts, modals.

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/* ---------- Icons (inline, stroke-based, no external assets) ---------- */
const PATHS = {
  home: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z"/>',
  pin: '<path d="M10 18s6-5.2 6-9.5A6 6 0 0 0 4 8.5C4 12.8 10 18 10 18Z"/><circle cx="10" cy="8.5" r="2.2"/>',
  map: '<path d="M2.5 5.5 7.5 3.5v11l-5 2v-11Z"/><path d="M7.5 3.5 12.5 5.5v11l-5-2v-11Z"/><path d="M12.5 5.5 17.5 3.5v11l-5 2v-11Z"/>',
  doc: '<path d="M5 2.5h6l4 4v11H5v-15Z"/><path d="M11 2.5v4h4"/>',
  send: '<path d="M17.5 2.5 9 11"/><path d="M17.5 2.5 12 17.5 9 11 2.5 8 17.5 2.5Z"/>',
  inbox: '<path d="M2.5 11.5 5 4h10l2.5 7.5v4a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-4Z"/><path d="M2.5 11.5h4l1 2h5l1-2h4"/>',
  chart: '<path d="M3 17V8"/><path d="M8.5 17V3"/><path d="M14 17v-6"/>',
  gear: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"/>',
  users: '<circle cx="7.5" cy="7" r="2.8"/><path d="M2.5 16.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/><path d="M13.5 5.2a2.8 2.8 0 0 1 0 5.4M14.5 12.4c2 .5 3.2 1.9 3.2 4.1"/>',
  db: '<ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5"/><path d="M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>',
  shield: '<path d="M10 2.5 16 5v5c0 4-2.6 6.6-6 7.5C6.6 16.6 4 14 4 10V5l6-2.5Z"/>',
  search: '<circle cx="9" cy="9" r="5.2"/><path d="M13 13l4 4"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  check: '<path d="M4 10.5 8 14.5 16 5.5"/>',
  x: '<path d="M5 5l10 10M15 5 5 15"/>',
  chevronRight: '<path d="M7.5 4 13 10l-5.5 6"/>',
  chevronLeft: '<path d="M12.5 4 7 10l5.5 6"/>',
  arrowLeft: '<path d="M16 10H4M9 5l-5 5 5 5"/>',
  external: '<path d="M11 3h6v6"/><path d="M17 3 9 11"/><path d="M15.5 11.5V17H3V4.5h5.5"/>',
  mail: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="m3 6 7 5 7-5"/>',
  upload: '<path d="M10 14V3.5"/><path d="m5.5 8 4.5-4.5L14.5 8"/><path d="M3 13.5v3h14v-3"/>',
  download: '<path d="M10 3.5V14"/><path d="m5.5 9.5 4.5 4.5 4.5-4.5"/><path d="M3 16.5h14"/>',
  trash: '<path d="M3.5 5.5h13"/><path d="M8 5.5V3.5h4v2"/><path d="M5 5.5 5.8 17h8.4L15 5.5"/>',
  edit: '<path d="M4 16h3l9-9-3-3-9 9v3Z"/>',
  lock: '<rect x="4" y="8.5" width="12" height="9" rx="1.5"/><path d="M7 8.5V6a3 3 0 0 1 6 0v2.5"/>',
  star: '<path d="m10 3 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L5.5 16.7l.9-5L2.8 8.2l5-.7L10 3Z"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.2l3 1.8"/>',
  bolt: '<path d="M11 2.5 4.5 11H9l-.5 6.5L15.5 9H11l0-6.5Z"/>',
  list: '<path d="M6.5 5.5h11M6.5 10h11M6.5 14.5h11"/><path d="M3 5.5h.01M3 10h.01M3 14.5h.01"/>',
  grid: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
  menu: '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>',
  logout: '<path d="M8 17H4.5A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3H8"/><path d="M12.5 13.5 17 10l-4.5-3.5"/><path d="M17 10H7.5"/>',
  music: '<path d="M8 15.5V5l8-1.5V14"/><ellipse cx="5.7" cy="15.3" rx="2.3" ry="2"/><ellipse cx="13.7" cy="13.8" rx="2.3" ry="2"/>',
  phone: '<path d="M17.5 14.2v2.3a1.5 1.5 0 0 1-1.7 1.5 15 15 0 0 1-6.5-2.4 14.8 14.8 0 0 1-4.5-4.5A15 15 0 0 1 2.4 4.6 1.5 1.5 0 0 1 3.9 3h2.3a1.5 1.5 0 0 1 1.5 1.3c.1.7.3 1.4.5 2.1a1.5 1.5 0 0 1-.3 1.6L7 9a11.5 11.5 0 0 0 4.5 4.5l1-1a1.5 1.5 0 0 1 1.6-.3c.7.2 1.4.4 2.1.5a1.5 1.5 0 0 1 1.3 1.5Z"/>',
  user: '<path d="M16.5 17.5v-1.7a3.3 3.3 0 0 0-3.3-3.3H6.8a3.3 3.3 0 0 0-3.3 3.3v1.7"/><circle cx="10" cy="6.3" r="3.3"/>',
  image: '<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><circle cx="7" cy="8" r="1.3"/><path d="m17.5 13-4-4-8 7.5"/>',
  sliders: '<path d="M9.5 4.5 5.5 7.8H2.5v4.4h3l4 3.3V4.5Z"/><path d="M13.3 7.5a4 4 0 0 1 0 5.6M15.8 5a7.5 7.5 0 0 1 0 10.6"/>',
  eye: '<path d="M1.5 10s3.2-6 8.5-6 8.5 6 8.5 6-3.2 6-8.5 6-8.5-6-8.5-6Z"/><circle cx="10" cy="10" r="2.4"/>',
  globe: '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15"/><path d="M10 2.5a12 12 0 0 1 3 7.5 12 12 0 0 1-3 7.5 12 12 0 0 1-3-7.5 12 12 0 0 1 3-7.5Z"/>',
  minus: '<path d="M4 10h12"/>',
  target: '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="2.6"/><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2"/>',
};

/* Deterministic tile colour so a venue keeps the same swatch everywhere. */
export function tileClass(seed) {
  const text = String(seed || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 997;
  return `t${(hash % 6) + 1}`;
}

export function icon(name, cls = '') {
  const body = PATHS[name] || PATHS.doc;
  return `<svg class="icon ${cls}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ---------- Formatting ---------- */
export function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDate(iso)}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
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

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function initials(name) {
  return String(name || '?')
    .trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0] || '')
    .join('').toUpperCase() || '?';
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

/* ---------- Toasts ---------- */
export function toast(message, kind = '') {
  const root = document.getElementById('toasts');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast ${kind ? `toast-${kind}` : ''}`;
  node.textContent = message;
  root.appendChild(node);
  // Keep the stack short — a run of quick actions shouldn't paper over the UI.
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => node.remove(), 3600);
}

/* ---------- Modal ---------- */
let closeActiveModal = null;

export function modal({ title, body, footer = '', size = '', onMount }) {
  closeModal();
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal ${size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="btn btn-ghost btn-sm" data-modal-close aria-label="Close">${icon('x')}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;

  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onKey);
  closeActiveModal = () => { document.removeEventListener('keydown', onKey); root.innerHTML = ''; closeActiveModal = null; };

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]') || e.target.hasAttribute('data-modal-backdrop')) closeModal();
  });

  if (onMount) onMount(root.querySelector('.modal'));
  const first = root.querySelector('input, select, textarea, button:not([data-modal-close])');
  if (first) first.focus();
}

export function closeModal() {
  if (closeActiveModal) closeActiveModal();
}

export function confirmModal(title, message, onConfirm, confirmLabel = 'Confirm') {
  modal({
    title,
    body: `<p class="muted">${esc(message)}</p>`,
    footer: `
      <button class="btn" data-modal-close>Cancel</button>
      <button class="btn btn-primary" data-confirm>${esc(confirmLabel)}</button>`,
    onMount(el) {
      el.querySelector('[data-confirm]').addEventListener('click', () => { closeModal(); onConfirm(); });
    },
  });
}

/* ---------- Misc ---------- */
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
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
