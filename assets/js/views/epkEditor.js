// EPK generator — form on the left, live press-kit preview on the right.

import { epkById, updateEpk, currentUser } from '../store.js';
import { esc, icon, toast, uid } from '../ui.js';

let draft = null;

function hydrate(epk) {
  draft = JSON.parse(JSON.stringify(epk));
  draft.tracks = draft.tracks || [];
  draft.pressQuotes = draft.pressQuotes || [];
  draft.links = draft.links || {};
}

function preview(d, user) {
  return `
    <div class="epk-sheet">
      <div class="epk-sheet-head">
        <h3>${esc(d.title || user.artistName || 'Untitled')}</h3>
        <div class="tagline">${esc(d.tagline || 'Add a one-line tagline')}</div>
      </div>
      <div class="epk-sheet-body">
        ${d.photo ? `<img src="${esc(d.photo)}" alt="" style="border-radius:6px;margin-bottom:14px">` : ''}
        <div class="epk-sheet-section">
          <h4>BIO</h4>
          <p style="margin:0">${esc(d.shortBio || 'Your short bio appears here — and in every outreach email.')}</p>
        </div>
        ${d.longBio ? `<div class="epk-sheet-section"><h4>MORE</h4><p style="margin:0">${esc(d.longBio)}</p></div>` : ''}
        <div class="epk-sheet-section">
          <h4>DETAILS</h4>
          <div class="muted">${esc(d.homeCity || '—')} · ${esc((d.genres || []).join(', ') || 'No genres')}</div>
          ${user.drawSize ? `<div class="muted">Typical draw: ${esc(user.drawSize)}</div>` : ''}
        </div>
        ${d.tracks.length ? `
          <div class="epk-sheet-section">
            <h4>LISTEN</h4>
            ${d.tracks.map((t) => `<div class="truncate">${icon('music')} ${esc(t.title || 'Untitled')} — <span class="muted">${esc(t.url || '')}</span></div>`).join('')}
          </div>` : ''}
        ${d.pressQuotes.length ? `
          <div class="epk-sheet-section">
            <h4>PRESS</h4>
            ${d.pressQuotes.map((q) => `<p style="margin:0 0 8px">“${esc(q.text)}” <span class="muted">— ${esc(q.source)}</span></p>`).join('')}
          </div>` : ''}
        <div class="epk-sheet-section">
          <h4>LINKS</h4>
          ${Object.entries(d.links).filter(([, v]) => v).map(([k, v]) => `<div class="truncate">${esc(k)}: <span class="muted">${esc(v)}</span></div>`).join('') || '<span class="muted">No links added</span>'}
        </div>
      </div>
    </div>`;
}

export default {
  title: 'EPK generator',
  wide: true,

  render(ctx) {
    const epk = epkById(ctx.params.id);
    if (!epk) return '<div class="card empty"><h3>EPK not found</h3><p><a href="#/epk">Back to EPKs</a></p></div>';
    if (!draft || draft.id !== epk.id) hydrate(epk);
    const user = currentUser();
    const d = draft;

    return `
      <a class="small" href="#/epk">${icon('arrowLeft')} All EPKs</a>
      <div class="row-between" style="margin:10px 0 18px">
        <h1 style="margin:0">${esc(d.title)}</h1>
        <div class="row">
          <a class="btn" href="#/send?epk=${esc(d.id)}">${icon('send')} Send this EPK</a>
          <button class="btn btn-primary" data-save>Save changes</button>
        </div>
      </div>

      <div class="epk-layout">
        <div class="stack">
          <div class="card">
            <h3>Basics</h3>
            <div class="form-grid" style="margin-top:12px">
              <div class="field span-2"><label for="e-title">EPK title</label><input class="input" id="e-title" data-f="title" value="${esc(d.title)}"></div>
              <div class="field span-2"><label for="e-tag">Tagline</label><input class="input" id="e-tag" data-f="tagline" maxlength="90" value="${esc(d.tagline)}" placeholder="One line a booker could paste into a listing"></div>
              <div class="field"><label for="e-city">Based in</label><input class="input" id="e-city" data-f="homeCity" value="${esc(d.homeCity)}"></div>
              <div class="field"><label for="e-genres">Genres</label><input class="input" id="e-genres" data-f="genres" value="${esc((d.genres || []).join(', '))}" placeholder="Comma separated"></div>
            </div>
          </div>

          <div class="card">
            <h3>Short bio</h3>
            <div class="panel-note" style="margin:10px 0 12px">
              ${icon('bolt')} This text auto-populates the body of every EPK email you send. Write it as if you were speaking to a booker.
            </div>
            <textarea class="textarea" rows="6" data-f="shortBio" maxlength="700">${esc(d.shortBio)}</textarea>
            <div class="hint"><span data-count>${d.shortBio.length}</span>/700</div>

            <div class="field" style="margin-top:16px">
              <label for="e-long">Long bio <span class="muted">(EPK page only)</span></label>
              <textarea class="textarea" id="e-long" rows="4" data-f="longBio">${esc(d.longBio)}</textarea>
            </div>
          </div>

          <div class="card">
            <div class="row-between"><h3>Tracks</h3><button class="btn btn-sm" data-add-track>${icon('plus')} Add track</button></div>
            <div class="stack-sm" style="margin-top:12px" data-tracks>
              ${d.tracks.length ? d.tracks.map((t, i) => `
                <div class="row" data-track="${i}">
                  <input class="input" data-track-title="${i}" value="${esc(t.title)}" placeholder="Track title" style="max-width:220px">
                  <input class="input grow" data-track-url="${i}" value="${esc(t.url)}" placeholder="https://…">
                  <button class="btn btn-sm btn-danger" data-track-del="${i}" aria-label="Remove">${icon('trash')}</button>
                </div>`).join('') : '<p class="muted small">No tracks yet. Two or three is plenty — lead with the strongest.</p>'}
            </div>
          </div>

          <div class="card">
            <div class="row-between"><h3>Press quotes</h3><button class="btn btn-sm" data-add-quote>${icon('plus')} Add quote</button></div>
            <div class="stack-sm" style="margin-top:12px">
              ${d.pressQuotes.length ? d.pressQuotes.map((q, i) => `
                <div class="row" data-quote="${i}">
                  <input class="input grow" data-quote-text="${i}" value="${esc(q.text)}" placeholder="“They played like the room owed them money.”">
                  <input class="input" data-quote-source="${i}" value="${esc(q.source)}" placeholder="Source" style="max-width:180px">
                  <button class="btn btn-sm btn-danger" data-quote-del="${i}" aria-label="Remove">${icon('trash')}</button>
                </div>`).join('') : '<p class="muted small">No press yet — that\'s fine. Local blog or radio play counts.</p>'}
            </div>
          </div>

          <div class="card">
            <h3>Links</h3>
            <div class="form-grid" style="margin-top:12px">
              ${['spotify', 'bandcamp', 'youtube', 'instagram', 'website'].map((key) => `
                <div class="field"><label for="e-${key}">${key[0].toUpperCase()}${key.slice(1)}</label>
                <input class="input" id="e-${key}" data-link="${key}" value="${esc(d.links[key] || '')}"></div>`).join('')}
            </div>
          </div>
        </div>

        <div class="epk-preview">
          <div class="small muted" style="margin-bottom:8px">Live preview</div>
          ${preview(d, user)}
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const user = currentUser();
    const previewBox = root.querySelector('.epk-preview');

    const repaint = () => {
      previewBox.innerHTML = `<div class="small muted" style="margin-bottom:8px">Live preview</div>${preview(draft, user)}`;
    };

    root.querySelectorAll('[data-f]').forEach((input) => input.addEventListener('input', () => {
      const key = input.dataset.f;
      draft[key] = key === 'genres'
        ? input.value.split(',').map((s) => s.trim()).filter(Boolean)
        : input.value;
      if (key === 'shortBio') root.querySelector('[data-count]').textContent = String(input.value.length);
      repaint();
    }));

    root.querySelectorAll('[data-link]').forEach((input) => input.addEventListener('input', () => {
      draft.links[input.dataset.link] = input.value;
      repaint();
    }));

    root.querySelector('[data-add-track]')?.addEventListener('click', () => {
      draft.tracks.push({ id: uid('trk'), title: '', url: '' });
      ctx.rerender();
    });
    root.querySelectorAll('[data-track-title]').forEach((i) => i.addEventListener('input', () => { draft.tracks[+i.dataset.trackTitle].title = i.value; repaint(); }));
    root.querySelectorAll('[data-track-url]').forEach((i) => i.addEventListener('input', () => { draft.tracks[+i.dataset.trackUrl].url = i.value; repaint(); }));
    root.querySelectorAll('[data-track-del]').forEach((b) => b.addEventListener('click', () => { draft.tracks.splice(+b.dataset.trackDel, 1); ctx.rerender(); }));

    root.querySelector('[data-add-quote]')?.addEventListener('click', () => {
      draft.pressQuotes.push({ id: uid('prq'), text: '', source: '' });
      ctx.rerender();
    });
    root.querySelectorAll('[data-quote-text]').forEach((i) => i.addEventListener('input', () => { draft.pressQuotes[+i.dataset.quoteText].text = i.value; repaint(); }));
    root.querySelectorAll('[data-quote-source]').forEach((i) => i.addEventListener('input', () => { draft.pressQuotes[+i.dataset.quoteSource].source = i.value; repaint(); }));
    root.querySelectorAll('[data-quote-del]').forEach((b) => b.addEventListener('click', () => { draft.pressQuotes.splice(+b.dataset.quoteDel, 1); ctx.rerender(); }));

    root.querySelector('[data-save]')?.addEventListener('click', () => {
      updateEpk(draft.id, {
        title: draft.title,
        tagline: draft.tagline,
        shortBio: draft.shortBio,
        longBio: draft.longBio,
        genres: draft.genres,
        homeCity: draft.homeCity,
        links: draft.links,
        tracks: draft.tracks.filter((t) => t.title || t.url),
        pressQuotes: draft.pressQuotes.filter((q) => q.text),
      });
      toast('EPK saved.', 'good');
      ctx.rerender();
    });
  },
};
