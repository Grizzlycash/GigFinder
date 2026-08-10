// Saved venue lists (Pro) — used for routing a run of dates.

import { isPro, myLists, createList, deleteList, toggleListVenue, venueById, outreachForVenue, statusMeta } from '../store.js';
import { esc, icon, toast, confirmModal, plural } from '../ui.js';

export default {
  title: 'Saved Lists',

  render() {
    if (!isPro()) {
      return `
        <div class="card locked">
          ${icon('lock', 'icon-lg')}
          <h3 style="margin-top:8px">Saved lists are a Pro feature</h3>
          <p class="muted">Group venues into a run — "Southeast, October" — and work the list without losing your place.</p>
          <a class="btn btn-primary" href="#/pricing">See Pro — $19.99/mo</a>
        </div>`;
    }

    const lists = myLists();
    return `
      <div class="row-between page-head">
        <div>
          <h1>Saved lists</h1>
          <p class="muted">Build a route, then send down the list.</p>
        </div>
        <button class="btn btn-primary" data-new>${icon('plus')} New list</button>
      </div>

      ${lists.length ? lists.map((l) => {
        const venues = l.venueIds.map(venueById).filter(Boolean);
        const uncontacted = venues.filter((v) => !outreachForVenue(v.id));
        return `
          <div class="card card-flush" style="margin-bottom:14px">
            <div class="card-head">
              <div>
                <h3>${esc(l.name)}</h3>
                <div class="small muted">${plural(venues.length, 'venue')} · ${uncontacted.length} not yet contacted</div>
              </div>
              <div class="row">
                ${uncontacted.length ? `<a class="btn btn-sm btn-primary" href="#/send?venue=${esc(uncontacted[0].id)}">${icon('send')} Send to next</a>` : ''}
                <button class="btn btn-sm btn-danger" data-del-list="${esc(l.id)}">${icon('trash')}</button>
              </div>
            </div>
            ${venues.length ? venues.map((v) => {
              const out = outreachForVenue(v.id);
              const meta = out ? statusMeta(out.status) : null;
              return `<div class="row-between" style="padding:11px 18px;border-bottom:1px solid var(--line)">
                <div class="grow">
                  <a href="#/venues/${esc(v.id)}"><strong>${esc(v.name)}</strong></a>
                  <div class="small muted">${esc(v.city)}, ${esc(v.state)} · cap ${v.capacity}</div>
                </div>
                ${meta ? `<span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>` : '<span class="badge">Not contacted</span>'}
                <button class="btn btn-sm" data-remove="${esc(l.id)}|${esc(v.id)}">${icon('x')}</button>
              </div>`;
            }).join('') : '<div class="empty" style="padding:24px"><p class="muted">Empty. Add venues with the ★ button on the Venues page.</p></div>'}
          </div>`;
      }).join('')
      : `<div class="card empty">
           <h3>No lists yet</h3>
           <p class="muted">Create one, then save venues to it from the Venues page.</p>
           <button class="btn btn-primary" data-new>${icon('plus')} New list</button>
         </div>`}`;
  },

  mount(root, ctx) {
    root.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => {
      const name = prompt('Name this list (e.g. "Southeast run — October")');
      if (!name || !name.trim()) return;
      createList(name.trim());
      toast('List created.', 'good');
      ctx.rerender();
    }));

    root.querySelectorAll('[data-del-list]').forEach((btn) => btn.addEventListener('click', () => {
      confirmModal('Delete this list?', 'The venues stay in the database — only the list is removed.', () => {
        deleteList(btn.dataset.delList);
        ctx.rerender();
      }, 'Delete');
    }));

    root.querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', () => {
      const [listId, venueId] = btn.dataset.remove.split('|');
      toggleListVenue(listId, venueId);
      ctx.rerender();
    }));
  },
};
