// EPK generator — section rail on the left, sectioned form in the middle, preview on demand.
//
// The full generator is a Pro feature. Basic keeps the Biography section (the outreach email
// is written from its short bio) and can attach a press kit built elsewhere.

import {
  epkById, updateEpk, currentUser, normaliseEpk, epkProgress, can, isPro,
} from '../store.js';
import { esc, icon, toast, uid, modal, initials, tileClass } from '../ui.js';
import { ALL_GENRES } from '../seed.js';

let draft = null;
const ui = { section: 0 };

const SECTIONS = [
  { id: 'bio', label: 'Biography', icon: 'user', pro: false },
  { id: 'photos', label: 'Photos', icon: 'image', pro: true },
  { id: 'music', label: 'Music links', icon: 'music', pro: true },
  { id: 'socials', label: 'Social media', icon: 'globe', pro: true },
  { id: 'rider', label: 'Tech rider', icon: 'sliders', pro: true },
];

const MUSIC_FIELDS = [
  ['spotify', 'Spotify', 'open.spotify.com/artist/…'],
  ['soundcloud', 'SoundCloud', 'soundcloud.com/…'],
  ['appleMusic', 'Apple Music', 'music.apple.com/…'],
  ['youtube', 'YouTube', 'A full live song helps most'],
  ['bandcamp', 'Bandcamp', 'yourband.bandcamp.com'],
];

const SOCIAL_FIELDS = [
  ['instagram', 'Instagram', 'instagram.com/…'],
  ['facebook', 'Facebook', 'facebook.com/…'],
  ['tiktok', 'TikTok', 'tiktok.com/@…'],
  ['x', 'X / Twitter', 'x.com/…'],
  ['website', 'Website', 'yourband.com'],
];

function hydrate(epk) {
  draft = JSON.parse(JSON.stringify(normaliseEpk(epk)));
}

/* ---------- Section bodies ---------- */
function bioSection(user) {
  const d = draft;
  const genres = [...new Set([...ALL_GENRES, ...(d.genres || [])])];
  return `
    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('user')}</span>
        <div><div class="sc-title">Artist details</div><div class="sc-sub">Shown at the top of your EPK</div></div>
      </div>
      <div class="sc-body">
        <div class="form-grid">
          <div class="field"><label for="e-title">EPK title</label><input class="input" id="e-title" data-f="title" value="${esc(d.title)}"></div>
          <div class="field"><label for="e-city">Based in</label><input class="input" id="e-city" data-f="homeCity" value="${esc(d.homeCity)}"></div>
        </div>
        <div class="field">
          <label for="e-tag">Tagline</label>
          <input class="input" id="e-tag" data-f="tagline" maxlength="90" value="${esc(d.tagline)}" placeholder="One line a booker could paste into a listing">
        </div>
        <div class="field">
          <span class="label">Genre tags</span>
          <div class="row-wrap" data-genres>
            ${genres.map((g) => `<button type="button" class="chip" data-genre="${esc(g)}" aria-pressed="${(d.genres || []).includes(g)}">${esc(g)}</button>`).join('')}
          </div>
          <div class="hint">Used to match you with suitable venues.</div>
        </div>
        <div class="form-grid">
          <div class="field"><label for="e-set">Typical set length</label>
            <select class="select" id="e-set" data-f="setLength">
              ${['30 minutes', '45 minutes', '60 minutes', '90 minutes', '120 minutes'].map((o) => `<option ${d.setLength === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label for="e-aud">Typical audience size</label>
            <select class="select" id="e-aud" data-f="audienceSize">
              ${['Under 50', '50–150', '150–300', '300–600', '600+'].map((o) => `<option ${d.audienceSize === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('doc')}</span>
        <div><div class="sc-title">Biography</div><div class="sc-sub">The short bio writes your booking emails</div></div>
      </div>
      <div class="sc-body">
        <div class="field">
          <label for="e-short">Short bio <span class="muted" style="font-weight:400">(used in email drafts)</span></label>
          <textarea class="textarea" id="e-short" rows="4" data-f="shortBio" maxlength="700">${esc(d.shortBio)}</textarea>
          <div class="char-count"><span data-count>${d.shortBio.length}</span> / 700 characters</div>
        </div>
        <div class="field">
          <label for="e-long">Full biography <span class="muted" style="font-weight:400">(shown in the EPK)</span></label>
          <textarea class="textarea" id="e-long" rows="6" data-f="longBio">${esc(d.longBio)}</textarea>
        </div>
        <div class="field">
          <label for="e-notable">Notable performances / press</label>
          <textarea class="textarea" id="e-notable" rows="3" data-f="notable" placeholder="Residencies, supports, radio play, reviews…">${esc(d.notable)}</textarea>
        </div>
      </div>
    </div>

    ${isPro() ? '' : `
      <div class="panel-note" style="margin-top:13px">
        ${icon('lock')} Photos, music links, socials and the tech rider are part of the Pro EPK generator.
        On Basic you can still <strong>attach a press kit you made elsewhere</strong> below. <a href="#/pricing">Compare plans</a>
      </div>
      <div class="section-card" style="margin-top:13px">
        <div class="sc-head">
          <span class="sc-icon">${icon('upload')}</span>
          <div><div class="sc-title">Upload your own EPK</div><div class="sc-sub">PDF sent alongside your email</div></div>
        </div>
        <div class="sc-body">
          ${d.uploadedFile
            ? `<div class="contact-block">
                 <span class="tile tile-sm ${tileClass(d.uploadedFile.name)}">${icon('doc')}</span>
                 <div class="grow" style="min-width:0"><div class="small truncate"><strong>${esc(d.uploadedFile.name)}</strong></div>
                 <div class="xs muted">${esc(d.uploadedFile.size)}</div></div>
                 <button class="btn btn-sm btn-danger" data-remove-file>${icon('trash')}</button>
               </div>`
            : `<input class="input" type="file" accept="application/pdf" data-epk-file>
               <div class="hint">The file name is recorded in this prototype; Bubble will store the file itself.</div>`}
        </div>
      </div>`}`;
}

function photosSection() {
  const photos = draft.photos || [];
  const slots = [];
  for (let i = 0; i < 6; i += 1) {
    const p = photos[i];
    slots.push(p
      ? `<div class="photo-slot filled">
           <img src="${esc(p.src)}" alt="">
           <span class="photo-tag">${i === 0 ? 'Cover photo' : esc(p.label || `Photo ${i + 1}`)}</span>
           <button class="btn btn-sm btn-danger" data-del-photo="${esc(p.id)}" style="position:absolute;top:6px;right:6px;z-index:2">${icon('x')}</button>
         </div>`
      : `<button class="photo-slot" data-add-photo type="button">${icon('plus')}<span>Add photo</span></button>`);
  }
  return `
    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('image')}</span>
        <div><div class="sc-title">Press photos</div><div class="sc-sub">Images included with your EPK</div></div>
      </div>
      <div class="sc-body">
        <p class="small muted" style="margin:0">Up to 6 photos. The first is used as the cover image.</p>
        <div class="photo-grid">${slots.join('')}</div>
        <input type="file" accept="image/*" class="hidden" data-photo-input>
      </div>
    </div>`;
}

function linkRows(fields, group) {
  return fields.map(([key, label, placeholder]) => `
    <div class="link-row">
      <span class="link-icon">${icon(group === 'music' ? 'music' : 'globe')}</span>
      <span class="link-label">${esc(label)}</span>
      <input class="input grow" data-link="${group}.${key}" value="${esc(draft[group][key] || '')}" placeholder="${esc(placeholder)}">
    </div>`).join('');
}

function musicSection() {
  return `
    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('music')}</span>
        <div><div class="sc-title">Music links</div><div class="sc-sub">Platforms included in your EPK and email footer</div></div>
      </div>
      <div class="sc-body">${linkRows(MUSIC_FIELDS, 'music')}</div>
    </div>

    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('list')}</span>
        <div><div class="sc-title">Featured tracks</div><div class="sc-sub">Two or three is plenty — lead with the strongest</div></div>
      </div>
      <div class="sc-body">
        ${(draft.tracks || []).map((t, i) => `
          <div class="row">
            <input class="input" data-track-title="${i}" value="${esc(t.title)}" placeholder="Track title" style="max-width:220px">
            <input class="input grow" data-track-url="${i}" value="${esc(t.url)}" placeholder="https://…">
            <button class="btn btn-sm btn-danger" data-track-del="${i}" aria-label="Remove">${icon('trash')}</button>
          </div>`).join('')}
        <button class="btn btn-sm" data-add-track style="align-self:flex-start">${icon('plus')} Add track</button>
      </div>
    </div>`;
}

function socialsSection() {
  return `
    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('globe')}</span>
        <div><div class="sc-title">Social media &amp; website</div><div class="sc-sub">Links shown in your EPK footer</div></div>
      </div>
      <div class="sc-body">${linkRows(SOCIAL_FIELDS, 'socials')}</div>
    </div>

    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('star')}</span>
        <div><div class="sc-title">Press quotes</div><div class="sc-sub">Local blog or radio play counts</div></div>
      </div>
      <div class="sc-body">
        ${(draft.pressQuotes || []).map((q, i) => `
          <div class="row">
            <input class="input grow" data-quote-text="${i}" value="${esc(q.text)}" placeholder="“They played like the room owed them money.”">
            <input class="input" data-quote-source="${i}" value="${esc(q.source)}" placeholder="Source" style="max-width:170px">
            <button class="btn btn-sm btn-danger" data-quote-del="${i}" aria-label="Remove">${icon('trash')}</button>
          </div>`).join('')}
        <button class="btn btn-sm" data-add-quote style="align-self:flex-start">${icon('plus')} Add quote</button>
      </div>
    </div>`;
}

function riderSection() {
  const r = draft.rider;
  return `
    <div class="section-card">
      <div class="sc-head">
        <span class="sc-icon">${icon('sliders')}</span>
        <div><div class="sc-title">Technical requirements</div><div class="sc-sub">What you need from the venue</div></div>
      </div>
      <div class="sc-body">
        <div class="form-grid">
          <div class="field"><label for="r-format">Performance format</label>
            <select class="select" id="r-format" data-r="format">
              ${['Solo acoustic', 'Duo', 'Trio', 'Full band', 'Solo with backing track'].map((o) => `<option ${r.format === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label for="r-pa">PA required</label>
            <select class="select" id="r-pa" data-r="pa">
              ${['Yes — venue to provide', 'No — self-contained', 'Flexible'].map((o) => `<option ${r.pa === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label for="r-mics">Microphones</label><input class="input" id="r-mics" data-r="mics" value="${esc(r.mics)}" placeholder="2 × vocal, 1 × instrument"></div>
          <div class="field"><label for="r-di">DI boxes</label><input class="input" id="r-di" data-r="di" value="${esc(r.di)}" placeholder="1 × DI (acoustic guitar)"></div>
          <div class="field"><label for="r-mon">Monitors</label><input class="input" id="r-mon" data-r="monitors" value="${esc(r.monitors)}" placeholder="2 × floor wedge"></div>
          <div class="field"><label for="r-setup">Setup time needed</label>
            <select class="select" id="r-setup" data-r="setupTime">
              ${['15 minutes', '30 minutes', '45 minutes', '60 minutes'].map((o) => `<option ${r.setupTime === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field"><label for="r-notes">Additional notes</label>
          <textarea class="textarea" id="r-notes" rows="3" data-r="notes" placeholder="Anything else a sound engineer should know…">${esc(r.notes)}</textarea>
        </div>
        <div class="field"><label for="r-hosp">Hospitality</label>
          <input class="input" id="r-hosp" data-r="hospitality" value="${esc(r.hospitality)}" placeholder="Meal or drinks tab, parking, travel…">
        </div>
      </div>
    </div>`;
}

function lockedSection(label) {
  return `
    <div class="locked">
      ${icon('lock', 'icon-lg')}
      <h3 style="margin-top:10px">${esc(label)} is part of the Pro EPK generator</h3>
      <p class="muted">Pro builds the full press kit — photos, music links, socials and a tech rider — and keeps unlimited kits.</p>
      <a class="btn btn-primary" href="#/pricing">See Pro — $19.99/mo</a>
    </div>`;
}

/* ---------- Preview ---------- */
function previewModal(user) {
  const d = draft;
  modal({
    title: 'EPK preview',
    size: 'lg',
    body: `
      <div class="card card-flush">
        <div style="background:var(--brand);padding:18px;color:#fff">
          <div style="font-size:var(--fs-lg);font-weight:700">${esc(d.title || user.artistName)}</div>
          <div class="small" style="color:#D5E4FF">${esc(d.tagline || 'No tagline yet')}</div>
        </div>
        <div class="card-body stack">
          ${d.photos?.length ? `<div class="photo-grid">${d.photos.slice(0, 3).map((p) => `<div class="photo-slot filled"><img src="${esc(p.src)}" alt=""></div>`).join('')}</div>` : ''}
          <div><div class="eyebrow">Bio</div><p class="small" style="margin:4px 0 0">${esc(d.shortBio || 'No short bio yet.')}</p></div>
          ${d.longBio ? `<div><div class="eyebrow">More</div><p class="small" style="margin:4px 0 0">${esc(d.longBio)}</p></div>` : ''}
          <div><div class="eyebrow">Details</div>
            <p class="small muted" style="margin:4px 0 0">${esc(d.homeCity || '—')} · ${esc((d.genres || []).join(', ') || 'No genres')} · ${esc(d.setLength)} set · draws ${esc(d.audienceSize)}</p>
          </div>
          ${d.notable ? `<div><div class="eyebrow">Notable</div><p class="small" style="margin:4px 0 0">${esc(d.notable)}</p></div>` : ''}
          ${d.tracks?.filter((t) => t.url).length ? `<div><div class="eyebrow">Listen</div>${d.tracks.filter((t) => t.url).map((t) => `<div class="small truncate">${esc(t.title || 'Untitled')} — <span class="muted">${esc(t.url)}</span></div>`).join('')}</div>` : ''}
          ${d.pressQuotes?.filter((q) => q.text).length ? `<div><div class="eyebrow">Press</div>${d.pressQuotes.filter((q) => q.text).map((q) => `<p class="small" style="margin:4px 0 0">“${esc(q.text)}” <span class="muted">— ${esc(q.source)}</span></p>`).join('')}</div>` : ''}
          <div><div class="eyebrow">Links</div>
            ${[...Object.entries(d.music), ...Object.entries(d.socials)].filter(([, v]) => v)
              .map(([k, v]) => `<div class="small truncate">${esc(k)}: <span class="muted">${esc(v)}</span></div>`).join('') || '<span class="small muted">No links added</span>'}
          </div>
          ${d.rider?.format ? `<div><div class="eyebrow">Tech rider</div>
            <p class="small muted" style="margin:4px 0 0">${esc(d.rider.format)} · PA: ${esc(d.rider.pa)} · ${esc(d.rider.setupTime)} setup${d.rider.mics ? ` · ${esc(d.rider.mics)}` : ''}</p></div>` : ''}
        </div>
      </div>`,
    footer: '<button class="btn" data-modal-close>Close</button>',
  });
}

/* ---------- View ---------- */
export default {
  title: 'My EPK',
  flush: true,

  topbar() {
    return { title: 'My EPK', sub: draft ? esc(draft.title) : 'Electronic press kit' };
  },

  render(ctx) {
    const epk = epkById(ctx.params.id);
    if (!epk) return '<div class="grow"><div class="empty"><h3>EPK not found</h3><p><a href="#/epk">Back to your EPKs</a></p></div></div>';
    if (!draft || draft.id !== epk.id) hydrate(epk);

    const user = currentUser();
    const progress = epkProgress(draft);
    const index = Math.min(SECTIONS.length - 1, Math.max(0, ui.section));
    const section = SECTIONS[index];
    const generator = can('epkGenerator');

    const body = section.pro && !generator
      ? lockedSection(section.label)
      : { bio: () => bioSection(user), photos: photosSection, music: musicSection, socials: socialsSection, rider: riderSection }[section.id]();

    return `
      <div class="epk-shell">
        <div class="epk-rail">
          <div class="epk-rail-head">
            <div><strong>My EPK</strong></div>
            <div class="xs muted">Electronic press kit</div>
          </div>
          <div class="epk-rail-progress">
            <div class="bar"><span style="width:${Math.round((progress.count / progress.total) * 100)}%"></span></div>
            <div class="xs muted" style="margin-top:6px">${progress.count} of ${progress.total} sections complete</div>
          </div>
          <div class="epk-rail-list">
            ${SECTIONS.map((s, i) => `
              <button class="epk-sec ${i === index ? 'active' : ''}" data-section="${i}">
                <span class="epk-sec-icon">${icon(s.icon)}</span>
                <span class="epk-sec-label">${esc(s.label)}</span>
                ${s.pro && !generator
                  ? '<span class="badge badge-outline">PRO</span>'
                  : progress.done[s.id]
                    ? `<span class="epk-sec-check">${icon('check')}</span>`
                    : '<span class="epk-sec-check todo"></span>'}
              </button>`).join('')}
          </div>
          <div style="padding:11px">
            <button class="btn btn-block btn-sm" data-preview>${icon('eye')} Preview EPK</button>
          </div>
        </div>

        <div class="epk-form">
          <div class="filter-bar">
            <a class="btn btn-sm btn-ghost" href="#/epk">${icon('arrowLeft')} All EPKs</a>
            <span class="grow"></span>
            ${section.pro ? '<span class="badge badge-pro">PRO FEATURE</span>' : ''}
            <a class="btn btn-sm" href="#/send?epk=${esc(draft.id)}">${icon('send')} Send this EPK</a>
            <button class="btn btn-primary btn-sm" data-save>Save section</button>
          </div>
          <div class="epk-form-scroll">${body}</div>
          <div class="epk-bottom">
            <span class="small muted">Section ${index + 1} of ${SECTIONS.length}</span>
            <div class="row">
              <button class="btn" data-prev ${index === 0 ? 'disabled' : ''}>${icon('chevronLeft')} Previous</button>
              ${index === SECTIONS.length - 1
                ? '<button class="btn btn-primary" data-finish>Finish EPK</button>'
                : `<button class="btn btn-primary" data-next>Next: ${esc(SECTIONS[index + 1].label)} ${icon('chevronRight')}</button>`}
            </div>
          </div>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const user = currentUser();

    const persist = () => updateEpk(draft.id, {
      title: draft.title,
      tagline: draft.tagline,
      shortBio: draft.shortBio,
      longBio: draft.longBio,
      notable: draft.notable,
      genres: draft.genres,
      homeCity: draft.homeCity,
      setLength: draft.setLength,
      audienceSize: draft.audienceSize,
      music: draft.music,
      socials: draft.socials,
      rider: draft.rider,
      photos: draft.photos,
      uploadedFile: draft.uploadedFile,
      tracks: (draft.tracks || []).filter((t) => t.title || t.url),
      pressQuotes: (draft.pressQuotes || []).filter((q) => q.text),
    });

    // Simple text/select fields
    root.querySelectorAll('[data-f]').forEach((input) => input.addEventListener('input', () => {
      draft[input.dataset.f] = input.value;
      if (input.dataset.f === 'shortBio') {
        const count = root.querySelector('[data-count]');
        if (count) count.textContent = String(input.value.length);
      }
    }));

    root.querySelectorAll('[data-link]').forEach((input) => input.addEventListener('input', () => {
      const [group, key] = input.dataset.link.split('.');
      draft[group][key] = input.value;
    }));

    root.querySelectorAll('[data-r]').forEach((input) => input.addEventListener('input', () => {
      draft.rider[input.dataset.r] = input.value;
    }));

    root.querySelectorAll('[data-genre]').forEach((chip) => chip.addEventListener('click', () => {
      const g = chip.dataset.genre;
      draft.genres = (draft.genres || []).includes(g)
        ? draft.genres.filter((x) => x !== g)
        : [...(draft.genres || []), g];
      chip.setAttribute('aria-pressed', String(draft.genres.includes(g)));
    }));

    // Photos
    const photoInput = root.querySelector('[data-photo-input]');
    root.querySelectorAll('[data-add-photo]').forEach((slot) => slot.addEventListener('click', () => photoInput?.click()));
    photoInput?.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) { toast('Please pick an image under 1.5 MB.', 'bad'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        draft.photos = [...(draft.photos || []), { id: uid('img'), src: String(reader.result), label: file.name }];
        persist();
        ctx.rerender();
      };
      reader.readAsDataURL(file);
    });
    root.querySelectorAll('[data-del-photo]').forEach((btn) => btn.addEventListener('click', () => {
      draft.photos = draft.photos.filter((p) => p.id !== btn.dataset.delPhoto);
      persist();
      ctx.rerender();
    }));

    // Uploaded press kit (Basic)
    root.querySelector('[data-epk-file]')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      draft.uploadedFile = { name: file.name, size: `${Math.round(file.size / 1024)} KB` };
      persist();
      toast('Press kit attached.', 'good');
      ctx.rerender();
    });
    root.querySelector('[data-remove-file]')?.addEventListener('click', () => {
      draft.uploadedFile = null;
      persist();
      ctx.rerender();
    });

    // Tracks and quotes
    root.querySelector('[data-add-track]')?.addEventListener('click', () => {
      draft.tracks = [...(draft.tracks || []), { id: uid('trk'), title: '', url: '' }];
      ctx.rerender();
    });
    root.querySelectorAll('[data-track-title]').forEach((i) => i.addEventListener('input', () => { draft.tracks[+i.dataset.trackTitle].title = i.value; }));
    root.querySelectorAll('[data-track-url]').forEach((i) => i.addEventListener('input', () => { draft.tracks[+i.dataset.trackUrl].url = i.value; }));
    root.querySelectorAll('[data-track-del]').forEach((b) => b.addEventListener('click', () => { draft.tracks.splice(+b.dataset.trackDel, 1); ctx.rerender(); }));

    root.querySelector('[data-add-quote]')?.addEventListener('click', () => {
      draft.pressQuotes = [...(draft.pressQuotes || []), { id: uid('prq'), text: '', source: '' }];
      ctx.rerender();
    });
    root.querySelectorAll('[data-quote-text]').forEach((i) => i.addEventListener('input', () => { draft.pressQuotes[+i.dataset.quoteText].text = i.value; }));
    root.querySelectorAll('[data-quote-source]').forEach((i) => i.addEventListener('input', () => { draft.pressQuotes[+i.dataset.quoteSource].source = i.value; }));
    root.querySelectorAll('[data-quote-del]').forEach((b) => b.addEventListener('click', () => { draft.pressQuotes.splice(+b.dataset.quoteDel, 1); ctx.rerender(); }));

    // Navigation
    root.querySelectorAll('[data-section]').forEach((btn) => btn.addEventListener('click', () => {
      persist();
      ui.section = Number(btn.dataset.section);
      ctx.rerender();
    }));
    root.querySelector('[data-prev]')?.addEventListener('click', () => { persist(); ui.section -= 1; ctx.rerender(); });
    root.querySelector('[data-next]')?.addEventListener('click', () => { persist(); ui.section += 1; ctx.rerender(); });
    root.querySelector('[data-finish]')?.addEventListener('click', () => {
      persist();
      toast('EPK saved.', 'good');
      ctx.navigate('/epk');
    });
    root.querySelector('[data-save]')?.addEventListener('click', () => {
      persist();
      toast('Section saved.', 'good');
      ctx.rerender();
    });
    root.querySelector('[data-preview]')?.addEventListener('click', () => { persist(); previewModal(user); });
  },
};
