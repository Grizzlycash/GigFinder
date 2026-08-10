// Map view — a separate nav item from Venues (they proved more usable apart).
//
// Drawn as a self-contained SVG plot (equirectangular projection, no tile server and no
// external library) so the prototype works offline. Pins carry the venue's initials and
// its pipeline colour; in the Bubble build this pane becomes the native map element.

import {
  activeVenues, venueById, outreachForVenue, statusMeta, STATUSES,
} from '../store.js';
import { esc, icon, initials, tileClass } from '../ui.js';

const W = 1000;
const H = 640;
const ui = { status: 'all', genre: null, selected: null };

/* ---------- Projection ---------- */
function mappable() {
  return activeVenues().filter(
    (v) => Number.isFinite(v.lat) && Number.isFinite(v.lng) && (v.lat !== 0 || v.lng !== 0),
  );
}

function project(venues) {
  const lats = venues.map((v) => v.lat);
  const lngs = venues.map((v) => v.lng);
  const meanLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw = (lat, lng) => ({ x: lng * k, y: -lat });

  const pts = venues.map((v) => raw(v.lat, v.lng));
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const padX = (maxX - minX) * 0.07 || 1;
  const padY = (maxY - minY) * 0.09 || 1;
  const bw = maxX - minX + padX * 2;
  const bh = maxY - minY + padY * 2;
  const scale = Math.min(W / bw, H / bh);
  const offX = (W - bw * scale) / 2;
  const offY = (H - bh * scale) / 2;

  return (lat, lng) => {
    const p = raw(lat, lng);
    return { x: offX + (p.x - minX + padX) * scale, y: offY + (p.y - minY + padY) * scale };
  };
}

function graticule(toXY, venues) {
  const lats = venues.map((v) => v.lat);
  const lngs = venues.map((v) => v.lng);
  const lo = (n) => Math.floor(n / 5) * 5;
  const hi = (n) => Math.ceil(n / 5) * 5;
  const lines = [];
  for (let lng = lo(Math.min(...lngs)) - 10; lng <= hi(Math.max(...lngs)) + 10; lng += 5) {
    const { x } = toXY(0, lng);
    lines.push(`<line class="map-graticule" x1="${x.toFixed(1)}" y1="-2000" x2="${x.toFixed(1)}" y2="${H + 2000}"/>`);
  }
  for (let lat = lo(Math.min(...lats)) - 10; lat <= hi(Math.max(...lats)) + 10; lat += 5) {
    const { y } = toXY(lat, 0);
    lines.push(`<line class="map-graticule" x1="-2000" y1="${y.toFixed(1)}" x2="${W + 2000}" y2="${y.toFixed(1)}"/>`);
  }
  return lines.join('');
}

function milesBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function visibleVenues() {
  return mappable().filter((v) => {
    const out = outreachForVenue(v.id);
    if (ui.status === 'none' && out) return false;
    if (ui.status === 'sent' && !(out && ['sent', 'opened'].includes(out.status))) return false;
    if (ui.status === 'booked' && out?.status !== 'booked') return false;
    if (ui.genre && !v.genres.includes(ui.genre)) return false;
    return true;
  });
}

/* ---------- Side panel ---------- */
function panel(rows) {
  const v = ui.selected ? venueById(ui.selected) : null;
  if (!v) {
    return `
      <div class="map-panel-empty">
        ${icon('pin', 'icon-lg')}
        <div style="margin-top:10px"><strong>Select a venue</strong></div>
        <p class="small muted" style="margin-top:4px">Click any pin to see venue details, the booking contact and what's nearby.</p>
        <div class="small muted" style="margin-top:14px">${rows.length} pin${rows.length === 1 ? '' : 's'} shown</div>
      </div>`;
  }

  const out = outreachForVenue(v.id);
  const meta = out ? statusMeta(out.status) : statusMeta('none');
  const nearby = mappable()
    .filter((u) => u.id !== v.id)
    .map((u) => ({ u, d: milesBetween(v, u) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);

  return `
    <div class="map-panel-section">
      <div class="row" style="gap:10px">
        <span class="tile ${tileClass(v.name)}">${esc(initials(v.name))}</span>
        <div class="grow" style="min-width:0">
          <div class="truncate"><strong>${esc(v.name)}</strong></div>
          <div class="xs muted">${esc(v.city)}${v.state ? `, ${esc(v.state)}` : ''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-clear-sel aria-label="Close">${icon('x')}</button>
      </div>
      <div class="row-wrap" style="margin-top:9px">
        <span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>
        ${v.genres.slice(0, 3).map((g) => `<span class="chip chip-static">${esc(g)}</span>`).join('')}
      </div>
    </div>

    <div class="map-panel-section">
      <div class="eyebrow" style="margin-bottom:7px">Venue details</div>
      <div class="drow"><span class="drow-label">Capacity</span><span class="drow-val">${v.capacity || '—'}</span></div>
      <div class="drow"><span class="drow-label">Type</span><span class="drow-val">${esc(v.type || '—')}</span></div>
      <div class="drow"><span class="drow-label">Pay type</span><span class="drow-val">${esc(v.payType || '—')}</span></div>
    </div>

    <div class="map-panel-section">
      <div class="eyebrow" style="margin-bottom:7px">Booking contact</div>
      <div class="contact-block">
        <span class="tile tile-sm tile-round ${tileClass(v.contactName || v.name)}">${esc(initials(v.contactName || v.name))}</span>
        <div class="grow" style="min-width:0">
          <div class="small"><strong>${esc(v.contactName || 'Booking desk')}</strong></div>
          <div class="xs truncate"><a href="mailto:${esc(v.contactEmail)}">${esc(v.contactEmail || '—')}</a></div>
        </div>
      </div>
    </div>

    <div class="map-panel-section" style="padding-left:0;padding-right:0">
      <div class="eyebrow" style="padding:0 15px 7px">Nearby venues</div>
      ${nearby.map(({ u, d }) => `
        <button class="lrow" data-pick="${esc(u.id)}">
          <span class="tile tile-sm ${tileClass(u.name)}">${esc(initials(u.name))}</span>
          <span class="lrow-main"><span class="lrow-name truncate" style="display:block">${esc(u.name)}</span></span>
          <span class="xs muted nowrap">${d < 10 ? d.toFixed(1) : Math.round(d)} mi</span>
        </button>`).join('')}
    </div>

    <div class="map-panel-actions">
      <a class="btn btn-primary btn-block" href="#/send?venue=${esc(v.id)}">${icon('send')} Send EPK to this venue</a>
      <a class="btn btn-block" href="#/venues/${esc(v.id)}">View full venue profile</a>
    </div>`;
}

export default {
  title: 'Map',
  flush: true,

  topbar() {
    return { title: 'Map', sub: `${mappable().length} mapped venues` };
  },

  render(ctx) {
    const fromQuery = ctx.query.get('venue');
    if (fromQuery) ui.selected = fromQuery;

    const all = mappable();
    if (!all.length) {
      return `<div class="grow"><div class="empty">${icon('map', 'icon-lg')}<h3>No mapped venues</h3><p class="muted">Venues need coordinates before they appear here.</p><a class="btn" href="#/venues">Venue list</a></div></div>`;
    }

    const rows = visibleVenues();
    const toXY = project(all);
    const genres = [...new Set(all.flatMap((v) => v.genres))].slice(0, 5);

    // Fan out pins that land on the same pixel so each stays clickable.
    const placed = rows.map((v) => ({ v, ...toXY(v.lat, v.lng) }));
    const buckets = new Map();
    placed.forEach((p) => {
      const key = `${Math.round(p.x / 10)}:${Math.round(p.y / 10)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    });
    buckets.forEach((group) => {
      if (group.length < 2) return;
      group.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / group.length;
        p.x += Math.cos(angle) * 11;
        p.y += Math.sin(angle) * 11;
      });
    });

    const markers = placed.map(({ v, x, y }) => {
      const out = outreachForVenue(v.id);
      const colour = out ? statusMeta(out.status).colour : statusMeta('none').colour;
      const sel = ui.selected === v.id;
      return `
        <g class="map-marker ${sel ? 'selected' : ''}" data-marker="${esc(v.id)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
          <g class="pin">
            <circle class="pin-halo" cx="0" cy="-11" r="17" fill="${colour}" opacity="0"></circle>
            <path d="M-4.5,-8 L0,1 L4.5,-8 Z" fill="${colour}"></path>
            <circle class="pin-body" cx="0" cy="-11" r="10" fill="${colour}"></circle>
            <text class="pin-label" x="0" y="-8" font-size="8">${esc(initials(v.name))}</text>
            <text class="map-name" x="15" y="-8" font-size="11" ${sel ? '' : 'display="none"'}>${esc(v.name)}</text>
          </g>
        </g>`;
    }).join('');

    return `
      <div class="grow" style="display:flex;flex-direction:column;min-width:0">
        <div class="filter-bar">
          <span class="filter-label">Show:</span>
          <button class="chip" data-status="all" aria-pressed="${ui.status === 'all'}">All venues</button>
          <button class="chip" data-status="none" aria-pressed="${ui.status === 'none'}">Not contacted</button>
          <button class="chip" data-status="sent" aria-pressed="${ui.status === 'sent'}">EPK sent</button>
          <button class="chip" data-status="booked" aria-pressed="${ui.status === 'booked'}">Booked</button>
          <span class="divider-v"></span>
          <span class="filter-label">Genre:</span>
          ${genres.map((g) => `<button class="chip" data-genre="${esc(g)}" aria-pressed="${ui.genre === g}">${esc(g)}</button>`).join('')}
          <span class="grow"></span>
          <a class="btn btn-sm" href="#/venues">${icon('list')} Venue list</a>
        </div>

        <div class="map-body">
          <div class="map-area">
            <svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" data-map>
              <g data-pan>
                <rect x="-3000" y="-3000" width="9000" height="9000" fill="#0A101A"></rect>
                ${graticule(toXY, all)}
                <g data-markers>${markers}</g>
              </g>
            </svg>

            <div class="map-overlay-tl">
              <div class="map-card">
                <div class="eyebrow">Venue status</div>
                <div class="map-legend-item"><span class="sw" style="background:${statusMeta('none').colour}"></span> Not contacted</div>
                ${STATUSES.map((s) => `<div class="map-legend-item"><span class="sw" style="background:${s.colour}"></span> ${esc(s.label)}</div>`).join('')}
              </div>
            </div>

            <div class="map-overlay-tr">
              <div class="map-card">${rows.length} of ${all.length} venues shown</div>
            </div>

            <div class="map-overlay-br">
              <button class="zoom-btn" data-zoom="in" aria-label="Zoom in">${icon('plus')}</button>
              <button class="zoom-btn" data-zoom="out" aria-label="Zoom out">${icon('minus')}</button>
              <button class="zoom-btn" data-zoom="reset" aria-label="Reset view">${icon('target')}</button>
            </div>
          </div>

          <div class="map-panel">${panel(rows)}</div>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const svg = root.querySelector('[data-map]');
    const pan = root.querySelector('[data-pan]');
    if (!svg || !pan) return;

    const view = { s: 1, tx: 0, ty: 0 };
    const markerNodes = Array.from(root.querySelectorAll('.map-marker'));

    function apply() {
      pan.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.s})`);
      const inv = (1 / view.s).toFixed(4);
      const showNames = view.s >= 2.2;
      markerNodes.forEach((node) => {
        node.querySelector('.pin').setAttribute('transform', `scale(${inv})`);
        const name = node.querySelector('.map-name');
        if (name) name.style.display = showNames || node.classList.contains('selected') ? '' : 'none';
      });
    }

    function unitsPerPx() {
      const rect = svg.getBoundingClientRect();
      return Math.max(W / rect.width, H / rect.height);
    }

    function zoomAt(factor, clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const upp = unitsPerPx();
      const sx = (clientX - rect.left - (rect.width - W / upp) / 2) * upp;
      const sy = (clientY - rect.top - (rect.height - H / upp) / 2) * upp;
      const next = Math.min(8, Math.max(1, view.s * factor));
      const k = next / view.s;
      view.tx = sx - (sx - view.tx) * k;
      view.ty = sy - (sy - view.ty) * k;
      view.s = next;
      if (view.s === 1) { view.tx = 0; view.ty = 0; }
      apply();
    }

    // Drag to pan. Deliberately NOT using setPointerCapture: capturing the pointer
    // retargets the following `click` to the <svg>, which would stop pins from ever
    // being selectable. Window listeners keep the drag alive outside the frame instead.
    let dragging = false;
    let moved = false;
    let last = { x: 0, y: 0 };

    const onMove = (e) => {
      if (!dragging) return;
      const upp = unitsPerPx();
      const dx = (e.clientX - last.x) * upp;
      const dy = (e.clientY - last.y) * upp;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      view.tx += dx;
      view.ty += dy;
      last = { x: e.clientX, y: e.clientY };
      apply();
    };

    const onUp = () => {
      dragging = false;
      svg.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
    };

    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      last = { x: e.clientX, y: e.clientY };
      svg.classList.add('dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
      window.addEventListener('pointercancel', onUp, { once: true });
    });

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY);
    }, { passive: false });

    root.querySelectorAll('[data-zoom]').forEach((btn) => btn.addEventListener('click', () => {
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (btn.dataset.zoom === 'in') zoomAt(1.4, cx, cy);
      else if (btn.dataset.zoom === 'out') zoomAt(1 / 1.4, cx, cy);
      else { view.s = 1; view.tx = 0; view.ty = 0; apply(); }
    }));

    markerNodes.forEach((node) => node.addEventListener('click', () => {
      if (moved) return;
      ui.selected = node.dataset.marker;
      ctx.rerender();
    }));

    root.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => {
      ui.selected = btn.dataset.pick;
      ctx.rerender();
    }));

    root.querySelector('[data-clear-sel]')?.addEventListener('click', () => {
      ui.selected = null;
      ctx.navigate('/map'); // navigating re-renders
    });

    root.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', () => {
      ui.status = btn.dataset.status;
      ctx.rerender();
    }));
    root.querySelectorAll('[data-genre]').forEach((btn) => btn.addEventListener('click', () => {
      ui.genre = ui.genre === btn.dataset.genre ? null : btn.dataset.genre;
      ctx.rerender();
    }));

    apply();
  },
};
