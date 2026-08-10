// EPK list — Basic keeps one press kit, Pro gets unlimited.

import {
  myEpks, createEpk, updateEpk, deleteEpk, plan, isPro, currentUser, epkProgress, can,
} from '../store.js';
import { esc, icon, relTime, toast, confirmModal, tileClass, initials } from '../ui.js';

export default {
  title: 'My EPK',

  topbar() {
    const n = myEpks().length;
    return { title: 'My EPK', sub: n ? `${n} press kit${n === 1 ? '' : 's'}` : 'Electronic press kit' };
  },

  render() {
    const epks = myEpks();
    const atCap = epks.length >= plan().limits.epks;

    return `
      <div class="row-between page-head">
        <div>
          <h1>Electronic press kits</h1>
          <p class="muted">Your EPK is what venues receive — and its short bio becomes the body of every outreach email.</p>
        </div>
        <button class="btn btn-primary" data-new ${atCap ? 'aria-disabled="true"' : ''}>${icon('plus')} New EPK</button>
      </div>

      ${atCap && !isPro() ? `
        <div class="panel-note panel-warn" style="margin-bottom:14px">
          ${icon('lock')} Basic includes one press kit. Pro adds the full EPK generator and a separate kit per project. <a href="#/pricing">Compare plans</a>
        </div>` : ''}

      ${epks.length ? `
        <div class="grid grid-2">
          ${epks.map((e) => {
            const p = epkProgress(e);
            return `
            <div class="card">
              <div class="row" style="gap:11px;align-items:flex-start">
                <span class="tile tile-lg ${tileClass(e.title)}">${
                  e.photos?.[0] ? `<img src="${esc(e.photos[0].src)}" alt="">` : esc(initials(e.title))
                }</span>
                <div class="grow" style="min-width:0">
                  <div class="row" style="gap:7px">
                    <strong class="truncate">${esc(e.title)}</strong>
                    ${e.isDefault ? '<span class="badge badge-brand">DEFAULT</span>' : ''}
                  </div>
                  <div class="small muted truncate">${esc(e.tagline || 'No tagline yet')}</div>
                  <div class="bar" style="margin-top:9px"><span style="width:${Math.round((p.count / p.total) * 100)}%"></span></div>
                  <div class="xs muted" style="margin-top:5px">${
                    can('epkGenerator')
                      ? `${p.count} of ${p.total} sections complete`
                      : p.done.bio ? 'Bio ready to send' : 'Short bio still needed'
                  }${e.uploadedFile ? ` · ${esc(e.uploadedFile.name)} attached` : ''}</div>
                </div>
              </div>
              <p class="small" style="margin:11px 0 0;color:var(--ink-2)">${esc((e.shortBio || 'No short bio yet — add one before sending.').slice(0, 150))}${(e.shortBio || '').length > 150 ? '…' : ''}</p>
              <div class="row-between" style="margin-top:12px">
                <span class="xs muted">Updated ${relTime(e.updatedAt)}</span>
                <div class="row" style="gap:6px">
                  ${e.isDefault ? '' : `<button class="btn btn-sm" data-default="${esc(e.id)}">Make default</button>`}
                  <a class="btn btn-sm" href="#/epk/${esc(e.id)}">${icon('edit')} Edit</a>
                  <a class="btn btn-sm btn-primary" href="#/send?epk=${esc(e.id)}">${icon('send')} Send</a>
                  ${epks.length > 1 ? `<button class="btn btn-sm btn-danger" data-del="${esc(e.id)}">${icon('trash')}</button>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>`
        : `<div class="card empty">
             ${icon('user', 'icon-lg')}
             <h3 style="margin-top:10px">No press kit yet</h3>
             <p class="muted">Create one and GigBook pre-fills it from your profile.</p>
             <button class="btn btn-primary" data-new>${icon('plus')} Create my EPK</button>
           </div>`}

      ${can('epkGenerator') ? '' : `
        <div class="panel-note" style="margin-top:16px">
          ${icon('bolt')} You're on Basic: write your bio here and attach a press kit you made elsewhere.
          The full generator — photos, music links, socials and tech rider — comes with Pro.
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
