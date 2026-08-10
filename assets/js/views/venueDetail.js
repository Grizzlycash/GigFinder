// Single venue: details, booking contact, and this artist's outreach history with it.

import { venueById, myOutreach, statusMeta, STATUSES, setOutreachStatus, updateOutreach } from '../store.js';
import { esc, icon, fmtDate, fmtDateTime, toast } from '../ui.js';

export default {
  title: 'Venue',

  render(ctx) {
    const v = venueById(ctx.params.id);
    if (!v) return '<div class="card empty"><h3>Venue not found</h3><p><a href="#/venues">Back to venues</a></p></div>';

    const history = myOutreach()
      .filter((o) => o.venueId === v.id)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    const latest = history[0];

    return `
      <a class="small" href="#/venues">${icon('arrowLeft')} All venues</a>

      <div class="row-between" style="margin:10px 0 18px;align-items:flex-start">
        <div>
          <h1 style="margin-bottom:2px">${esc(v.name)}</h1>
          <div class="venue-meta">
            <span>${icon('pin')} ${esc(v.city)}, ${esc(v.state)}</span>
            <span>Capacity ${v.capacity}</span>
            <span>${esc(v.type)}</span>
            <span>Added ${fmtDate(v.addedAt)}</span>
          </div>
        </div>
        <a class="btn btn-primary" href="#/send?venue=${esc(v.id)}">${icon('send')} Send EPK</a>
      </div>

      <div class="grid grid-2" style="align-items:start">
        <div class="stack">
          <div class="card">
            <h3>Booking contact</h3>
            <table class="table" style="margin-top:8px">
              <tbody>
                <tr><td class="muted" style="width:130px">Contact</td><td>${esc(v.contactName || '—')}</td></tr>
                <tr><td class="muted">Email</td><td><a href="mailto:${esc(v.contactEmail)}">${esc(v.contactEmail)}</a></td></tr>
                <tr><td class="muted">Submit via</td><td>${esc(v.submissionMethod)}</td></tr>
                <tr><td class="muted">Pay structure</td><td>${esc(v.payType)}</td></tr>
                <tr><td class="muted">Website</td><td><a href="${esc(v.website)}" target="_blank" rel="noopener">${esc(v.website.replace(/^https?:\/\//, ''))} ${icon('external')}</a></td></tr>
              </tbody>
            </table>
          </div>

          <div class="card">
            <h3>Booking notes</h3>
            <p class="muted" style="margin-top:6px">${esc(v.notes)}</p>
            <div class="row-wrap" style="margin-top:10px">
              ${v.genres.map((g) => `<span class="chip chip-static">${esc(g)}</span>`).join('')}
            </div>
          </div>

          <div class="card">
            <h3>Location</h3>
            <div class="small muted" style="margin-bottom:8px">${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}</div>
            <a class="btn btn-sm" href="#/map?venue=${esc(v.id)}">${icon('map')} Show on map</a>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="row-between">
              <h3>Your outreach</h3>
              ${latest ? `<span class="badge ${statusMeta(latest.status).cls}"><span class="dot"></span>${esc(statusMeta(latest.status).label)}</span>` : ''}
            </div>
            ${latest ? `
              <div class="field" style="margin-top:12px">
                <label for="vd-status">Pipeline stage</label>
                <select class="select" id="vd-status" data-status="${esc(latest.id)}">
                  ${STATUSES.map((s) => `<option value="${s.id}" ${latest.status === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
                </select>
              </div>
              <div class="field" style="margin-top:12px">
                <label for="vd-notes">Private notes</label>
                <textarea class="textarea" id="vd-notes" rows="3" data-notes="${esc(latest.id)}" placeholder="What was said, who to chase, dates offered…">${esc(latest.notes || '')}</textarea>
                <div class="hint">Saved when you click away.</div>
              </div>
            ` : `<p class="muted small" style="margin-top:8px">You haven't contacted ${esc(v.name)} yet.</p>`}
          </div>

          ${history.length ? `
            <div class="card">
              <h3>History</h3>
              <div class="timeline" style="margin-top:12px">
                ${history.flatMap((o) => o.history.map((h) => `
                  <div class="timeline-item">
                    <div><strong>${esc(h.label)}</strong></div>
                    <div class="small muted">${fmtDateTime(h.at)}${h.detail ? ` · ${esc(h.detail)}` : ''}</div>
                  </div>`)).join('')}
              </div>
            </div>` : ''}
        </div>
      </div>`;
  },

  mount(root, ctx) {
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
  },
};
