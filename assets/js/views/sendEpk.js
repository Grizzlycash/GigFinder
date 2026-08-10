// Send EPK — a single linear, top-to-bottom flow. The email body is auto-populated
// from the selected EPK's short bio so every pitch reads the same way.

import {
  activeVenues, venueById, myEpks, defaultEpk, epkById, currentUser, state,
  recordSend, outreachForVenue, sendsRemaining, plan, isPro, normaliseEpk,
} from '../store.js';
import { esc, icon, toast, relTime, tileClass, initials } from '../ui.js';

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

export function fillTemplate(template, { user, venue }) {
  return String(template)
    .replaceAll('{artist}', user.artistName || 'Artist')
    .replaceAll('{venue}', venue?.name || 'your venue')
    .replaceAll('{city}', venue?.city || '');
}

export function composeBody({ user, venue, epk, settings }) {
  const music = epk?.music || {};
  const lines = [];
  lines.push(`Hi ${firstName(venue?.contactName)},`);
  lines.push('');
  lines.push(epk?.shortBio || 'Add a short bio to your EPK and it will appear here.');
  lines.push('');

  const tracks = (epk?.tracks || []).filter((t) => t.url).slice(0, 2);
  if (tracks.length) {
    tracks.forEach((t) => lines.push(`${t.title || 'Listen'}: ${t.url}`));
  } else {
    const primary = music.spotify || music.bandcamp || music.soundcloud || music.appleMusic;
    if (primary) lines.push(`Listen: ${primary}`);
  }

  if (music.youtube) lines.push(`Live video: ${music.youtube}`);
  lines.push('');
  lines.push(`I'd love to be considered for a date at ${venue?.name || 'your venue'}. Full EPK, photos and press are attached below.`);
  lines.push('');
  lines.push('Thanks for your time,');
  lines.push(user.realName || user.artistName || '');
  if (settings.signature) lines.push(settings.signature);
  return lines.join('\n');
}

export default {
  title: 'Send EPK',

  render(ctx) {
    const user = currentUser();
    const epks = myEpks();
    const venues = activeVenues();

    const venueId = ctx.query.get('venue') || venues[0]?.id || '';
    const epkId = ctx.query.get('epk') || defaultEpk()?.id || '';
    const venue = venueById(venueId);
    const epk = normaliseEpk(epkById(epkId));
    const remaining = sendsRemaining();
    const prior = venue ? outreachForVenue(venue.id) : null;

    if (!epks.length) {
      return `<div class="card empty">
        <h3>You need an EPK first</h3>
        <p class="muted">The send flow builds your email from an EPK's short bio.</p>
        <a class="btn btn-primary" href="#/epk">${icon('plus')} Create my EPK</a>
      </div>`;
    }

    if (remaining === 0) {
      return `<div class="card locked">
        ${icon('lock', 'icon-lg')}
        <h3 style="margin-top:8px">You've used all ${plan().limits.sendsPerMonth} sends this month</h3>
        <p class="muted">Basic resets on the 1st. Pro removes the cap entirely and adds follow-up reminders.</p>
        <a class="btn btn-primary" href="#/pricing">See Pro</a>
      </div>`;
    }

    const subject = fillTemplate(state.settings.defaultSubject, { user, venue });
    const body = composeBody({ user, venue, epk, settings: state.settings });

    return `
      <div class="page-head">
        <h1>Send your EPK</h1>
        <p class="muted">Top to bottom — pick the venue, check the email, send.
          ${remaining === Infinity ? 'Unlimited sends on Pro.' : `${remaining} send${remaining === 1 ? '' : 's'} left this month.`}</p>
      </div>

      <form class="send-flow" data-send>
        <section class="send-step">
          <div class="send-step-head">
            <span class="send-step-num">1</span>
            <div><div class="send-step-title">Which venue?</div><div class="send-step-sub">Pick from the shared database.</div></div>
          </div>
          <select class="select" data-venue>
            ${venues.map((v) => `<option value="${esc(v.id)}" ${v.id === venueId ? 'selected' : ''}>${esc(v.name)} — ${esc(v.city)}, ${esc(v.state)} (cap ${v.capacity})</option>`).join('')}
          </select>
          ${prior ? `<div class="panel-note panel-warn" style="margin-top:12px">${icon('clock')} You already contacted ${esc(venue.name)} ${relTime(prior.sentAt)} — currently marked <strong>${esc(prior.status)}</strong>. Sending again logs a second entry.</div>` : ''}
        </section>

        <section class="send-step">
          <div class="send-step-head">
            <span class="send-step-num">2</span>
            <div><div class="send-step-title">Booking contact</div><div class="send-step-sub">Pulled from the venue record — edit if you have a better address.</div></div>
          </div>
          <div class="form-grid">
            <div class="field"><label for="s-name">Contact</label><input class="input" id="s-name" value="${esc(venue?.contactName || '')}" readonly></div>
            <div class="field"><label for="s-to">Send to</label><input class="input" id="s-to" name="to" type="email" value="${esc(venue?.contactEmail || '')}" required></div>
          </div>
          ${venue ? `<div class="hint">${esc(venue.name)} accepts submissions by ${esc(venue.submissionMethod.toLowerCase())}. ${esc(venue.notes)}</div>` : ''}
        </section>

        <section class="send-step">
          <div class="send-step-head">
            <span class="send-step-num">3</span>
            <div><div class="send-step-title">Which EPK?</div><div class="send-step-sub">The email body is written from this kit's short bio.</div></div>
          </div>
          <select class="select" data-epk>
            ${epks.map((e) => `<option value="${esc(e.id)}" ${e.id === epkId ? 'selected' : ''}>${esc(e.title)}${e.isDefault ? ' (default)' : ''}</option>`).join('')}
          </select>
          ${epks.length === 1 && !isPro() ? '<div class="hint">Pro lets you keep a different kit per project.</div>' : ''}
        </section>

        <section class="send-step">
          <div class="send-step-head">
            <span class="send-step-num">4</span>
            <div><div class="send-step-title">Subject line</div><div class="send-step-sub">Kept short — bookers scan on a phone.</div></div>
          </div>
          <input class="input" name="subject" value="${esc(subject)}" required>
        </section>

        <section class="send-step">
          <div class="send-step-head">
            <span class="send-step-num">5</span>
            <div class="grow"><div class="send-step-title">Message</div><div class="send-step-sub">Auto-filled from your EPK short bio. Edit freely — this send keeps its own copy.</div></div>
            <button type="button" class="btn btn-sm" data-reset>Reset to EPK bio</button>
          </div>
          <textarea class="textarea" name="body" rows="16" data-body required>${esc(body)}</textarea>
        </section>

        <section class="send-step">
          <div class="send-step-head">
            <span class="send-step-num">6</span>
            <div><div class="send-step-title">Attached press kit</div><div class="send-step-sub">What the venue receives alongside your message.</div></div>
          </div>
          <div class="card card-tight">
            <div class="row" style="gap:11px">
              <span class="tile ${tileClass(epk?.title)}">${
                epk?.photos?.[0] ? `<img src="${esc(epk.photos[0].src)}" alt="">` : esc(initials(epk?.title || 'EPK'))
              }</span>
              <div class="grow" style="min-width:0">
                <strong class="truncate" style="display:block">${esc(epk?.title || '')}</strong>
                <div class="small muted">${esc(epk?.tagline || 'No tagline')}</div>
                <div class="xs muted">${(epk?.photos || []).length} photo(s) · ${(epk?.tracks || []).length} track(s) · ${(epk?.pressQuotes || []).length} press quote(s)${
                  epk?.uploadedFile ? ` · ${esc(epk.uploadedFile.name)}` : ''
                }</div>
              </div>
              <a class="btn btn-sm" href="#/epk/${esc(epk?.id || '')}">${icon('edit')} Edit EPK</a>
            </div>
          </div>
        </section>

        <div class="row-between" style="margin-top:18px">
          <a class="btn" href="#/venues">Cancel</a>
          <button class="btn btn-primary btn-lg" type="submit">${icon('send')} Send EPK</button>
        </div>
      </form>`;
  },

  mount(root, ctx) {
    const form = root.querySelector('[data-send]');
    const venueSel = root.querySelector('[data-venue]');
    const epkSel = root.querySelector('[data-epk]');
    if (!form) return;

    const reload = () => ctx.navigate(`/send?venue=${venueSel.value}&epk=${epkSel.value}`);
    venueSel.addEventListener('change', reload);
    epkSel.addEventListener('change', reload);

    root.querySelector('[data-reset]')?.addEventListener('click', () => {
      root.querySelector('[data-body]').value = composeBody({
        user: currentUser(),
        venue: venueById(venueSel.value),
        epk: epkById(epkSel.value),
        settings: state.settings,
      });
      toast('Message reset from your EPK bio.');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const venue = venueById(venueSel.value);
      recordSend({
        venueId: venue.id,
        epkId: epkSel.value,
        to: String(data.to).trim(),
        subject: String(data.subject).trim(),
        body: String(data.body),
      });
      toast(`EPK sent to ${venue.name}.`, 'good');
      ctx.navigate('/outreach');
    });
  },
};
