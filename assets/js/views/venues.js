// Venue database browser — search, filters, sort, and per-venue outreach state.

import {
  activeVenues, outreachForVenue, statusMeta, isPro, myLists, createList, toggleListVenue, can, suggestVenue,
} from '../store.js';
import { esc, icon, debounce, toast, download, modal, closeModal, plural } from '../ui.js';
import { VENUE_TYPES, ALL_GENRES } from '../seed.js';

const filters = {
  q: '',
  state: '',
  types: new Set(),
  genres: new Set(),
  capMin: '',
  capMax: '',
  hideContacted: false,
  sort: 'name',
};

export function applyFilters() {
  const q = filters.q.trim().toLowerCase();
  let rows = activeVenues().filter((v) => {
    if (q && ![v.name, v.city, v.state, v.type, v.contactName, v.genres.join(' ')].join(' ').toLowerCase().includes(q)) return false;
    if (filters.state && v.state !== filters.state) return false;
    if (filters.types.size && !filters.types.has(v.type)) return false;
    if (filters.genres.size && !v.genres.some((g) => filters.genres.has(g))) return false;
    if (filters.capMin && v.capacity < Number(filters.capMin)) return false;
    if (filters.capMax && v.capacity > Number(filters.capMax)) return false;
    if (filters.hideContacted && outreachForVenue(v.id)) return false;
    return true;
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    city: (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name),
    capAsc: (a, b) => a.capacity - b.capacity,
    capDesc: (a, b) => b.capacity - a.capacity,
  };
  rows = rows.sort(sorters[filters.sort] || sorters.name);
  return rows;
}

function venueCard(v) {
  const out = outreachForVenue(v.id);
  const meta = out ? statusMeta(out.status) : null;
  return `
    <article class="venue-card">
      <div class="row-between" style="align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:8px">
            <a class="vc-title" href="#/venues/${esc(v.id)}">${esc(v.name)}</a>
            ${meta ? `<span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>` : ''}
          </div>
          <div class="venue-meta">
            <span>${icon('pin')} ${esc(v.city)}, ${esc(v.state)}</span>
            <span>Cap ${v.capacity}</span>
            <span>${esc(v.type)}</span>
            <span>${esc(v.payType)}</span>
          </div>
          <div class="row-wrap" style="margin-top:8px">
            ${v.genres.map((g) => `<span class="chip chip-static">${esc(g)}</span>`).join('')}
          </div>
        </div>
        <div class="row" style="gap:6px">
          ${isPro() ? `<button class="btn btn-sm" data-save="${esc(v.id)}" title="Save to list">${icon('star')}</button>` : ''}
          <a class="btn btn-sm" href="#/venues/${esc(v.id)}">Details</a>
          <a class="btn btn-sm btn-primary" href="#/send?venue=${esc(v.id)}">${icon('send')} Send EPK</a>
        </div>
      </div>
    </article>`;
}

export default {
  title: 'Venues',
  wide: true,

  render() {
    const all = activeVenues();
    const states = [...new Set(all.map((v) => v.state))].sort();
    const rows = applyFilters();

    return `
      <div class="venue-layout">
        <aside class="card card-tight filters">
          <div class="filter-group">
            <div class="filter-title">Search</div>
            <div class="search">
              ${icon('search')}
              <input class="input" data-q value="${esc(filters.q)}" placeholder="Venue, city, contact…">
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-title">State</div>
            <select class="select" data-state>
              <option value="">All states</option>
              ${states.map((s) => `<option value="${esc(s)}" ${filters.state === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <div class="filter-title">Venue type</div>
            <div class="row-wrap">
              ${VENUE_TYPES.map((t) => `<button class="chip" data-type="${esc(t)}" aria-pressed="${filters.types.has(t)}">${esc(t)}</button>`).join('')}
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-title">Capacity</div>
            <div class="row">
              <input class="input" data-cap-min type="number" min="0" step="50" placeholder="Min" value="${esc(filters.capMin)}">
              <span class="muted">–</span>
              <input class="input" data-cap-max type="number" min="0" step="50" placeholder="Max" value="${esc(filters.capMax)}">
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-title">Genres booked</div>
            <div class="row-wrap">
              ${ALL_GENRES.map((g) => `<button class="chip" data-genre="${esc(g)}" aria-pressed="${filters.genres.has(g)}">${esc(g)}</button>`).join('')}
            </div>
          </div>

          <div class="filter-group">
            <label class="check">
              <input type="checkbox" data-hide ${filters.hideContacted ? 'checked' : ''}>
              <span>Hide venues I've contacted</span>
            </label>
            <button class="btn btn-sm btn-block" style="margin-top:12px" data-clear>Clear filters</button>
          </div>
        </aside>

        <section>
          <div class="row-between" style="margin-bottom:12px">
            <div>
              <h2 style="margin:0">${plural(rows.length, 'venue')}</h2>
              <div class="small muted">of ${all.length} in the shared database</div>
            </div>
            <div class="row">
              <button class="btn btn-sm" data-suggest>${icon('plus')} Suggest a venue</button>
              <select class="select" data-sort style="width:auto">
                <option value="name" ${filters.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
                <option value="city" ${filters.sort === 'city' ? 'selected' : ''}>Sort: City</option>
                <option value="capAsc" ${filters.sort === 'capAsc' ? 'selected' : ''}>Sort: Capacity ↑</option>
                <option value="capDesc" ${filters.sort === 'capDesc' ? 'selected' : ''}>Sort: Capacity ↓</option>
              </select>
              <button class="btn btn-sm" data-export>${icon('download')} Export CSV${can('csvExport') ? '' : ' (Pro)'}</button>
            </div>
          </div>

          ${rows.length
            ? rows.map(venueCard).join('')
            : `<div class="card empty"><h3>No venues match</h3><p class="muted">Try widening the capacity range or clearing a filter.</p><button class="btn" data-clear>Clear filters</button></div>`}
        </section>
      </div>`;
  },

  mount(root, ctx) {
    const rerender = () => ctx.rerender();

    const q = root.querySelector('[data-q]');
    q?.addEventListener('input', debounce(() => {
      filters.q = q.value;
      rerender();
      const next = document.querySelector('[data-q]');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 220));

    root.querySelector('[data-state]')?.addEventListener('change', (e) => { filters.state = e.target.value; rerender(); });
    root.querySelector('[data-sort]')?.addEventListener('change', (e) => { filters.sort = e.target.value; rerender(); });
    root.querySelector('[data-hide]')?.addEventListener('change', (e) => { filters.hideContacted = e.target.checked; rerender(); });
    root.querySelector('[data-cap-min]')?.addEventListener('change', (e) => { filters.capMin = e.target.value; rerender(); });
    root.querySelector('[data-cap-max]')?.addEventListener('change', (e) => { filters.capMax = e.target.value; rerender(); });

    root.querySelectorAll('[data-type]').forEach((chip) => chip.addEventListener('click', () => {
      const t = chip.dataset.type;
      if (filters.types.has(t)) filters.types.delete(t); else filters.types.add(t);
      rerender();
    }));

    root.querySelectorAll('[data-genre]').forEach((chip) => chip.addEventListener('click', () => {
      const g = chip.dataset.genre;
      if (filters.genres.has(g)) filters.genres.delete(g); else filters.genres.add(g);
      rerender();
    }));

    root.querySelectorAll('[data-clear]').forEach((btn) => btn.addEventListener('click', () => {
      filters.q = ''; filters.state = ''; filters.capMin = ''; filters.capMax = '';
      filters.types.clear(); filters.genres.clear(); filters.hideContacted = false; filters.sort = 'name';
      rerender();
    }));

    root.querySelector('[data-export]')?.addEventListener('click', () => {
      if (!can('csvExport')) { toast('CSV export is a Pro feature.'); ctx.navigate('/pricing'); return; }
      const rows = applyFilters();
      const head = ['Name', 'City', 'State', 'Capacity', 'Type', 'Genres', 'Contact', 'Email', 'Website'];
      const csv = [head, ...rows.map((v) => [v.name, v.city, v.state, v.capacity, v.type, v.genres.join('; '), v.contactName, v.contactEmail, v.website])]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      download('gigbook-venues.csv', csv);
      toast(`Exported ${rows.length} venues.`, 'good');
    });

    root.querySelector('[data-suggest]')?.addEventListener('click', () => {
      modal({
        title: 'Suggest a venue',
        body: `
          <p class="muted small">Missing somewhere you've played? Send it to the GigBook team — approved venues are added to the shared database for everyone.</p>
          <form class="form-grid" style="margin-top:14px" data-suggest-form>
            <div class="field span-2"><label for="sg-name">Venue name</label><input class="input" id="sg-name" name="name" required></div>
            <div class="field"><label for="sg-city">City</label><input class="input" id="sg-city" name="city" required></div>
            <div class="field"><label for="sg-state">State</label><input class="input" id="sg-state" name="state"></div>
            <div class="field"><label for="sg-cap">Capacity</label><input class="input" id="sg-cap" name="capacity" type="number"></div>
            <div class="field"><label for="sg-email">Booking email</label><input class="input" id="sg-email" name="contactEmail" type="email"></div>
            <div class="field span-2"><label for="sg-notes">Anything a booker should know</label><textarea class="textarea" id="sg-notes" name="notes" rows="3"></textarea></div>
          </form>`,
        footer: '<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" data-submit-suggestion>Submit for review</button>',
        onMount(el) {
          el.querySelector('[data-submit-suggestion]').addEventListener('click', () => {
            const form = el.querySelector('[data-suggest-form]');
            const d = Object.fromEntries(new FormData(form).entries());
            if (!String(d.name).trim() || !String(d.city).trim()) { toast('Name and city are required.', 'bad'); return; }
            suggestVenue({
              name: String(d.name).trim(),
              city: String(d.city).trim(),
              state: String(d.state || '').trim().toUpperCase(),
              capacity: Number(d.capacity) || 0,
              contactEmail: String(d.contactEmail || '').trim(),
              notes: String(d.notes || '').trim(),
            });
            closeModal();
            toast('Thanks — sent to the GigBook team for review.', 'good');
          });
        },
      });
    });

    root.querySelectorAll('[data-save]').forEach((btn) => btn.addEventListener('click', () => {
      const venueId = btn.dataset.save;
      const lists = myLists();
      modal({
        title: 'Save to list',
        body: lists.length
          ? `<div class="stack-sm">${lists.map((l) => `
              <label class="check"><input type="checkbox" data-list="${esc(l.id)}" ${l.venueIds.includes(venueId) ? 'checked' : ''}>
              <span>${esc(l.name)} <span class="muted small">(${l.venueIds.length})</span></span></label>`).join('')}</div>
             <hr><div class="field"><label for="new-list">Or create a new list</label><input class="input" id="new-list" placeholder="Southeast run — October"></div>`
          : `<div class="field"><label for="new-list">Create your first list</label><input class="input" id="new-list" placeholder="Southeast run — October"></div>`,
        footer: '<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" data-done>Done</button>',
        onMount(el) {
          el.querySelectorAll('[data-list]').forEach((cb) => cb.addEventListener('change', () => toggleListVenue(cb.dataset.list, venueId)));
          el.querySelector('[data-done]').addEventListener('click', () => {
            const name = el.querySelector('#new-list').value.trim();
            if (name) {
              const list = createList(name);
              toggleListVenue(list.id, venueId);
            }
            closeModal();
            toast('Saved.', 'good');
            ctx.rerender();
          });
        },
      });
    }));
  },
};
