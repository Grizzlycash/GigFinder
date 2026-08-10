// Dashboard: pipeline snapshot, follow-ups, suggested venues, recent activity.

import {
  currentUser, myOutreach, outreachStats, activeVenues, venueById, dueFollowUps,
  sendsRemaining, plan, isPro, defaultEpk, loadDemoOutreach, statusMeta,
} from '../store.js';
import { esc, icon, relTime, fmtDate, plural } from '../ui.js';

function suggestedVenues(user, limit = 5) {
  const contacted = new Set(myOutreach().map((o) => o.venueId));
  const genres = new Set(user.genres || []);
  return activeVenues()
    .filter((v) => !contacted.has(v.id))
    .map((v) => {
      let score = 0;
      if (v.genres.some((g) => genres.has(g))) score += 3;
      if (user.homeState && v.state === user.homeState) score += 2;
      if (user.homeCity && v.city === user.homeCity) score += 2;
      if (v.capacity <= 350) score += 1;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score || a.v.name.localeCompare(b.v.name))
    .slice(0, limit)
    .map((x) => x.v);
}

export default {
  title: 'Dashboard',

  render() {
    const user = currentUser();
    const stats = outreachStats();
    const mine = myOutreach();
    const epk = defaultEpk();
    const remaining = sendsRemaining();
    const cap = plan().limits.sendsPerMonth;
    const follows = dueFollowUps();
    const recent = [...mine].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);

    const quota = cap === Infinity
      ? `<div class="small muted">Unlimited sends on Pro.</div>`
      : `<div class="bar" style="margin-top:8px"><span style="width:${Math.round(((cap - remaining) / cap) * 100)}%"></span></div>
         <div class="small muted" style="margin-top:6px">${remaining} of ${cap} sends left this month · <a href="#/pricing">Go unlimited</a></div>`;

    return `
      <div class="page-head">
        <h1>${esc(user.artistName || 'Welcome')}</h1>
        <p class="muted">${mine.length
          ? `${plural(stats.sent, 'venue')} contacted · ${plural(stats.replied, 'reply', 'replies')} · ${plural(stats.booked, 'show')} booked`
          : 'No outreach yet — pick a venue and send your first EPK.'}</p>
      </div>

      <div class="grid grid-4" style="margin-bottom:18px">
        <div class="stat"><div class="stat-label">EPKs sent</div><div class="stat-value">${stats.sent}</div><div class="stat-foot">all time</div></div>
        <div class="stat"><div class="stat-label">Replies</div><div class="stat-value">${stats.replied}</div><div class="stat-foot">${stats.replyRate}% reply rate</div></div>
        <div class="stat"><div class="stat-label">Booked</div><div class="stat-value">${stats.booked}</div><div class="stat-foot">${stats.bookRate}% of sends</div></div>
        <div class="stat"><div class="stat-label">Awaiting reply</div><div class="stat-value">${mine.filter((o) => ['sent', 'opened'].includes(o.status)).length}</div><div class="stat-foot">${follows.length} due a nudge</div></div>
      </div>

      <div class="grid grid-2" style="align-items:start">
        <div class="stack">
          <div class="card">
            <div class="row-between" style="margin-bottom:6px">
              <h3>This month</h3>
              <span class="badge ${isPro() ? 'badge-pro' : 'badge-brand'}">${esc(plan().name.toUpperCase())}</span>
            </div>
            ${quota}
          </div>

          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h3>Follow-ups due</h3>
              ${isPro() ? '' : '<span class="badge badge-outline">PRO</span>'}
            </div>
            ${!isPro()
              ? `<p class="muted small">Pro reminds you when a venue has gone quiet for ${esc(String(10))} days, so nothing slips. <a href="#/pricing">Upgrade</a></p>`
              : follows.length
                ? `<div class="stack-sm">${follows.slice(0, 4).map((o) => {
                    const v = venueById(o.venueId);
                    return `<div class="row-between">
                      <div><a href="#/venues/${esc(o.venueId)}"><strong>${esc(v?.name || 'Venue')}</strong></a>
                        <div class="small muted">Sent ${relTime(o.sentAt)} · due ${fmtDate(o.followUpAt)}</div></div>
                      <a class="btn btn-sm" href="#/send?venue=${esc(o.venueId)}">Follow up</a>
                    </div>`;
                  }).join('')}</div>
                  ${follows.length > 4 ? `<p class="hint"><a href="#/outreach?filter=followups">See all ${follows.length}</a></p>` : ''}`
                : '<p class="muted small">Nothing due. Everything you\'ve sent is still inside the reminder window.</p>'}
          </div>

          <div class="card">
            <h3>Your EPK</h3>
            ${epk
              ? `<div class="row-between" style="margin-top:8px">
                   <div>
                     <strong>${esc(epk.title)}</strong>
                     <div class="small muted">Updated ${relTime(epk.updatedAt)} · ${epk.shortBio ? 'short bio set' : 'no short bio yet'}</div>
                   </div>
                   <a class="btn btn-sm" href="#/epk/${esc(epk.id)}">${icon('edit')} Edit</a>
                 </div>`
              : '<p class="muted small">You don\'t have an EPK yet. <a href="#/epk">Create one</a> before your first send.</p>'}
          </div>
        </div>

        <div class="stack">
          <div class="card card-flush">
            <div class="card-head"><h3>Suggested venues</h3><a class="small" href="#/venues">Browse all</a></div>
            <div>
              ${suggestedVenues(user).map((v) => `
                <div class="row-between" style="padding:12px 18px;border-bottom:1px solid var(--line)">
                  <div class="grow">
                    <a href="#/venues/${esc(v.id)}"><strong>${esc(v.name)}</strong></a>
                    <div class="small muted">${esc(v.city)}, ${esc(v.state)} · cap ${v.capacity} · ${esc(v.genres.slice(0, 2).join(', '))}</div>
                  </div>
                  <a class="btn btn-sm btn-primary" href="#/send?venue=${esc(v.id)}">${icon('send')} Send</a>
                </div>`).join('')}
            </div>
          </div>

          <div class="card card-flush">
            <div class="card-head"><h3>Recent activity</h3><a class="small" href="#/outreach">Tracker</a></div>
            <div class="card-body">
              ${recent.length
                ? `<div class="timeline">${recent.map((o) => {
                    const v = venueById(o.venueId);
                    const meta = statusMeta(o.status);
                    return `<div class="timeline-item">
                      <div class="row" style="gap:8px">
                        <span class="badge ${meta.cls}"><span class="dot"></span>${esc(meta.label)}</span>
                        <a href="#/venues/${esc(o.venueId)}">${esc(v?.name || 'Venue')}</a>
                      </div>
                      <div class="small muted">${esc(v ? `${v.city}, ${v.state}` : '')} · ${relTime(o.updatedAt)}</div>
                    </div>`;
                  }).join('')}</div>`
                : `<div class="empty" style="padding:24px">
                     <p class="muted">Nothing here yet.</p>
                     <button class="btn btn-sm" data-demo>Load sample pipeline</button>
                   </div>`}
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
