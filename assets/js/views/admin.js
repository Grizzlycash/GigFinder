// Admin panel — master venue database, spreadsheet import, submissions queue, users.
// Rendered with the dark sidebar (chrome: 'admin') so it never reads as the artist app.

import { state, save, upsertVenue, deleteVenue, PLANS, planPrice, currentUser } from '../store.js';
import { esc, icon, toast, modal, closeModal, confirmModal, fmtDate, money, download, uid, plural } from '../ui.js';
import { VENUE_TYPES, slugify } from '../seed.js';

const TABS = ['overview', 'venues', 'import', 'submissions', 'users'];
const ui = { q: '', pending: null };

/* ---------- CSV ---------- */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

const FIELDS = [
  ['name', 'Venue name', true],
  ['city', 'City', true],
  ['state', 'State / region', false],
  ['capacity', 'Capacity', false],
  ['type', 'Venue type', false],
  ['genres', 'Genres (semicolon or comma separated)', false],
  ['contactName', 'Booking contact', false],
  ['contactEmail', 'Booking email', false],
  ['website', 'Website', false],
  ['lat', 'Latitude', false],
  ['lng', 'Longitude', false],
  ['payType', 'Pay structure', false],
  ['submissionMethod', 'Submission method', false],
  ['notes', 'Booking notes', false],
];

function guessColumn(headers, field) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const aliases = {
    name: ['venue', 'venuename', 'name'],
    city: ['city', 'town'],
    state: ['state', 'region', 'province'],
    capacity: ['capacity', 'cap', 'size'],
    type: ['type', 'venuetype', 'category'],
    genres: ['genres', 'genre', 'styles'],
    contactName: ['contact', 'contactname', 'booker', 'bookingcontact'],
    contactEmail: ['email', 'contactemail', 'bookingemail'],
    website: ['website', 'url', 'site'],
    lat: ['lat', 'latitude'],
    lng: ['lng', 'lon', 'long', 'longitude'],
    payType: ['pay', 'paytype', 'deal', 'payment'],
    submissionMethod: ['submission', 'submissionmethod', 'submitvia', 'method'],
    notes: ['notes', 'note', 'comments'],
  };
  const wants = aliases[field] || [field.toLowerCase()];
  const idx = headers.findIndex((h) => wants.includes(norm(h)));
  return idx >= 0 ? idx : -1;
}

/* ---------- Tabs ---------- */
function overview() {
  const venues = state.venues;
  const users = state.users;
  const mrr = users.reduce((sum, u) => sum + (u.onboarded ? planPrice(u.plan, u.cycle) : 0), 0);
  const pro = users.filter((u) => u.plan === 'pro').length;
  const byState = venues.reduce((acc, v) => { acc[v.state] = (acc[v.state] || 0) + 1; return acc; }, {});
  const topStates = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return `
    <div class="page-head"><h1>Overview</h1><p class="muted">Shared master database and subscriber snapshot.</p></div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="stat"><div class="stat-label">Venues (active)</div><div class="stat-value">${venues.filter((v) => v.status === 'active').length}</div><div class="stat-foot">${venues.length} total rows</div></div>
      <div class="stat"><div class="stat-label">Pending review</div><div class="stat-value">${venues.filter((v) => v.status === 'pending').length}</div><div class="stat-foot">user submissions</div></div>
      <div class="stat"><div class="stat-label">Subscribers</div><div class="stat-value">${users.length}</div><div class="stat-foot">${pro} on Pro</div></div>
      <div class="stat"><div class="stat-label">Est. MRR</div><div class="stat-value">${money(mrr)}</div><div class="stat-foot">at current plans</div></div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div class="card">
        <h3>Coverage by state</h3>
        <div class="stack-sm" style="margin-top:12px">
          ${topStates.map(([st, n]) => `
            <div class="row" style="gap:10px">
              <span style="width:40px" class="small"><strong>${esc(st)}</strong></span>
              <span class="bar grow"><span style="width:${Math.round((n / topStates[0][1]) * 100)}%"></span></span>
              <span class="small muted mono-num">${n}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3>Database health</h3>
        <table class="table" style="margin-top:8px">
          <tbody>
            <tr><td class="muted">Missing booking email</td><td class="right">${venues.filter((v) => !v.contactEmail).length}</td></tr>
            <tr><td class="muted">Missing coordinates</td><td class="right">${venues.filter((v) => !v.lat || !v.lng).length}</td></tr>
            <tr><td class="muted">Missing capacity</td><td class="right">${venues.filter((v) => !v.capacity).length}</td></tr>
            <tr><td class="muted">Archived</td><td class="right">${venues.filter((v) => v.status === 'archived').length}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

function venuesTab() {
  const q = ui.q.trim().toLowerCase();
  const rows = state.venues
    .filter((v) => !q || `${v.name} ${v.city} ${v.state} ${v.contactEmail}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return `
    <div class="row-between page-head">
      <div><h1>Venue database</h1><p class="muted">${plural(rows.length, 'row')} · edits are live for every subscriber.</p></div>
      <div class="row">
        <button class="btn btn-sm" data-export-all>${icon('download')} Export CSV</button>
        <button class="btn btn-primary btn-sm" data-add>${icon('plus')} Add venue</button>
      </div>
    </div>

    <div class="search" style="max-width:340px;margin-bottom:14px">
      ${icon('search')}<input class="input" data-q value="${esc(ui.q)}" placeholder="Search name, city, email…">
    </div>

    <div class="card card-flush table-wrap">
      <table class="table">
        <thead><tr><th>Venue</th><th>Location</th><th>Cap</th><th>Type</th><th>Booking email</th><th>Status</th><th class="cell-actions">Actions</th></tr></thead>
        <tbody>
          ${rows.slice(0, 200).map((v) => `
            <tr>
              <td><strong>${esc(v.name)}</strong><div class="small muted">${esc(v.source)} · ${fmtDate(v.addedAt)}</div></td>
              <td class="small">${esc(v.city)}, ${esc(v.state)}</td>
              <td class="mono-num">${v.capacity || '—'}</td>
              <td class="small">${esc(v.type)}</td>
              <td class="small">${esc(v.contactEmail || '—')}</td>
              <td><span class="badge ${v.status === 'active' ? 'badge-brand' : v.status === 'pending' ? 'st-opened' : ''}">${esc(v.status)}</span></td>
              <td class="cell-actions">
                <button class="btn btn-sm" data-edit="${esc(v.id)}">${icon('edit')}</button>
                <button class="btn btn-sm btn-danger" data-del="${esc(v.id)}">${icon('trash')}</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${rows.length > 200 ? `<div class="card-foot small muted">Showing first 200 of ${rows.length}. Narrow with search.</div>` : ''}
    </div>`;
}

function importTab() {
  const p = ui.pending;
  if (!p) {
    return `
      <div class="page-head"><h1>Import spreadsheet</h1><p class="muted">Seed or top up the master database from the GigBook venue spreadsheet. Export it as CSV first.</p></div>
      <div class="card" style="max-width:760px">
        <div class="import-drop" data-drop>
          ${icon('upload', 'icon-lg')}
          <h3 style="margin-top:8px">Drop a CSV here</h3>
          <p class="muted small">or</p>
          <input type="file" accept=".csv,text/csv" class="hidden" id="csv-file">
          <label class="btn" for="csv-file">Choose file</label>
        </div>
        <div class="field" style="margin-top:18px">
          <label for="csv-paste">…or paste CSV</label>
          <textarea class="textarea" id="csv-paste" rows="6" placeholder="Venue,City,State,Capacity,Booking Email&#10;The Copper Owl,Nashville,TN,250,booking@example.com"></textarea>
          <div class="row" style="margin-top:10px"><button class="btn btn-primary" data-parse-paste>Read CSV</button></div>
        </div>
      </div>`;
  }

  const [headers, ...body] = p.rows;
  return `
    <div class="row-between page-head">
      <div><h1>Map columns</h1><p class="muted">${plural(body.length, 'row')} found in <strong>${esc(p.filename)}</strong>.</p></div>
      <button class="btn btn-sm" data-cancel-import>Start over</button>
    </div>

    <div class="card" style="max-width:820px">
      <div class="map-col-select">
        ${FIELDS.map(([key, label, required]) => `
          <label class="small" for="map-${key}"><strong>${esc(label)}</strong>${required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>
          <select class="select" id="map-${key}" data-map-field="${key}">
            <option value="-1">— skip —</option>
            ${headers.map((h, i) => `<option value="${i}" ${p.mapping[key] === i ? 'selected' : ''}>${esc(h || `Column ${i + 1}`)}</option>`).join('')}
          </select>`).join('')}
      </div>

      <h3 style="margin-top:20px">Preview</h3>
      <div class="table-wrap" style="margin-top:8px;border:1px solid var(--line);border-radius:6px">
        <table class="table">
          <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${body.slice(0, 5).map((r) => `<tr>${headers.map((_, i) => `<td class="small">${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>

      <div class="panel-note" style="margin-top:16px">
        ${icon('db')} Rows matching an existing venue on <strong>name + city</strong> are updated rather than duplicated.
      </div>

      <div class="row" style="margin-top:16px">
        <button class="btn btn-primary btn-lg" data-run-import>${icon('upload')} Import ${body.length} rows</button>
        <label class="check"><input type="checkbox" data-import-pending><span class="small">Import as pending review</span></label>
      </div>
    </div>`;
}

function submissionsTab() {
  const pending = state.venues.filter((v) => v.status === 'pending');
  return `
    <div class="page-head"><h1>Submissions</h1><p class="muted">Venues suggested by subscribers. Approving publishes them to everyone.</p></div>
    ${pending.length ? `
      <div class="card card-flush table-wrap">
        <table class="table">
          <thead><tr><th>Venue</th><th>Location</th><th>Cap</th><th>Booking email</th><th>Submitted</th><th class="cell-actions">Review</th></tr></thead>
          <tbody>
            ${pending.map((v) => `
              <tr>
                <td><strong>${esc(v.name)}</strong><div class="small muted">${esc(v.notes || '')}</div></td>
                <td class="small">${esc(v.city)}, ${esc(v.state)}</td>
                <td class="mono-num">${v.capacity || '—'}</td>
                <td class="small">${esc(v.contactEmail || '—')}</td>
                <td class="small nowrap">${fmtDate(v.addedAt)}</td>
                <td class="cell-actions">
                  <button class="btn btn-sm" data-edit="${esc(v.id)}">${icon('edit')}</button>
                  <button class="btn btn-sm btn-primary" data-approve="${esc(v.id)}">${icon('check')} Approve</button>
                  <button class="btn btn-sm btn-danger" data-reject="${esc(v.id)}">${icon('x')}</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
      : '<div class="card empty"><h3>Queue is clear</h3><p class="muted">Subscriber submissions land here for review before they hit the shared database.</p></div>'}`;
}

function usersTab() {
  const me = currentUser();
  return `
    <div class="page-head"><h1>Users</h1><p class="muted">${plural(state.users.length, 'account')} on this deployment.</p></div>
    <div class="card card-flush table-wrap">
      <table class="table">
        <thead><tr><th>Artist</th><th>Email</th><th>Plan</th><th>Billing</th><th>Joined</th><th>Admin</th><th class="cell-actions"></th></tr></thead>
        <tbody>
          ${state.users.map((u) => `
            <tr>
              <td><strong>${esc(u.artistName || '—')}</strong><div class="small muted">${esc([u.homeCity, u.homeState].filter(Boolean).join(', '))}</div></td>
              <td class="small">${esc(u.email)}${u.id === me.id ? ' <span class="badge">you</span>' : ''}</td>
              <td><span class="badge ${u.plan === 'pro' ? 'badge-pro' : 'badge-brand'}">${esc(PLANS[u.plan].name)}</span></td>
              <td class="small">${esc(u.cycle)} · ${money(planPrice(u.plan, u.cycle))}/mo</td>
              <td class="small nowrap">${fmtDate(u.createdAt)}</td>
              <td><input type="checkbox" data-admin-toggle="${esc(u.id)}" ${u.isAdmin ? 'checked' : ''} ${u.id === me.id ? 'disabled' : ''} style="accent-color:var(--brand)"></td>
              <td class="cell-actions">${u.id === me.id ? '' : `<button class="btn btn-sm btn-danger" data-del-user="${esc(u.id)}">${icon('trash')}</button>`}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ---------- Venue editor ---------- */
function venueForm(v = {}) {
  const f = (name, label, value = '', type = 'text') => `
    <div class="field"><label for="v-${name}">${esc(label)}</label>
    <input class="input" id="v-${name}" name="${name}" type="${type}" value="${esc(value ?? '')}"></div>`;
  return `
    <form data-venue-form>
      <div class="form-grid">
        <div class="field span-2"><label for="v-name">Venue name</label><input class="input" id="v-name" name="name" value="${esc(v.name || '')}" required></div>
        ${f('city', 'City', v.city)}
        ${f('state', 'State', v.state)}
        ${f('capacity', 'Capacity', v.capacity, 'number')}
        <div class="field"><label for="v-type">Type</label>
          <select class="select" id="v-type" name="type">${VENUE_TYPES.map((t) => `<option ${v.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </div>
        ${f('contactName', 'Booking contact', v.contactName)}
        ${f('contactEmail', 'Booking email', v.contactEmail, 'email')}
        ${f('website', 'Website', v.website, 'url')}
        ${f('payType', 'Pay structure', v.payType)}
        ${f('lat', 'Latitude', v.lat, 'number')}
        ${f('lng', 'Longitude', v.lng, 'number')}
        <div class="field span-2"><label for="v-genres">Genres</label><input class="input" id="v-genres" name="genres" value="${esc((v.genres || []).join(', '))}" placeholder="Indie, Rock"></div>
        <div class="field span-2"><label for="v-notes">Booking notes</label><textarea class="textarea" id="v-notes" name="notes" rows="3">${esc(v.notes || '')}</textarea></div>
        <div class="field span-2"><label for="v-status">Status</label>
          <select class="select" id="v-status" name="status">
            ${['active', 'pending', 'archived'].map((s) => `<option ${(v.status || 'active') === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </form>`;
}

function openVenueEditor(v, ctx) {
  modal({
    title: v ? `Edit ${v.name}` : 'Add venue',
    size: 'lg',
    body: venueForm(v || {}),
    footer: '<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" data-save-venue>Save venue</button>',
    onMount(el) {
      el.querySelector('[data-save-venue]').addEventListener('click', () => {
        const form = el.querySelector('[data-venue-form]');
        const d = Object.fromEntries(new FormData(form).entries());
        if (!String(d.name).trim()) { toast('Venue name is required.', 'bad'); return; }
        upsertVenue({
          ...(v || {}),
          id: v?.id || `ven_${slugify(String(d.name))}_${uid('x').slice(-4)}`,
          name: String(d.name).trim(),
          city: String(d.city).trim(),
          state: String(d.state).trim().toUpperCase(),
          country: v?.country || 'USA',
          capacity: Number(d.capacity) || 0,
          type: d.type,
          contactName: String(d.contactName).trim(),
          contactEmail: String(d.contactEmail).trim(),
          website: String(d.website).trim(),
          payType: String(d.payType).trim(),
          submissionMethod: v?.submissionMethod || 'Email',
          lat: Number(d.lat) || v?.lat || 0,
          lng: Number(d.lng) || v?.lng || 0,
          genres: String(d.genres).split(',').map((g) => g.trim()).filter(Boolean),
          notes: String(d.notes),
          status: d.status,
          source: v?.source || 'manual',
        });
        closeModal();
        toast('Venue saved.', 'good');
        ctx.rerender();
      });
    },
  });
}

/* ---------- View ---------- */
export default {
  title: 'Admin',
  chrome: 'admin',
  admin: true,
  wide: true,

  render(ctx) {
    const tab = TABS.includes(ctx.params.tab) ? ctx.params.tab : 'overview';
    this.title = `Admin · ${tab[0].toUpperCase()}${tab.slice(1)}`;
    const bodies = { overview, venues: venuesTab, import: importTab, submissions: submissionsTab, users: usersTab };
    return bodies[tab]();
  },

  mount(root, ctx) {
    const tab = TABS.includes(ctx.params.tab) ? ctx.params.tab : 'overview';

    // Search (venues tab)
    const q = root.querySelector('[data-q]');
    q?.addEventListener('input', () => {
      ui.q = q.value;
      clearTimeout(q._t);
      q._t = setTimeout(() => {
        ctx.rerender();
        const next = document.querySelector('[data-q]');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      }, 250);
    });

    root.querySelector('[data-add]')?.addEventListener('click', () => openVenueEditor(null, ctx));

    root.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
      openVenueEditor(state.venues.find((v) => v.id === btn.dataset.edit), ctx);
    }));

    root.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
      const v = state.venues.find((x) => x.id === btn.dataset.del);
      confirmModal('Delete venue?', `${v?.name} is removed for every subscriber, along with any outreach recorded against it.`, () => {
        deleteVenue(btn.dataset.del);
        toast('Venue deleted.');
        ctx.rerender();
      }, 'Delete');
    }));

    root.querySelector('[data-export-all]')?.addEventListener('click', () => {
      const head = FIELDS.map(([, label]) => label);
      const csv = [head, ...state.venues.map((v) => FIELDS.map(([key]) => (key === 'genres' ? v.genres.join('; ') : v[key] ?? '')))]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      download('gigbook-master-venues.csv', csv);
    });

    // Submissions
    root.querySelectorAll('[data-approve]').forEach((btn) => btn.addEventListener('click', () => {
      upsertVenue({ id: btn.dataset.approve, status: 'active' });
      toast('Published to the shared database.', 'good');
      ctx.rerender();
    }));
    root.querySelectorAll('[data-reject]').forEach((btn) => btn.addEventListener('click', () => {
      confirmModal('Reject submission?', 'The suggested venue is deleted.', () => {
        deleteVenue(btn.dataset.reject);
        ctx.rerender();
      }, 'Reject');
    }));

    // Users
    root.querySelectorAll('[data-admin-toggle]').forEach((cb) => cb.addEventListener('change', () => {
      const user = state.users.find((u) => u.id === cb.dataset.adminToggle);
      if (user) { user.isAdmin = cb.checked; save(); }
    }));
    root.querySelectorAll('[data-del-user]').forEach((btn) => btn.addEventListener('click', () => {
      confirmModal('Delete user?', 'Their EPKs and outreach are deleted too.', () => {
        const id = btn.dataset.delUser;
        state.users = state.users.filter((u) => u.id !== id);
        state.epks = state.epks.filter((e) => e.userId !== id);
        state.outreach = state.outreach.filter((o) => o.userId !== id);
        state.lists = state.lists.filter((l) => l.userId !== id);
        save();
        ctx.rerender();
      }, 'Delete');
    }));

    if (tab !== 'import') return;

    /* ---------- Import ---------- */
    const beginMapping = (text, filename) => {
      const rows = parseCsv(text);
      if (rows.length < 2) { toast('That CSV has no data rows.', 'bad'); return; }
      const headers = rows[0];
      const mapping = {};
      FIELDS.forEach(([key]) => { mapping[key] = guessColumn(headers, key); });
      ui.pending = { rows, mapping, filename: filename || 'pasted data' };
      ctx.rerender();
    };

    const file = root.querySelector('#csv-file');
    file?.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      f.text().then((t) => beginMapping(t, f.name));
    });

    const drop = root.querySelector('[data-drop]');
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => {
        const f = e.dataTransfer.files?.[0];
        if (f) f.text().then((t) => beginMapping(t, f.name));
      });
    }

    root.querySelector('[data-parse-paste]')?.addEventListener('click', () => {
      const text = root.querySelector('#csv-paste').value.trim();
      if (!text) { toast('Paste some CSV first.', 'bad'); return; }
      beginMapping(text, 'pasted data');
    });

    root.querySelector('[data-cancel-import]')?.addEventListener('click', () => { ui.pending = null; ctx.rerender(); });

    root.querySelectorAll('[data-map-field]').forEach((sel) => sel.addEventListener('change', () => {
      ui.pending.mapping[sel.dataset.mapField] = Number(sel.value);
    }));

    root.querySelector('[data-run-import]')?.addEventListener('click', () => {
      const { rows, mapping } = ui.pending;
      const asPending = root.querySelector('[data-import-pending]')?.checked;
      if (mapping.name < 0 || mapping.city < 0) { toast('Map at least the venue name and city columns.', 'bad'); return; }

      const body = rows.slice(1);
      const get = (row, key) => (mapping[key] >= 0 ? (row[mapping[key]] || '').trim() : '');
      let added = 0;
      let updated = 0;
      let skipped = 0;

      body.forEach((row) => {
        const name = get(row, 'name');
        const city = get(row, 'city');
        if (!name || !city) { skipped += 1; return; }
        const existing = state.venues.find(
          (v) => v.name.toLowerCase() === name.toLowerCase() && v.city.toLowerCase() === city.toLowerCase(),
        );
        const genresRaw = get(row, 'genres');
        const record = {
          name,
          city,
          state: get(row, 'state').toUpperCase(),
          country: 'USA',
          capacity: Number(get(row, 'capacity')) || existing?.capacity || 0,
          type: get(row, 'type') || existing?.type || 'Club',
          genres: genresRaw ? genresRaw.split(/[;,]/).map((g) => g.trim()).filter(Boolean) : existing?.genres || [],
          contactName: get(row, 'contactName') || existing?.contactName || '',
          contactEmail: get(row, 'contactEmail') || existing?.contactEmail || '',
          website: get(row, 'website') || existing?.website || '',
          payType: get(row, 'payType') || existing?.payType || '',
          submissionMethod: get(row, 'submissionMethod') || existing?.submissionMethod || 'Email',
          lat: Number(get(row, 'lat')) || existing?.lat || 0,
          lng: Number(get(row, 'lng')) || existing?.lng || 0,
          notes: get(row, 'notes') || existing?.notes || '',
          status: asPending ? 'pending' : existing?.status || 'active',
          source: 'spreadsheet',
        };

        if (existing) { Object.assign(existing, record); updated += 1; }
        else {
          state.venues.push({
            ...record,
            id: `ven_${slugify(name)}_${slugify(city)}`,
            addedAt: new Date().toISOString(),
          });
          added += 1;
        }
      });

      save();
      ui.pending = null;
      toast(`Imported: ${added} new, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}.`, 'good');
      ctx.rerender();
    });
  },
};
