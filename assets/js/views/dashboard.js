// Dashboard — greeting, pipeline metrics, recent outreach, follow-ups, coverage.

import {
  currentUser, myOutreach, outreachStats, activeVenues, venueById, dueFollowUps,
  sendsRemaining, plan, isPro, can, defaultEpk, epkProgress, loadDemoOutreach, statusMeta,
} from '../store.js';
import { esc, icon, relTime, fmtDate, tileClass, initials, plural } from '../ui.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default {
  title: 'Dashboard',

  topbar() {
    const user = currentUser();
    const follow = dueFollowUps().length;
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    // Greet the person, not the band — "Good morning, The" reads badly.
    const who = (user.realName || '').trim().split(/\s+/)[0] || user.artistName || 'there';
    return {
      title: `${greeting()}, ${esc(who)}`,
      sub: `${esc(today)}${follow ? ` · ${follow} follow-up${follow === 1 ? '' : 's'} due` : ''}`,
    };
  },

  render() {
    const user = currentUser();
    const stats = outreachStats();
    const mine = myOutreach();
    const epk = defaultEpk();
    const progress = epkProgress(epk);
    const remaining = sendsRemaining();
    const venues = activeVenues();
    const contacted = new Set(mine.map((o) => o.venueId));
    const booked = mine.filter((o) => o.status === 'booked');
    const follows = dueFollowUps();
    const upcoming = mine
      .filter((o) => o.followUpAt && ['sent', 'opened'].includes(o.status))
      .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt))
      .slice(0, 4);
    const recent = [...mine].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
    const sentThisMonth = mine.filter((o) => {
      const d = new Date(o.sentAt);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).length;
    const coverage = venues.length ? (contacted.size / venues.length) * 100 : 0;

    // On Basic only the bio section is reachable, so don't nag about Pro-only sections.
    const incomplete = !epk
      || !progress.done.bio
      || (can('epkGenerator') && progress.count < progress.total);
    const nudge = incomplete ? `
      <div class="card card-tight row" style="gap:12px;margin-bottom:14px;background:var(--brand-tint);border-color:var(--brand-line)">
        <span class="tile ${epk ? 't1' : 't3'}">${icon('doc')}</span>
        <div class="grow">
          <div><strong>${epk ? 'Your EPK isn\'t finished yet' : 'Your EPK isn\'t set up yet'}</strong></div>
          <div class="small muted">${!epk
            ? 'Add your bio, photos and music links to start sending.'
            : can('epkGenerator')
              ? `${progress.count} of ${progress.total} sections complete — venues see whatever is filled in.`
              : 'Add a short bio — it becomes the body of every outreach email.'}</div>
        </div>
        <a class="btn btn-primary btn-sm" href="${epk ? `#/epk/${esc(epk.id)}` : '#/epk'}">${epk ? 'Finish EPK' : 'Set up EPK'}</a>
      </div>` : '';

    return `
      ${nudge}

      <div class="grid grid-4" style="margin-bottom:14px">
        <div class="stat">
          <div class="stat-label">EPKs sent</div>
          <div class="stat-value">${stats.sent}</div>
          <div class="stat-foot ${sentThisMonth ? 'up' : ''}">${sentThisMonth ? `+${sentThisMonth} this month` : 'none yet this month'}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Sends remaining</div>
          <div class="stat-value" style="color:${remaining === Infinity ? 'var(--good)' : remaining <= 3 ? 'var(--warn)' : 'var(--ink)'}">${remaining === Infinity ? '∞' : remaining}</div>
          <div class="stat-foot">${remaining === Infinity ? 'Pro · unlimited' : `Basic · ${plan().limits.sendsPerMonth}/month`}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Venues contacted</div>
          <div class="stat-value">${contacted.size}</div>
          <div class="stat-foot">of ${venues.length} in database</div>
        </div>
        <div class="stat">
          <div class="stat-label">Shows booked</div>
          <div class="stat-value">${booked.length}</div>
          <div class="stat-foot ${booked.length ? 'up' : ''}">${booked.length
            ? esc(booked.slice(0, 2).map((o) => venueById(o.venueId)?.name).filter(Boolean).join(', '))
            : 'keep pitching'}</div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start">
        <div class="card card-flush">
          <div class="card-head">
            <h3>Recent outreach</h3>
            <a class="small" href="#/outreach">View all</a>
          </div>
          ${recent.length ? recent.map((o) => {
            const v = venueById(o.venueId);
            const meta = statusMeta(o.status);
            return `<a class="lrow" href="#/venues/${esc(o.venueId)}">
              <span class="tile ${tileClass(v?.name)}">${esc(initials(v?.name || '?'))}</span>
              <span class="lrow-main">
                <span class="lrow-name truncate" style="display:block">${esc(v?.name || 'Venue')}</span>
                <span class="lrow-meta">${esc(v ? `${v.city}, ${v.state} · Cap. ${v.capacity}` : '')}</span>
              </span>
              <span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>
              <span class="xs muted nowrap">${relTime(o.updatedAt)}</span>
            </a>`;
          }).join('') : `
            <div class="empty">
              <p class="muted">No outreach yet — pick a venue and send your first EPK.</p>
              <div class="row" style="justify-content:center">
                <a class="btn btn-primary btn-sm" href="#/venues">${icon('pin')} Browse venues</a>
                <button class="btn btn-sm" data-demo>Load sample pipeline</button>
              </div>
            </div>`}
        </div>

        <div class="stack">
          <div class="card card-flush">
            <div class="card-head">
              <h3>Follow-up reminders</h3>
              ${isPro() ? '<a class="small" href="#/outreach?filter=followups">Manage</a>' : '<span class="badge badge-outline">PRO</span>'}
            </div>
            ${!isPro()
              ? `<div class="card-body"><p class="small muted" style="margin:0">Pro nudges you when a venue has gone quiet, so a warm lead never goes cold. <a href="#/pricing">Compare plans</a></p></div>`
              : upcoming.length
                ? upcoming.map((o) => {
                    const v = venueById(o.venueId);
                    const due = new Date(o.followUpAt) <= new Date();
                    return `<div class="dot-item">
                      <span class="dot-mark ${due ? 'dot-today' : 'dot-soon'}"></span>
                      <div class="grow">
                        <div class="dot-text">Follow up with ${esc(v?.name || 'venue')}</div>
                        <div class="dot-when">${due ? 'Due now' : fmtDate(o.followUpAt)} · EPK sent ${fmtDate(o.sentAt)}</div>
                      </div>
                      <a class="btn btn-sm" href="#/send?venue=${esc(o.venueId)}">Send</a>
                    </div>`;
                  }).join('')
                : `<div class="card-body"><p class="small muted" style="margin:0">Nothing due. Everything you've sent is still inside the reminder window.</p></div>`}
          </div>

          <div class="card card-flush">
            <div class="card-head"><h3>Database coverage</h3></div>
            <div class="card-body">
              <div class="row-between small" style="margin-bottom:8px">
                <span class="muted">Venues contacted</span>
                <span><strong>${contacted.size} / ${venues.length}</strong></span>
              </div>
              <div class="bar"><span style="width:${Math.max(1, Math.round(coverage))}%"></span></div>
              <div class="xs muted" style="margin-top:7px">${(100 - coverage).toFixed(1)}% of venues not yet reached</div>
            </div>
          </div>

          <div class="card card-flush">
            <div class="card-head"><h3>Pipeline</h3><a class="small" href="#/outreach">Tracker</a></div>
            <div class="card-body stack-sm">
              ${[['Replied', stats.replied, 'st-replied'], ['Awaiting reply', mine.filter((o) => ['sent', 'opened'].includes(o.status)).length, 'st-sent'], ['Declined', stats.declined, 'st-declined']]
                .map(([label, n, cls]) => `<div class="row-between small">
                  <span class="badge ${cls}"><span class="dot"></span>${esc(label)}</span>
                  <span class="mono-num muted">${n}</span>
                </div>`).join('')}
              <div class="row-between small"><span class="muted">Reply rate</span><span><strong>${stats.replyRate}%</strong></span></div>
            </div>
          </div>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    root.querySelector('[data-demo]')?.addEventListener('click', () => {
      loadDemoOutreach();
      ctx.rerender();
    });
  },
};
