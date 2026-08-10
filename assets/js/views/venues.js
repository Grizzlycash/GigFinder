// Venue browser — filter chip bar, venue list column, detail pane.

import {
  activeVenues, venueById, outreachForVenue, myOutreach, statusMeta, STATUSES,
  setOutreachStatus, updateOutreach, isPro, myLists, createList, toggleListVenue,
  can, addVenue, myPrivateVenues,
} from '../store.js';
import {
  esc, icon, toast, download, modal, closeModal, tileClass, initials,
  fmtDate, fmtDateTime, debounce, plural,
} from '../ui.js';
import { VENUE_TYPES, ALL_GENRES } from '../seed.js';

const filters = { q: '', status: 'all', genre: null, size: null, sort: 'name' };

function matchesStatus(venue) {
  const out = outreachForVenue(venue.id);
  switch (filters.status) {
    case 'none': return !out;
    case 'sent': return Boolean(out) && ['sent', 'opened'].includes(out.status);
    case 'replied': return out?.status === 'replied';
    case 'booked': return out?.status === 'booked';
    case 'followup': return Boolean(out?.followUpAt) && new Date(out.followUpAt) <= new Date() && ['sent', 'opened'].includes(out.status);
    default: return true;
  }
}

function applyFilters() {
  const q = filters.q.trim().toLowerCase();
  const rows = activeVenues().filter((v) => {
    if (q && ![v.name, v.city, v.state, v.type, v.contactName, v.genres.join(' ')].join(' ').toLowerCase().includes(q)) return false;
    if (!matchesStatus(v)) return false;
    if (filters.genre && !v.genres.includes(filters.genre)) return false;
    if (filters.size === 'small' && v.capacity >= 100) return false;
    if (filters.size === 'mid' && (v.capacity < 100 || v.capacity >= 400)) return false;
    if (filters.size === 'large' && v.capacity < 400) return false;
    return true;
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    city: (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name),
    capDesc: (a, b) => b.capacity - a.capacity,
    capAsc: (a, b) => a.capacity - b.capacity,
  };
  return rows.sort(sorters[filters.sort] || sorters.name);
}

function chip(label, group, value) {
  const active = filters[group] === value;
  return `<button class="chip" data-filter="${group}" data-value="${esc(String(value))}" aria-pressed="${active}">${esc(label)}</button>`;
}

function listRow(v, selectedId) {
  const out = outreachForVenue(v.id);
  const meta = out ? statusMeta(out.status) : statusMeta('none');
  return `
    <a class="lrow ${v.id === selectedId ? 'sel' : ''}" href="#/venues/${esc(v.id)}">
      <span class="tile ${tileClass(v.name)}">${esc(initials(v.name))}</span>
      <span class="lrow-main">
        <span class="lrow-name truncate" style="display:block">${esc(v.name)}${
          v.visibility === 'private' ? ' <span class="xs" style="color:var(--brand-text)">private</span>' : ''
        }</span>
        <span class="lrow-meta">${esc(v.city)}${v.state ? `, ${esc(v.state)}` : ''} · Cap. ${v.capacity || '—'}</span>
      </span>
      <span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>
    </a>`;
}

function detailPane(v) {
  if (!v) {
    return `<div class="empty">${icon('pin', 'icon-lg')}<h3>Select a venue</h3><p class="muted">Pick a venue from the list to see contact details and your outreach history.</p></div>`;
  }

  const out = outreachForVenue(v.id);
  const meta = out ? statusMeta(out.status) : null;
  const history = myOutreach()
    .filter((o) => o.venueId === v.id)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  return `
    <div class="detail-head">
      <span class="tile tile-lg ${tileClass(v.name)}">${esc(initials(v.name))}</span>
      <div class="grow">
        <div class="detail-name">${esc(v.name)}</div>
        <div class="detail-sub">${esc(v.city)}${v.state ? `, ${esc(v.state)}` : ''}${
          v.visibility === 'private' ? ' · <span style="color:var(--brand-text)">your private venue</span>' : ''
        }</div>
        <div class="row-wrap" style="margin-top:8px">
          ${meta ? `<span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>` : ''}
          ${v.genres.map((g) => `<span class="chip chip-static">${esc(g)}</span>`).join('')}
        </div>
      </div>
      <div class="detail-actions">
        <a class="btn btn-primary btn-sm" href="#/send?venue=${esc(v.id)}">${icon('send')} Send EPK</a>
        ${isPro() ? `<button class="btn btn-sm" data-save="${esc(v.id)}">${icon('star')} Save to list</button>` : ''}
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div class="card">
        <div class="eyebrow" style="margin-bottom:9px">Venue details</div>
        <div class="drow"><span class="drow-label">Capacity</span><span class="drow-val">${v.capacity || '—'}</span></div>
        <div class="drow"><span class="drow-label">Type</span><span class="drow-val">${esc(v.type || '—')}</span></div>
        <div class="drow"><span class="drow-label">Pay type</span><span class="drow-val">${esc(v.payType || '—')}</span></div>
        <div class="drow"><span class="drow-label">Submit via</span><span class="drow-val">${esc(v.submissionMethod || '—')}</span></div>
        <div class="drow"><span class="drow-label">Website</span><span class="drow-val">${
          v.website ? `<a href="${esc(v.website)}" target="_blank" rel="noopener">${esc(v.website.replace(/^https?:\/\//, ''))}</a>` : '—'
        }</span></div>
      </div>

      <div class="card">
        <div class="eyebrow" style="margin-bottom:9px">Booking contact</div>
        ${v.contactName || v.contactEmail ? `
          <div class="contact-block">
            <span class="tile tile-sm tile-round ${tileClass(v.contactName || v.contactEmail)}">${esc(initials(v.contactName || v.contactEmail))}</span>
            <div class="grow" style="min-width:0">
              <div class="small"><strong>${esc(v.contactName || 'Booking desk')}</strong></div>
              <div class="xs truncate"><a href="mailto:${esc(v.contactEmail)}">${esc(v.contactEmail || '—')}</a></div>
            </div>
          </div>` : '<p class="small muted" style="margin:0">No booking contact on file.</p>'}
        ${v.notes ? `<p class="small muted" style="margin:12px 0 0">${esc(v.notes)}</p>` : ''}
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="row-between" style="margin-bottom:10px">
        <div class="eyebrow">Outreach history</div>
        ${v.lat || v.lng ? `<a class="small" href="#/map?venue=${esc(v.id)}">${icon('map')} Show on map</a>` : ''}
      </div>
      ${out ? `
        <div class="form-grid" style="margin-bottom:14px">
          <div class="field">
            <label for="vd-status">Pipeline stage</label>
            <select class="select" id="vd-status" data-status="${esc(out.id)}">
              ${STATUSES.map((s) => `<option value="${s.id}" ${out.status === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="vd-notes">Private notes</label>
            <textarea class="textarea" id="vd-notes" rows="2" data-notes="${esc(out.id)}" placeholder="Dates offered, who to chase…">${esc(out.notes || '')}</textarea>
          </div>
        </div>` : ''}
      ${history.length
        ? `<div class="timeline">${history.flatMap((o) => o.history.map((h) => `
            <div class="timeline-item">
              <div class="small"><strong>${esc(h.label)}</strong></div>
              <div class="xs muted">${fmtDateTime(h.at)}${h.detail ? ` · ${esc(h.detail)}` : ''}</div>
            </div>`)).join('')}</div>`
        : `<p class="small muted" style="margin:0">No outreach yet. Sending an EPK starts the history here.</p>`}
    </div>`;
}

function openAddVenue(ctx) {
  modal({
    title: 'Add a venue',
    size: 'lg',
    body: `
      <p class="muted small">Keep it private to your account, or submit it to the shared database for the GigBook team to review.</p>
      <form class="form-grid" style="margin-top:14px" data-add-form>
        <div class="field span-2"><label for="av-name">Venue name</label><input class="input" id="av-name" name="name" required></div>
        <div class="field"><label for="av-city">City</label><input class="input" id="av-city" name="city" required></div>
        <div class="field"><label for="av-state">State</label><input class="input" id="av-state" name="state"></div>
        <div class="field"><label for="av-cap">Capacity</label><input class="input" id="av-cap" name="capacity" type="number" min="0"></div>
        <div class="field"><label for="av-type">Type</label>
          <select class="select" id="av-type" name="type">${VENUE_TYPES.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
        </div>
        <div class="field"><label for="av-contact">Booking contact</label><input class="input" id="av-contact" name="contactName"></div>
        <div class="field"><label for="av-email">Booking email</label><input class="input" id="av-email" name="contactEmail" type="email"></div>
        <div class="field span-2"><label for="av-genres">Genres</label><input class="input" id="av-genres" name="genres" placeholder="Indie, Folk"></div>
        <div class="field span-2"><label for="av-notes">Notes</label><textarea class="textarea" id="av-notes" name="notes" rows="2"></textarea></div>
        <div class="field span-2">
          <span class="label">Where should it live?</span>
          <label class="check"><input type="radio" name="visibility" value="private" checked><span>Private — only you see it</span></label>
          <label class="check" style="margin-top:6px"><input type="radio" name="visibility" value="shared"><span>Submit to the shared database for review</span></label>
        </div>
      </form>`,
    footer: '<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" data-add-save>Add venue</button>',
    onMount(el) {
      el.querySelector('[data-add-save]').addEventListener('click', () => {
        const form = el.querySelector('[data-add-form]');
        const d = Object.fromEntries(new FormData(form).entries());
        if (!String(d.name || '').trim() || !String(d.city || '').trim()) { toast('Name and city are required.', 'bad'); return; }
        const venue = addVenue({
          name: String(d.name).trim(),
          city: String(d.city).trim(),
          state: String(d.state || '').trim().toUpperCase(),
          capacity: Number(d.capacity) || 0,
          type: String(d.type || 'Club'),
          contactName: String(d.contactName || '').trim(),
          contactEmail: String(d.contactEmail || '').trim(),
          genres: String(d.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
          notes: String(d.notes || '').trim(),
        }, String(d.visibility));
        closeModal();
        if (d.visibility === 'shared') {
          toast('Submitted — the GigBook team will review it.', 'good');
          ctx.rerender();
        } else {
          toast('Private venue added.', 'good');
          ctx.navigate(`/venues/${venue.id}`);
        }
      });
    },
  });
}

export default {
  title: 'Venues',
  flush: true,

  topbar(ctx) {
    const v = venueById(ctx.params.id);
    return { title: 'Venues', sub: v ? esc(v.name) : `${activeVenues().length} venues in your database` };
  },

  render(ctx) {
    const rows = applyFilters();
    const selectedId = ctx.params.id || rows[0]?.id || null;
    const selected = venueById(selectedId);
    const privateCount = myPrivateVenues().length;

    return `
      <div class="grow" style="display:flex;flex-direction:column;min-width:0">
        <div class="filter-bar">
          <div class="search grow" style="max-width:340px">
            ${icon('search')}
            <input class="input" data-q value="${esc(filters.q)}" placeholder="Search venues by name, city or genre…">
          </div>
          <select class="select" data-sort style="width:auto;height:32px">
            <option value="name" ${filters.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
            <option value="city" ${filters.sort === 'city' ? 'selected' : ''}>Sort: City</option>
            <option value="capDesc" ${filters.sort === 'capDesc' ? 'selected' : ''}>Sort: Capacity ↓</option>
            <option value="capAsc" ${filters.sort === 'capAsc' ? 'selected' : ''}>Sort: Capacity ↑</option>
          </select>
          <button class="btn btn-sm" data-export title="Export CSV">${icon('download')}</button>
          <button class="btn btn-primary btn-sm" data-add>${icon('plus')} Add venue</button>
        </div>

        <div class="filter-bar">
          <span class="filter-label">Status:</span>
          ${chip('All', 'status', 'all')}
          ${chip('Not contacted', 'status', 'none')}
          ${chip('EPK sent', 'status', 'sent')}
          ${chip('Follow-up due', 'status', 'followup')}
          ${chip('Replied', 'status', 'replied')}
          ${chip('Booked', 'status', 'booked')}
          <span class="divider-v"></span>
          <span class="filter-label">Genre:</span>
          ${ALL_GENRES.slice(0, 6).map((g) => chip(g, 'genre', g)).join('')}
          <span class="divider-v"></span>
          <span class="filter-label">Size:</span>
          ${chip('Small <100', 'size', 'small')}
          ${chip('Mid 100–400', 'size', 'mid')}
          ${chip('Large 400+', 'size', 'large')}
        </div>

        <div class="split">
          <div class="split-list">
            <div class="split-list-head">
              <span class="small muted">Showing ${plural(rows.length, 'venue')}</span>
              ${privateCount ? `<span class="badge badge-brand">Private: ${privateCount}</span>` : ''}
            </div>
            ${rows.length
              ? rows.map((v) => listRow(v, selectedId)).join('')
              : '<div class="empty" style="padding:26px 16px"><p class="muted small">No venues match these filters.</p><button class="btn btn-sm" data-clear>Clear filters</button></div>'}
          </div>
          <div class="split-detail">${detailPane(selected)}</div>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const q = root.querySelector('[data-q]');
    q?.addEventListener('input', debounce(() => {
      filters.q = q.value;
      ctx.rerender();
      const next = document.querySelector('[data-q]');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 220));

    root.querySelectorAll('[data-filter]').forEach((btn) => btn.addEventListener('click', () => {
      const group = btn.dataset.filter;
      const value = btn.dataset.value;
      if (group === 'status') filters.status = value;
      else filters[group] = filters[group] === value ? null : value;
      ctx.rerender();
    }));

    root.querySelector('[data-sort]')?.addEventListener('change', (e) => { filters.sort = e.target.value; ctx.rerender(); });

    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      filters.q = ''; filters.status = 'all'; filters.genre = null; filters.size = null;
      ctx.rerender();
    });

    root.querySelector('[data-add]')?.addEventListener('click', () => openAddVenue(ctx));

    root.querySelector('[data-export]')?.addEventListener('click', () => {
      if (!can('csvExport')) { toast('CSV export is a Pro feature.'); ctx.navigate('/pricing'); return; }
      const rows = applyFilters();
      const head = ['Name', 'City', 'State', 'Capacity', 'Type', 'Genres', 'Contact', 'Email', 'Website'];
      const csv = [head, ...rows.map((v) => [v.name, v.city, v.state, v.capacity, v.type, v.genres.join('; '), v.contactName, v.contactEmail, v.website])]
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      download('gigbook-venues.csv', csv);
      toast(`Exported ${rows.length} venues.`, 'good');
    });

    root.querySelector('[data-status]')?.addEventListener('change', (e) => {
      setOutreachStatus(e.target.dataset.status, e.target.value);
      toast('Pipeline updated.', 'good');
      ctx.rerender();
    });

    const notes = root.querySelector('[data-notes]');
    notes?.addEventListener('blur', () => {
      updateOutreach(notes.dataset.notes, { notes: notes.value });
      toast('Notes saved.');
    });

    root.querySelector('[data-save]')?.addEventListener('click', (e) => {
      const venueId = e.currentTarget.dataset.save;
      const lists = myLists();
      modal({
        title: 'Save to list',
        body: `${lists.length ? `<div class="stack-sm">${lists.map((l) => `
            <label class="check"><input type="checkbox" data-list="${esc(l.id)}" ${l.venueIds.includes(venueId) ? 'checked' : ''}>
            <span>${esc(l.name)} <span class="muted small">(${l.venueIds.length})</span></span></label>`).join('')}</div><hr>` : ''}
          <div class="field"><label for="new-list">${lists.length ? 'Or create a new list' : 'Create your first list'}</label>
          <input class="input" id="new-list" placeholder="Southeast run — October"></div>`,
        footer: '<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" data-done>Done</button>',
        onMount(el) {
          el.querySelectorAll('[data-list]').forEach((cb) => cb.addEventListener('change', () => toggleListVenue(cb.dataset.list, venueId)));
          el.querySelector('[data-done]').addEventListener('click', () => {
            const name = el.querySelector('#new-list').value.trim();
            if (name) toggleListVenue(createList(name).id, venueId);
            closeModal();
            toast('Saved.', 'good');
          });
        },
      });
    });
  },
};
