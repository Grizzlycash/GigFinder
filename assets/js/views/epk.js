// EPK list — Basic is capped at one press kit, Pro gets unlimited.

import { myEpks, createEpk, updateEpk, deleteEpk, plan, isPro, currentUser } from '../store.js';
import { esc, icon, relTime, toast, confirmModal } from '../ui.js';

export default {
  title: 'EPK',

  render() {
    const epks = myEpks();
    const cap = plan().limits.epks;
    const atCap = epks.length >= cap;

    return `
      <div class="row-between page-head">
        <div>
          <h1>Electronic Press Kits</h1>
          <p class="muted">Your EPK is what venues receive — and its short bio becomes the body of every outreach email.</p>
        </div>
        <button class="btn btn-primary" data-new>${icon('plus')} New EPK</button>
      </div>

      ${atCap && !isPro() ? `
        <div class="panel-note panel-warn" style="margin-bottom:14px">
          ${icon('lock')} Basic includes one EPK. Pro lets you keep a separate kit per project, single or lineup. <a href="#/pricing">Compare plans</a>
        </div>` : ''}

      ${epks.length ? `
        <div class="grid grid-2">
          ${epks.map((e) => `
            <div class="card">
              <div class="row-between" style="align-items:flex-start">
                <div class="grow">
                  <div class="row" style="gap:8px">
                    <strong>${esc(e.title)}</strong>
                    ${e.isDefault ? '<span class="badge badge-brand">DEFAULT</span>' : ''}
                  </div>
                  <div class="small muted">${esc(e.tagline || 'No tagline yet')}</div>
                </div>
              </div>
              <p class="small" style="margin-top:10px;color:var(--ink-2)">${esc((e.shortBio || 'No short bio yet — add one before sending.').slice(0, 180))}${(e.shortBio || '').length > 180 ? '…' : ''}</p>
              <div class="row-between" style="margin-top:12px">
                <span class="small muted">Updated ${relTime(e.updatedAt)} · ${e.tracks.length} track${e.tracks.length === 1 ? '' : 's'}</span>
                <div class="row" style="gap:6px">
                  ${e.isDefault ? '' : `<button class="btn btn-sm" data-default="${esc(e.id)}">Make default</button>`}
                  <a class="btn btn-sm" href="#/epk/${esc(e.id)}">${icon('edit')} Edit</a>
                  <a class="btn btn-sm btn-primary" href="#/send?epk=${esc(e.id)}">${icon('send')} Send</a>
                  ${epks.length > 1 ? `<button class="btn btn-sm btn-danger" data-del="${esc(e.id)}">${icon('trash')}</button>` : ''}
                </div>
              </div>
            </div>`).join('')}
        </div>`
        : `<div class="card empty">
             <h3>No press kit yet</h3>
             <p class="muted">Create one and GigBook will pre-fill it from your profile.</p>
             <button class="btn btn-primary" data-new>${icon('plus')} Create my EPK</button>
           </div>`}`;
  },

  mount(root, ctx) {
    root.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => {
      const epks = myEpks();
      if (epks.length >= plan().limits.epks) {
        toast('Basic includes one EPK — upgrade for more.');
        ctx.navigate('/pricing');
        return;
      }
      const user = currentUser();
      const epk = createEpk({ title: `${user.artistName || 'New'} — EPK ${epks.length + 1}` });
      ctx.navigate(`/epk/${epk.id}`);
    }));

    root.querySelectorAll('[data-default]').forEach((btn) => btn.addEventListener('click', () => {
      myEpks().forEach((e) => updateEpk(e.id, { isDefault: e.id === btn.dataset.default }));
      toast('Default EPK updated.', 'good');
      ctx.rerender();
    }));

    root.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
      confirmModal('Delete this EPK?', 'Outreach already sent keeps its own copy of the email. This cannot be undone.', () => {
        deleteEpk(btn.dataset.del);
        toast('EPK deleted.');
        ctx.rerender();
      }, 'Delete');
    }));
  },
};
