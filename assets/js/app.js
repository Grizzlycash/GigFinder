// GigBook — app shell, routing table and navigation chrome.

import * as router from './router.js';
import { state, currentUser, signOut, plan, isPro, dueFollowUps, sendsRemaining, subscribe } from './store.js';
import { esc, icon, initials, qs } from './ui.js';

import landing from './views/landing.js';
import onboarding from './views/onboarding.js';
import dashboard from './views/dashboard.js';
import venues from './views/venues.js';
import venueDetail from './views/venueDetail.js';
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
router.define('/venues/:id', venueDetail);
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
  { group: 'Booking' },
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/venues', label: 'Venues', icon: 'pin' },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/epk', label: 'EPK', icon: 'doc' },
  { to: '/outreach', label: 'Outreach', icon: 'inbox' },
  { to: '/lists', label: 'Saved Lists', icon: 'star', pro: true },
  { group: 'Account' },
  { to: '/pricing', label: 'Plan & Billing', icon: 'bolt' },
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
  return items
    .map((item) => {
      if (item.group) return `<div class="nav-label">${esc(item.group.toUpperCase())}</div>`;
      const active = activePath === item.to || activePath.startsWith(`${item.to}/`);
      const tag = item.pro && !isPro() ? '<span class="badge badge-outline tag">PRO</span>' : '';
      return `<a class="nav-item ${active ? 'active' : ''}" href="#${item.to}">${icon(item.icon)}<span>${esc(item.label)}</span>${tag}</a>`;
    })
    .join('');
}

function sidebar(activePath, mode) {
  const user = currentUser();
  const adminMode = mode === 'admin';
  const items = adminMode ? ADMIN_NAV : NAV;
  const footer = adminMode
    ? `<div class="plan-card">
         <div class="small"><strong>Admin mode</strong></div>
         <div class="xs muted">Signed in as ${esc(user?.email || '')}</div>
       </div>
       <a class="nav-item" href="#/dashboard" style="margin-top:8px">${icon('arrowLeft')}<span>Back to app</span></a>`
    : `<div class="plan-card">
         <div class="row-between">
           <span class="small"><strong>${esc(plan().name)} plan</strong></span>
           ${isPro() ? '<span class="badge badge-pro">PRO</span>' : ''}
         </div>
         <div class="xs muted" style="margin-top:2px">${
           sendsRemaining() === Infinity ? 'Unlimited sends' : `${sendsRemaining()} of ${plan().limits.sendsPerMonth} sends left this month`
         }</div>
         ${isPro() ? '' : '<a class="btn btn-primary btn-sm btn-block" style="margin-top:9px" href="#/pricing">Upgrade to Pro</a>'}
       </div>
       ${user?.isAdmin ? `<a class="nav-item" href="#/admin/overview" style="margin-top:8px">${icon('shield')}<span>Admin panel</span></a>` : ''}`;

  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">GigBook</div>
          ${adminMode ? '<div class="brand-sub">ADMIN</div>' : ''}
        </div>
      </div>
      <nav class="nav">${navHtml(items, activePath)}</nav>
      <div class="sidebar-foot">${footer}</div>
    </aside>`;
}

function topbar(view, mode) {
  const user = currentUser();
  const follow = dueFollowUps().length;
  const right = mode === 'admin'
    ? `<span class="admin-flag">${icon('shield')} Admin panel</span>`
    : `${follow ? `<a class="btn btn-sm" href="#/outreach?filter=followups">${icon('clock')} ${follow} follow-up${follow === 1 ? '' : 's'} due</a>` : ''}
       <a class="btn btn-primary btn-sm" href="#/send">${icon('send')} Send EPK</a>`;

  return `
    <header class="topbar">
      <button class="btn btn-ghost btn-sm menu-btn" data-menu aria-label="Menu">${icon('menu')}</button>
      <h1>${esc(view.title || 'GigBook')}</h1>
      <div class="grow"></div>
      ${right}
      <button class="avatar" data-usermenu title="${esc(user?.email || '')}" aria-label="Account">${
        user?.photo ? `<img src="${esc(user.photo)}" alt="">` : esc(initials(user?.artistName || user?.email))
      }</button>
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
    app.innerHTML = `
      ${sidebar(p, mode)}
      <div class="main">
        ${topbar(view, mode)}
        <div class="content ${view.wide ? 'content-wide' : ''}">${body}</div>
      </div>`;
  }

  document.title = view.title ? `${view.title} · GigBook` : 'GigBook';
  window.scrollTo(0, 0);
  if (view.mount) view.mount(app, ctx);
  wireChrome();
}

function wireChrome() {
  const menu = qs('[data-menu]');
  if (menu) menu.addEventListener('click', () => qs('#sidebar')?.classList.toggle('open'));

  const avatar = qs('[data-usermenu]');
  if (avatar) {
    avatar.addEventListener('click', () => {
      import('./ui.js').then(({ modal, closeModal }) => {
        const user = currentUser();
        modal({
          title: 'Account',
          body: `
            <div class="row" style="gap:12px">
              <div class="avatar avatar-lg">${user?.photo ? `<img src="${esc(user.photo)}" alt="">` : esc(initials(user?.artistName || user?.email))}</div>
              <div>
                <div><strong>${esc(user?.artistName || 'Unnamed artist')}</strong></div>
                <div class="small muted">${esc(user?.email || '')}</div>
                <div class="small muted">${esc(plan().name)} plan · ${esc(user?.cycle === 'annual' ? 'Annual' : 'Monthly')}</div>
              </div>
            </div>`,
          footer: `
            <a class="btn" href="#/settings" data-modal-close>Settings</a>
            <button class="btn btn-danger" data-signout>Sign out</button>`,
          onMount(el) {
            el.querySelector('[data-signout]').addEventListener('click', () => {
              closeModal();
              signOut();
              router.navigate('/', { replace: true });
              render();
            });
          },
        });
      });
    });
  }
}

// Re-render when another tab mutates the store.
window.addEventListener('storage', (e) => { if (e.key === 'gigbook:v1') location.reload(); });
subscribe(() => {});

router.start(render);

// Expose for debugging in the browser console.
window.GigBook = { state, render };
