// Map view — a separate nav item from Venues (they proved more usable apart).
//
// The map is drawn as a self-contained SVG plot (equirectangular projection, no tile
// server, no external library) so the prototype works offline. In the Bubble build this
// pane is replaced by the native map element; the pins, colours and side panel behave the same.

import { activeVenues, outreachForVenue, statusMeta, STATUSES, venueById } from '../store.js';
import { esc, icon } from '../ui.js';

const W = 1000;
const H = 640;

const ui = { state: '', onlyUncontacted: false, selected: null };

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

  const padX = (maxX - minX) * 0.06 || 1;
  const padY = (maxY - minY) * 0.06 || 1;
  const bw = maxX - minX + padX * 2;
  const bh = maxY - minY + padY * 2;
  const scale = Math.min(W / bw, H / bh);
  const offX = (W - bw * scale) / 2;
  const offY = (H - bh * scale) / 2;

  return (lat, lng) => {
    const p = raw(lat, lng);
    return {
      x: offX + (p.x - minX + padX) * scale,
      y: offY + (p.y - minY + padY) * scale,
    };
  };
}

function graticule(toXY, venues) {
  const lats = venues.map((v) => v.lat);
  const lngs = venues.map((v) => v.lng);
  const lo = (n, step) => Math.floor(n / step) * step;
  const hi = (n, step) => Math.ceil(n / step) * step;
  const lines = [];

  // The projection is separable (x from longitude, y from latitude), so each meridian
  // and parallel can simply run the full height/width of the canvas.
  for (let lng = lo(Math.min(...lngs), 5) - 10; lng <= hi(Math.max(...lngs), 5) + 10; lng += 5) {
    const { x } = toXY(0, lng);
    lines.push(`<line class="map-graticule" x1="${x.toFixed(1)}" y1="-2000" x2="${x.toFixed(1)}" y2="${H + 2000}"/>`);
  }
  for (let lat = lo(Math.min(...lats), 5) - 10; lat <= hi(Math.max(...lats), 5) + 10; lat += 5) {
    const { y } = toXY(lat, 0);
    lines.push(`<line class="map-graticule" x1="-2000" y1="${y.toFixed(1)}" x2="${W + 2000}" y2="${y.toFixed(1)}"/>`);
  }
  return lines.join('');
}

// Rows added by hand or via import may have no coordinates yet — they'd stretch the
// projection to the Gulf of Guinea, so the map simply leaves them out.
function mappable() {
  return activeVenues().filter(
    (v) => Number.isFinite(v.lat) && Number.isFinite(v.lng) && (v.lat !== 0 || v.lng !== 0),
  );
}

function visibleVenues() {
  return mappable().filter((v) => {
    if (ui.state && v.state !== ui.state) return false;
    if (ui.onlyUncontacted && outreachForVenue(v.id)) return false;
    return true;
  });
}

function sidePanel(rows) {
  const v = ui.selected ? venueById(ui.selected) : null;
  if (v) {
    const out = outreachForVenue(v.id);
    const meta = out ? statusMeta(out.status) : null;
    return `
      <div class="card">
        <div class="row-between" style="align-items:flex-start">
          <div>
            <h3 style="margin-bottom:2px">${esc(v.name)}</h3>
            <div class="small muted">${esc(v.city)}, ${esc(v.state)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-clear-sel aria-label="Close">${icon('x')}</button>
        </div>
        ${meta ? `<div style="margin-top:8px"><span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span></div>` : ''}
        <div class="venue-meta" style="margin-top:10px">
          <span>Cap ${v.capacity}</span><span>${esc(v.type)}</span><span>${esc(v.payType)}</span>
        </div>
        <p class="small muted" style="margin-top:10px">${esc(v.notes)}</p>
        <div class="row" style="margin-top:12px">
          <a class="btn btn-sm" href="#/venues/${esc(v.id)}">Details</a>
          <a class="btn btn-sm btn-primary" href="#/send?venue=${esc(v.id)}">${icon('send')} Send EPK</a>
        </div>
      </div>`;
  }

  return `
    <div class="card card-flush">
      <div class="card-head"><h3>${rows.length} pins</h3><span class="small muted">Click a pin</span></div>
      <div>
        ${rows.slice(0, 40).map((venue) => {
          const out = outreachForVenue(venue.id);
          const meta = out ? statusMeta(out.status) : statusMeta('none');
          return `<button class="row-between" data-pick="${esc(venue.id)}" style="width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:10px 16px;font:inherit;cursor:pointer">
            <span class="grow truncate"><strong>${esc(venue.name)}</strong><br><span class="small muted">${esc(venue.city)}, ${esc(venue.state)}</span></span>
            <span class="badge ${meta.cls}"><span class="dot"></span></span>
          </button>`;
        }).join('')}
        ${rows.length > 40 ? `<div class="small muted" style="padding:10px 16px">Showing 40 of ${rows.length}. Filter to narrow.</div>` : ''}
      </div>
    </div>`;
}

export default {
  title: 'Map',
  wide: true,

  render(ctx) {
    const fromQuery = ctx.query.get('venue');
    if (fromQuery) ui.selected = fromQuery;

    const all = mappable();
    if (!all.length) {
      return '<div class="card empty"><h3>No mapped venues</h3><p class="muted">Venues need coordinates before they can appear here.</p><a class="btn" href="#/venues">Venue list</a></div>';
    }
    const rows = visibleVenues();
    const toXY = project(all);
    const states = [...new Set(all.map((v) => v.state))].sort();

    // Two venues in the same city land on the same pixel — fan co-located pins out
    // around a small circle so each stays clickable.
    const placed = rows.map((v) => ({ v, ...toXY(v.lat, v.lng) }));
    const buckets = new Map();
    placed.forEach((p) => {
      const key = `${Math.round(p.x / 8)}:${Math.round(p.y / 8)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    });
    buckets.forEach((group) => {
      if (group.length < 2) return;
      group.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / group.length;
        p.x += Math.cos(angle) * 9;
        p.y += Math.sin(angle) * 9;
      });
    });

    const markers = placed.map(({ v, x, y }) => {
      const out = outreachForVenue(v.id);
      const colour = out ? statusMeta(out.status).colour : statusMeta('none').colour;
      return `<g class="map-marker ${ui.selected === v.id ? 'selected' : ''}" data-marker="${esc(v.id)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
          <circle r="6" fill="${colour}"></circle>
          <text class="map-city" x="9" y="4">${esc(v.name)}</text>
        </g>`;
    }).join('');

    return `
      <div class="map-layout">
        <div>
          <div class="row-between" style="margin-bottom:12px">
            <div class="row">
              <select class="select" data-state style="width:auto">
                <option value="">All states</option>
                ${states.map((s) => `<option value="${esc(s)}" ${ui.state === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
              </select>
              <label class="check"><input type="checkbox" data-unc ${ui.onlyUncontacted ? 'checked' : ''}><span class="small">Not yet contacted</span></label>
            </div>
            <a class="btn btn-sm" href="#/venues">${icon('list')} Venue list</a>
          </div>

          <div class="map-frame">
            <svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" data-map>
              <g data-pan>
                <rect x="-2000" y="-2000" width="6000" height="6000" fill="#EEF3F1"></rect>
                ${graticule(toXY, all)}
                <g data-markers>${markers}</g>
              </g>
            </svg>
            <div class="map-controls">
              <button class="btn" data-zoom="in" aria-label="Zoom in">${icon('plus')}</button>
              <button class="btn" data-zoom="out" aria-label="Zoom out"><svg class="icon" viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 10h12"/></svg></button>
              <button class="btn" data-zoom="reset" aria-label="Reset view">${icon('map')}</button>
            </div>
            <div class="map-legend">
              <div class="row"><span class="sw" style="background:${statusMeta('none').colour}"></span> Not contacted</div>
              ${STATUSES.map((s) => `<div class="row"><span class="sw" style="background:${s.colour}"></span> ${esc(s.label)}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="map-side">${sidePanel(rows)}</div>
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
      const r = (6 / view.s).toFixed(2);
      const fs = (11 / view.s).toFixed(2);
      const showLabels = view.s >= 2.2;
      markerNodes.forEach((node) => {
        node.querySelector('circle').setAttribute('r', r);
        const text = node.querySelector('text');
        text.setAttribute('font-size', fs);
        text.setAttribute('x', (9 / view.s).toFixed(2));
        text.setAttribute('y', (4 / view.s).toFixed(2));
        text.style.display = showLabels || node.classList.contains('selected') ? '' : 'none';
      });
    }

    function unitsPerPx() {
      const rect = svg.getBoundingClientRect();
      // preserveAspectRatio="meet": the limiting axis sets the scale.
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

    let dragging = false;
    let moved = false;
    let last = { x: 0, y: 0 };

    svg.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;
      last = { x: e.clientX, y: e.clientY };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('dragging');
    });

    svg.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const upp = unitsPerPx();
      const dx = (e.clientX - last.x) * upp;
      const dy = (e.clientY - last.y) * upp;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      view.tx += dx;
      view.ty += dy;
      last = { x: e.clientX, y: e.clientY };
      apply();
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      svg.classList.remove('dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch { /* pointer already released */ }
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

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
      ctx.navigate('/map'); // navigating re-renders; no explicit rerender needed
    });

    root.querySelector('[data-state]')?.addEventListener('change', (e) => { ui.state = e.target.value; ctx.rerender(); });
    root.querySelector('[data-unc]')?.addEventListener('change', (e) => { ui.onlyUncontacted = e.target.checked; ctx.rerender(); });

    apply();
  },
};
