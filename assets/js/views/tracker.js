// Outreach tracker — 5-stage pipeline as a drag-and-drop board or a table.

import {
  myOutreach, venueById, STATUSES, statusMeta, setOutreachStatus, updateOutreach,
  deleteOutreach, outreachStats, dueFollowUps, isPro, can, loadDemoOutreach, epkById,
} from '../store.js';
import { esc, icon, relTime, fmtDate, fmtDateTime, toast, modal, closeModal, confirmModal, download } from '../ui.js';

const ui = { mode: 'board', filter: 'all', q: '' };

function rows() {
  const due = new Set(dueFollowUps().map((o) => o.id));
  const q = ui.q.trim().toLowerCase();
  return myOutreach()
    .filter((o) => {
      if (ui.filter === 'followups' && !due.has(o.id)) return false;
      if (ui.filter === 'open' && !['sent', 'opened'].includes(o.status)) return false;
      if (q) {
        const v = venueById(o.venueId);
        if (!`${v?.name} ${v?.city} ${o.to} ${o.subject}`.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function card(o) {
  const v = venueById(o.venueId);
  const overdue = o.followUpAt && new Date(o.followUpAt) <= new Date() && ['sent', 'opened'].includes(o.status);
  return `
    <article class="board-card" draggable="true" data-id="${esc(o.id)}">
      <div class="bc-title">${esc(v?.name || 'Venue')}</div>
      <div class="muted">${esc(v ? `${v.city}, ${v.state}` : '')}</div>
      <div class="row-between" style="margin-top:8px">
        <span class="muted xs">${relTime(o.sentAt)}</span>
        ${overdue ? `<span class="badge st-opened">${icon('clock')} Due</span>` : ''}
      </div>
      <div class="row" style="margin-top:8px;gap:6px">
        <button class="btn btn-sm" data-open="${esc(o.id)}">Open</button>
        <a class="btn btn-sm" href="#/venues/${esc(o.venueId)}">Venue</a>
      </div>
    </article>`;
}

function board(list) {
  return `<div class="board">
    ${STATUSES.map((s) => {
      const items = list.filter((o) => o.status === s.id);
      return `<div class="board-col" data-col="${s.id}">
        <div class="board-col-head">
          <span class="name"><span class="badge ${s.cls}"><span class="dot"></span>${esc(s.label)}</span></span>
          <span class="muted xs">${items.length}</span>
        </div>
        ${items.map(card).join('') || '<div class="muted xs" style="padding:6px 2px">Drop here</div>'}
      </div>`;
    }).join('')}
  </div>`;
}

function table(list) {
  return `
    <div class="card card-flush table-wrap">
      <table class="table">
        <thead><tr>
          <th>Venue</th><th>Sent to</th><th>Sent</th><th>Stage</th><th>Follow-up</th><th class="cell-actions">Actions</th>
        </tr></thead>
        <tbody>
          ${list.map((o) => {
            const v = venueById(o.venueId);
            return `<tr>
              <td><a href="#/venues/${esc(o.venueId)}"><strong>${esc(v?.name || 'Venue')}</strong></a><div class="small muted">${esc(v ? `${v.city}, ${v.state}` : '')}</div></td>
              <td class="small">${esc(o.to)}</td>
              <td class="small nowrap">${fmtDate(o.sentAt)}</td>
              <td>
                <select class="select" data-status="${esc(o.id)}" style="min-width:130px">
                  ${STATUSES.map((s) => `<option value="${s.id}" ${o.status === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
                </select>
              </td>
              <td class="small nowrap">${o.followUpAt ? fmtDate(o.followUpAt) : '—'}</td>
              <td class="cell-actions">
                <button class="btn btn-sm" data-open="${esc(o.id)}">Open</button>
                <button class="btn btn-sm btn-danger" data-del="${esc(o.id)}">${icon('trash')}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

export default {
  title: 'Outreach',
  wide: true,

  render(ctx) {
    if (ctx.query.get('filter')) ui.filter = ctx.query.get('filter');
    const all = myOutreach();
    const list = rows();
    const stats = outreachStats();

    if (!all.length) {
      return `<div class="card empty">
        <h3>No outreach yet</h3>
        <p class="muted">Every EPK you send lands here so you can see who owes you a reply.</p>
        <div class="row" style="justify-content:center">
          <a class="btn btn-primary" href="#/send">${icon('send')} Send your first EPK</a>
          <button class="btn" data-demo>Load sample pipeline</button>
        </div>
      </div>`;
    }

    return `
      <div class="row-between page-head">
        <div>
          <h1>Outreach tracker</h1>
          <p class="muted">${stats.sent} sent · ${stats.replied} replied (${stats.replyRate}%) · ${stats.booked} booked (${stats.bookRate}%)</p>
        </div>
        <div class="row">
          <div class="segmented">
            <button data-mode="board" aria-pressed="${ui.mode === 'board'}">${icon('grid')} Board</button>
            <button data-mode="table" aria-pressed="${ui.mode === 'table'}">${icon('list')} Table</button>
          </div>
          <button class="btn btn-sm" data-export>${icon('download')} Export${can('csvExport') ? '' : ' (Pro)'}</button>
        </div>
      </div>

      ${isPro() ? `
        <div class="grid grid-4" style="margin-bottom:16px">
          <div class="stat"><div class="stat-label">Reply rate</div><div class="stat-value">${stats.replyRate}%</div><div class="stat-foot">${stats.replied} of ${stats.sent}</div></div>
          <div class="stat"><div class="stat-label">Booking rate</div><div class="stat-value">${stats.bookRate}%</div><div class="stat-foot">${stats.booked} confirmed</div></div>
          <div class="stat"><div class="stat-label">Awaiting reply</div><div class="stat-value">${all.filter((o) => ['sent', 'opened'].includes(o.status)).length}</div><div class="stat-foot">${dueFollowUps().length} overdue</div></div>
          <div class="stat"><div class="stat-label">Declined</div><div class="stat-value">${stats.declined}</div><div class="stat-foot">worth a retry next tour</div></div>
        </div>`
        : `<div class="panel-note" style="margin-bottom:16px">${icon('chart')} Reply and booking analytics come with Pro. <a href="#/pricing">Compare plans</a></div>`}

      <div class="row" style="margin-bottom:14px">
        <div class="search grow" style="max-width:320px">
          ${icon('search')}<input class="input" data-q value="${esc(ui.q)}" placeholder="Search venue, city or subject…">
        </div>
        <div class="segmented">
          <button data-filter="all" aria-pressed="${ui.filter === 'all'}">All</button>
          <button data-filter="open" aria-pressed="${ui.filter === 'open'}">Awaiting reply</button>
          <button data-filter="followups" aria-pressed="${ui.filter === 'followups'}">Follow-ups due</button>
        </div>
      </div>

      ${list.length ? (ui.mode === 'board' ? board(list) : table(list))
        : '<div class="card empty"><h3>Nothing matches</h3><p class="muted">Try a different filter.</p></div>'}`;
  },

  mount(root, ctx) {
    root.querySelector('[data-demo]')?.addEventListener('click', () => { loadDemoOutreach(); ctx.rerender(); });

    root.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => { ui.mode = btn.dataset.mode; ctx.rerender(); }));
    root.querySelectorAll('[data-filter]').forEach((btn) => btn.addEventListener('click', () => { ui.filter = btn.dataset.filter; ctx.rerender(); }));

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

    root.querySelectorAll('[data-status]').forEach((sel) => sel.addEventListener('change', () => {
      setOutreachStatus(sel.dataset.status, sel.value);
      toast('Stage updated.', 'good');
      ctx.rerender();
    }));

    root.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
      confirmModal('Remove this outreach?', 'It disappears from your pipeline. The venue record is unaffected.', () => {
        deleteOutreach(btn.dataset.del);
        ctx.rerender();
      }, 'Remove');
    }));

    root.querySelector('[data-export]')?.addEventListener('click', () => {
      if (!can('csvExport')) { toast('CSV export is a Pro feature.'); ctx.navigate('/pricing'); return; }
      const head = ['Venue', 'City', 'State', 'Sent to', 'Subject', 'Sent', 'Stage', 'Follow-up', 'Notes'];
      const csv = [head, ...rows().map((o) => {
        const v = venueById(o.venueId);
        return [v?.name, v?.city, v?.state, o.to, o.subject, fmtDate(o.sentAt), statusMeta(o.status).label, o.followUpAt ? fmtDate(o.followUpAt) : '', o.notes];
      })].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      download('gigbook-outreach.csv', csv);
      toast('Pipeline exported.', 'good');
    });

    // Drag and drop between board columns
    let draggingId = null;
    root.querySelectorAll('.board-card').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        draggingId = el.dataset.id;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggingId);
      });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); draggingId = null; });
    });

    root.querySelectorAll('[data-col]').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drop');
        const id = draggingId || e.dataTransfer.getData('text/plain');
        if (!id) return;
        setOutreachStatus(id, col.dataset.col);
        toast(`Moved to ${statusMeta(col.dataset.col).label}.`, 'good');
        ctx.rerender();
      });
    });

    root.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => {
      const o = myOutreach().find((x) => x.id === btn.dataset.open);
      if (!o) return;
      const v = venueById(o.venueId);
      const epk = epkById(o.epkId);
      modal({
        title: v?.name || 'Outreach',
        size: 'lg',
        body: `
          <div class="row-between" style="margin-bottom:12px">
            <div class="small muted">${esc(v ? `${v.city}, ${v.state}` : '')} · sent ${fmtDateTime(o.sentAt)}</div>
            <span class="badge ${statusMeta(o.status).cls}"><span class="dot"></span>${esc(statusMeta(o.status).label)}</span>
          </div>
          <div class="card card-tight" style="background:var(--surface-2)">
            <div class="small muted">To</div><div>${esc(o.to)}</div>
            <div class="small muted" style="margin-top:8px">Subject</div><div><strong>${esc(o.subject)}</strong></div>
            <div class="small muted" style="margin-top:8px">EPK</div><div>${esc(epk?.title || 'Deleted EPK')}</div>
          </div>
          <div class="field" style="margin-top:14px">
            <span class="label">Message sent</span>
            <pre style="white-space:pre-wrap;font:inherit;background:var(--surface-2);border:1px solid var(--line);border-radius:6px;padding:12px;margin:0">${esc(o.body)}</pre>
          </div>
          <div class="form-grid" style="margin-top:14px">
            <div class="field">
              <label for="m-stage">Stage</label>
              <select class="select" id="m-stage" data-m-status>
                ${STATUSES.map((s) => `<option value="${s.id}" ${o.status === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="m-follow">Follow-up date</label>
              <input class="input" id="m-follow" type="date" data-m-follow value="${o.followUpAt ? new Date(o.followUpAt).toISOString().slice(0, 10) : ''}" ${isPro() ? '' : 'disabled'}>
              ${isPro() ? '' : '<div class="hint">Reminders are a Pro feature.</div>'}
            </div>
            <div class="field span-2">
              <label for="m-notes">Notes</label>
              <textarea class="textarea" id="m-notes" rows="3" data-m-notes>${esc(o.notes || '')}</textarea>
            </div>
          </div>
          <div class="field" style="margin-top:6px">
            <span class="label">History</span>
            <div class="timeline">${o.history.map((h) => `<div class="timeline-item"><strong>${esc(h.label)}</strong><div class="small muted">${fmtDateTime(h.at)}</div></div>`).join('')}</div>
          </div>`,
        footer: '<button class="btn" data-modal-close>Close</button><button class="btn btn-primary" data-m-save>Save</button>',
        onMount(el) {
          el.querySelector('[data-m-save]').addEventListener('click', () => {
            const status = el.querySelector('[data-m-status]').value;
            const follow = el.querySelector('[data-m-follow]').value;
            updateOutreach(o.id, {
              notes: el.querySelector('[data-m-notes]').value,
              followUpAt: follow ? new Date(`${follow}T09:00:00`).toISOString() : null,
            });
            setOutreachStatus(o.id, status);
            closeModal();
            toast('Saved.', 'good');
            ctx.rerender();
          });
        },
      });
    }));
  },
};
