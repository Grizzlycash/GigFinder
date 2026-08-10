// GigBook — app shell, routing table and navigation chrome.

import * as router from './router.js';
import {
  state, currentUser, signOut, plan, isPro, dueFollowUps, sendsRemaining, subscribe,
} from './store.js';
import { esc, icon, initials, tileClass, qs, modal, closeModal } from './ui.js';

import landing from './views/landing.js';
import onboarding from './views/onboarding.js';
import dashboard from './views/dashboard.js';
import venues from './views/venues.js';
import mapView from './views/map.js';
import epk from './views/epk.js';
import epkEditor from './views/epkEditor.js';
import sendEpk from './views/sendEpk.js';
import tracker from './views/tracker.js';
import lists from './views/lists.js';
import pricing from './views/pricing.js';
import settings from './views/settings.js';
import admin from './views/admin.js';

const app = document.getElementById('app');

/* ---------- Routes ---------- */
router.define('/', landing);
router.define('/onboarding', onboarding);
router.define('/dashboard', dashboard);
router.define('/venues', venues);
router.define('/venues/:id', venues); // detail lives in the split view
router.define('/map', mapView);
router.define('/epk', epk);
router.define('/epk/:id', epkEditor);
router.define('/send', sendEpk);
router.define('/outreach', tracker);
router.define('/lists', lists);
router.define('/pricing', pricing);
router.define('/settings', settings);
router.define('/admin', admin);
router.define('/admin/:tab', admin);

/* ---------- Navigation model ---------- */
const NAV = [
  { group: 'Main' },
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/venues', label: 'Venues', icon: 'pin' },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/outreach', label: 'Outreach', icon: 'phone', badge: 'followups' },
  { group: 'My profile' },
  { to: '/epk', label: 'My EPK', icon: 'user' },
  { to: '/lists', label: 'Saved Lists', icon: 'star', pro: true },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];

const ADMIN_NAV = [
  { group: 'Admin' },
  { to: '/admin/overview', label: 'Overview', icon: 'chart' },
  { to: '/admin/venues', label: 'Venue Database', icon: 'db' },
  { to: '/admin/import', label: 'Import Spreadsheet', icon: 'upload' },
  { to: '/admin/submissions', label: 'Submissions', icon: 'shield' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
];

function navHtml(items, activePath) {
  const follow = dueFollowUps().length;
  return items
    .map((item) => {
      if (item.group) return `<div class="nav-label">${esc(item.group)}</div>`;
      const active = activePath === item.to || activePath.startsWith(`${item.to}/`);
      let tag = '';
      if (item.badge === 'followups' && follow) tag = `<span class="badge badge-brand tag">${follow}</span>`;
      else if (item.pro && !isPro()) tag = '<span class="badge badge-outline tag">PRO</span>';
      return `<a class="nav-item ${active ? 'active' : ''}" href="#${item.to}">${icon(item.icon)}<span>${esc(item.label)}</span>${tag}</a>`;
    })
    .join('');
}

function userBlock() {
  const user = currentUser();
  const remaining = sendsRemaining();
  const quota = remaining === Infinity
    ? ''
    : `<div class="quota-line">${remaining} of ${plan().limits.sendsPerMonth} sends left this month</div>`;
  return `
    ${quota}
    <button class="user-block" data-usermenu>
      <span class="tile tile-sm tile-round ${tileClass(user?.email)}">${
        user?.photo ? `<img src="${esc(user.photo)}" alt="">` : esc(initials(user?.artistName || user?.email))
      }</span>
      <span class="grow">
        <span class="user-name truncate" style="display:block">${esc(user?.artistName || 'Your account')}</span>
        <span class="user-plan">${esc(plan().name)} plan</span>
      </span>
      ${icon('chevronRight', 'icon')}
    </button>`;
}

function sidebar(activePath, mode) {
  const user = currentUser();
  const adminMode = mode === 'admin';
  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <span class="brand-mark">${icon(adminMode ? 'shield' : 'chevronRight')}</span>
        <span>
          <span class="brand-name" style="display:block">GigBook</span>
          ${adminMode ? '<span class="brand-sub">ADMIN</span>' : ''}
        </span>
      </div>
      <nav class="nav">
        ${navHtml(adminMode ? ADMIN_NAV : NAV, activePath)}
        ${!adminMode && user?.isAdmin
          ? `<div class="nav-label">Staff</div><a class="nav-item" href="#/admin/overview">${icon('shield')}<span>Admin panel</span></a>`
          : ''}
        ${adminMode ? `<div class="nav-label">Back</div><a class="nav-item" href="#/dashboard">${icon('arrowLeft')}<span>Artist app</span></a>` : ''}
      </nav>
      <div class="sidebar-foot">${userBlock()}</div>
    </aside>`;
}

function topbar(view, ctx, mode) {
  const head = view.topbar ? view.topbar(ctx) : { title: view.title };
  const right = mode === 'admin'
    ? `<span class="admin-flag">${icon('shield')} Admin panel</span>`
    : `${head.actions || ''}<a class="btn btn-primary btn-sm" href="#/send">${icon('send')} Send EPK</a>`;

  return `
    <header class="topbar">
      <button class="btn btn-ghost btn-sm menu-btn" data-menu aria-label="Menu">${icon('menu')}</button>
      <div class="grow">
        <h1>${esc(head.title || 'GigBook')}</h1>
        ${head.sub ? `<div class="topbar-sub">${head.sub}</div>` : ''}
      </div>
      ${right}
    </header>`;
}

/* ---------- Render ---------- */
function render() {
  const resolved = router.resolve();
  if (!resolved) { router.navigate('/dashboard', { replace: true }); return; }

  const { route, params } = resolved;
  const view = route.handler;
  const user = currentUser();
  const p = router.path();

  // Guards
  if (!user && view.auth !== false) { router.navigate('/', { replace: true }); return; }
  if (user && !user.onboarded && p !== '/onboarding') { router.navigate('/onboarding', { replace: true }); return; }
  if (user && user.onboarded && p === '/') { router.navigate('/dashboard', { replace: true }); return; }
  if (view.admin && !user?.isAdmin) { router.navigate('/dashboard', { replace: true }); return; }

  const ctx = { params, query: router.query(), navigate: router.navigate, rerender: render };
  const mode = view.chrome || 'app';
  const body = view.render(ctx);

  if (mode === 'bare') {
    app.className = '';
    app.innerHTML = body;
  } else {
    app.className = mode === 'admin' ? 'shell shell-admin' : 'shell';
    const contentClass = view.flush ? 'content content-flush' : `content ${view.wide ? 'content-wide' : ''}`;
    app.innerHTML = `
      ${sidebar(p, mode)}
      <div class="main">
        ${topbar(view, ctx, mode)}
        <div class="${contentClass}">${body}</div>
      </div>`;
  }

  document.title = view.title ? `${view.title} · GigBook` : 'GigBook';
  window.scrollTo(0, 0);
  if (view.mount) view.mount(app, ctx);
  wireChrome();
}

function accountMenu() {
  const user = currentUser();
  modal({
    title: 'Account',
    body: `
      <div class="row" style="gap:12px">
        <span class="tile tile-lg tile-round ${tileClass(user?.email)}">${
          user?.photo ? `<img src="${esc(user.photo)}" alt="">` : esc(initials(user?.artistName || user?.email))
        }</span>
        <div>
          <div><strong>${esc(user?.artistName || 'Unnamed artist')}</strong></div>
          <div class="small muted">${esc(user?.email || '')}</div>
          <div class="small muted">${esc(plan().name)} plan · billed ${esc(user?.cycle === 'annual' ? 'annually' : 'monthly')}</div>
        </div>
      </div>
      <div class="stack-sm" style="margin-top:16px">
        <a class="btn btn-block" href="#/pricing" data-modal-close>${icon('bolt')} Plan &amp; billing</a>
        <a class="btn btn-block" href="#/settings" data-modal-close>${icon('gear')} Settings</a>
        ${user?.isAdmin ? `<a class="btn btn-block" href="#/admin/overview" data-modal-close>${icon('shield')} Admin panel</a>` : ''}
      </div>`,
    footer: '<button class="btn btn-danger" data-signout>Sign out</button>',
    onMount(el) {
      el.querySelector('[data-signout]').addEventListener('click', () => {
        closeModal();
        signOut();
        router.navigate('/', { replace: true });
        render();
      });
    },
  });
}

function wireChrome() {
  qs('[data-menu]')?.addEventListener('click', () => qs('#sidebar')?.classList.toggle('open'));
  qs('[data-usermenu]')?.addEventListener('click', accountMenu);
}

// Re-render when another tab mutates the store.
window.addEventListener('storage', (e) => { if (e.key === 'gigbook:v1') location.reload(); });
subscribe(() => {});

router.start(render);

// Expose for debugging in the browser console.
window.GigBook = { state, render };
