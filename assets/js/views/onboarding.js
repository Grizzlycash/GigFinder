// Four-step onboarding: profile -> links & photo -> EPK bio -> plan.

import { currentUser, updateUser, createEpk, myEpks, PLANS, planPrice, annualTotal } from '../store.js';
import { esc, icon, toast, money } from '../ui.js';
import { ALL_GENRES } from '../seed.js';

const STEPS = ['Your artist profile', 'Links & photo', 'Your EPK bio', 'Choose your plan'];
const GENRE_OPTIONS = [...new Set([...ALL_GENRES, 'Metal', 'Pop', 'Experimental', 'World', 'Bluegrass'])].sort();

function stepBar(current) {
  return `<div class="steps">${STEPS.map((name, i) => {
    const n = i + 1;
    const cls = n < current ? 'done' : n === current ? 'current' : '';
    return `<div class="step ${cls}">
      <div class="bar"><span style="width:${n <= current ? 100 : 0}%"></span></div>
      <div class="step-name">${n}. ${esc(name)}</div>
    </div>`;
  }).join('')}</div>`;
}

function genreChips(selected) {
  return GENRE_OPTIONS.map((g) => `
    <button type="button" class="chip" data-genre="${esc(g)}" aria-pressed="${selected.includes(g)}">${esc(g)}</button>`).join('');
}

function step1(user) {
  return `
    <h2>Tell us who you are</h2>
    <p class="muted">This is what venues see first. You can change any of it later.</p>
    <div class="form-grid" style="margin-top:16px">
      <div class="field span-2">
        <label for="ob-artist">Artist / band name</label>
        <input class="input" id="ob-artist" name="artistName" value="${esc(user.artistName)}" required>
      </div>
      <div class="field">
        <label for="ob-real">Your name</label>
        <input class="input" id="ob-real" name="realName" value="${esc(user.realName)}" placeholder="Who signs the email">
      </div>
      <div class="field">
        <label for="ob-draw">Typical local draw</label>
        <select class="select" id="ob-draw" name="drawSize">
          ${['', 'Under 25', '25–50', '50–100', '100–250', '250+'].map((v) => `<option value="${esc(v)}" ${user.drawSize === v ? 'selected' : ''}>${v || 'Select…'}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="ob-city">Home city</label>
        <input class="input" id="ob-city" name="homeCity" value="${esc(user.homeCity)}" placeholder="Nashville">
      </div>
      <div class="field">
        <label for="ob-state">State / region</label>
        <input class="input" id="ob-state" name="homeState" value="${esc(user.homeState)}" placeholder="TN">
      </div>
      <div class="field span-2">
        <span class="label">Genres <span class="muted">(pick up to 3 — used to match venues)</span></span>
        <div class="row-wrap" data-genres>${genreChips(user.genres || [])}</div>
      </div>
    </div>`;
}

function step2(user) {
  const l = user.links || {};
  return `
    <h2>Where can venues hear you?</h2>
    <p class="muted">One strong link beats five weak ones. Bookers usually click the first.</p>
    <div class="form-grid" style="margin-top:16px">
      <div class="field span-2">
        <label for="ob-spotify">Primary streaming link</label>
        <input class="input" id="ob-spotify" name="links.spotify" value="${esc(l.spotify)}" placeholder="https://open.spotify.com/artist/…">
      </div>
      <div class="field"><label for="ob-bandcamp">Bandcamp</label><input class="input" id="ob-bandcamp" name="links.bandcamp" value="${esc(l.bandcamp)}"></div>
      <div class="field"><label for="ob-youtube">Live video</label><input class="input" id="ob-youtube" name="links.youtube" value="${esc(l.youtube)}" placeholder="A full live song helps most"></div>
      <div class="field"><label for="ob-instagram">Instagram</label><input class="input" id="ob-instagram" name="links.instagram" value="${esc(l.instagram)}"></div>
      <div class="field"><label for="ob-website">Website</label><input class="input" id="ob-website" name="links.website" value="${esc(l.website)}"></div>
      <div class="field span-2">
        <span class="label">Press photo</span>
        <div class="row">
          <div class="tile tile-lg tile-round t1" data-photo-preview>${user.photo ? `<img src="${esc(user.photo)}" alt="">` : icon('music', 'icon-lg')}</div>
          <div>
            <input type="file" id="ob-photo" accept="image/*" class="hidden" data-photo>
            <label class="btn btn-sm" for="ob-photo">${icon('upload')} Upload photo</label>
            <div class="hint">JPG or PNG. Stored locally in this prototype.</div>
          </div>
        </div>
      </div>
    </div>`;
}

function step3(user) {
  return `
    <h2>Write your EPK short bio</h2>
    <div class="panel-note" style="margin-bottom:16px">
      ${icon('bolt')} This short bio auto-populates the body of every EPK email you send, so your outreach stays consistent. Keep it to 2–4 sentences and lead with what a booker cares about: sound, draw, and recent shows.
    </div>
    <div class="stack">
      <div class="field">
        <label for="ob-tagline">One-line tagline</label>
        <input class="input" id="ob-tagline" name="tagline" value="${esc(user.tagline || '')}" placeholder="Dusty four-piece Americana from East Nashville" maxlength="90">
      </div>
      <div class="field">
        <label for="ob-short">Short bio</label>
        <textarea class="textarea" id="ob-short" name="shortBio" rows="6" maxlength="700" placeholder="${esc(`${user.artistName || 'We'} are a four-piece from Nashville playing close-harmony Americana. We released our second EP in March, we draw 80–120 in-market, and we're routing the Southeast in the autumn.`)}">${esc(user.shortBio || '')}</textarea>
        <div class="hint"><span data-count>0</span>/700 characters</div>
      </div>
      <div class="field">
        <label for="ob-long">Longer bio <span class="muted">(optional — shown on the EPK page, not in the email)</span></label>
        <textarea class="textarea" id="ob-long" name="longBio" rows="4">${esc(user.longBio || '')}</textarea>
      </div>
    </div>`;
}

function planCard(id, cycle, selected) {
  const p = PLANS[id];
  const price = planPrice(id, cycle);
  return `
    <label class="price-card ${selected === id ? 'featured' : ''}" style="cursor:pointer;display:block">
      <div class="row-between">
        <div class="row" style="gap:8px">
          <input type="radio" name="plan" value="${id}" ${selected === id ? 'checked' : ''} style="accent-color:var(--brand)">
          <strong>${esc(p.name)}</strong>
        </div>
        ${id === 'pro' ? '<span class="badge badge-pro">MOST POPULAR</span>' : ''}
      </div>
      <div class="price-amount" style="margin-top:10px">${money(price)}<span class="muted" style="font-size:13px;font-weight:400">/mo</span></div>
      <div class="small muted">${cycle === 'annual' ? `${money(annualTotal(id))} billed yearly` : 'Billed monthly'}</div>
      <ul class="price-list">
        ${p.features.map((f) => `<li><span class="price-check ${id === 'pro' ? 'on' : ''}">${icon('check')}</span><span>${esc(f.label)}</span></li>`).join('')}
      </ul>
    </label>`;
}

function step4(user) {
  const cycle = user.cycle || 'monthly';
  return `
    <h2>Choose your plan</h2>
    <p class="muted">Switch or cancel any time from Plan &amp; Billing.</p>
    <div class="row" style="margin:16px 0">
      <div class="segmented" data-cycle>
        <button type="button" data-c="monthly" aria-pressed="${cycle === 'monthly'}">Monthly</button>
        <button type="button" data-c="annual" aria-pressed="${cycle === 'annual'}">Annual — save 20%</button>
      </div>
    </div>
    <div class="price-grid" data-plans>
      ${planCard('basic', cycle, user.plan || 'basic')}
      ${planCard('pro', cycle, user.plan || 'basic')}
    </div>`;
}

export default {
  title: 'Set up GigBook',
  chrome: 'bare',

  render() {
    const user = currentUser();
    const step = Math.min(4, Math.max(1, user.onboardingStep || 1));
    const bodies = { 1: step1, 2: step2, 3: step3, 4: step4 };
    return `
      <div class="onboard">
        <div class="onboard-top">
          <div class="row" style="gap:9px">
            <div class="brand-mark"></div>
            <span class="brand-name">GigBook</span>
            <span class="muted small">Step ${step} of 4</span>
          </div>
        </div>
        <div class="onboard-body">
          <div class="onboard-inner">
            ${stepBar(step)}
            <form class="card" data-step-form novalidate>
              ${bodies[step](user)}
              <div class="row-between" style="margin-top:24px">
                <button type="button" class="btn ${step === 1 ? 'hidden' : ''}" data-back>${icon('chevronLeft')} Back</button>
                <div class="grow"></div>
                ${step < 4
                  ? `<button type="submit" class="btn btn-primary btn-lg">Continue ${icon('chevronRight')}</button>`
                  : '<button type="submit" class="btn btn-primary btn-lg">Finish setup</button>'}
              </div>
            </form>
            ${step === 3 ? '<p class="hint center" style="margin-top:12px">You can edit this any time in the EPK generator.</p>' : ''}
          </div>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const user = currentUser();
    const step = Math.min(4, Math.max(1, user.onboardingStep || 1));
    const form = root.querySelector('[data-step-form]');

    // Genre chips (step 1)
    let genres = [...(user.genres || [])];
    root.querySelectorAll('[data-genre]').forEach((chip) => chip.addEventListener('click', () => {
      const g = chip.dataset.genre;
      if (genres.includes(g)) genres = genres.filter((x) => x !== g);
      else if (genres.length >= 3) { toast('Pick up to 3 genres.'); return; }
      else genres.push(g);
      chip.setAttribute('aria-pressed', String(genres.includes(g)));
    }));

    // Photo (step 2)
    const photoInput = root.querySelector('[data-photo]');
    let photo = user.photo || '';
    if (photoInput) {
      photoInput.addEventListener('change', () => {
        const file = photoInput.files?.[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) { toast('Please pick an image under 1.5 MB.', 'bad'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          photo = String(reader.result);
          root.querySelector('[data-photo-preview]').innerHTML = `<img src="${photo}" alt="">`;
        };
        reader.readAsDataURL(file);
      });
    }

    // Character counter (step 3)
    const short = root.querySelector('#ob-short');
    const count = root.querySelector('[data-count]');
    if (short && count) {
      const sync = () => { count.textContent = String(short.value.length); };
      short.addEventListener('input', sync);
      sync();
    }

    // Billing cycle + plan (step 4)
    let cycle = user.cycle || 'monthly';
    let chosenPlan = user.plan || 'basic';
    root.querySelectorAll('[data-cycle] button').forEach((btn) => btn.addEventListener('click', () => {
      cycle = btn.dataset.c;
      updateUser({ cycle });
      ctx.rerender();
    }));
    root.querySelectorAll('input[name="plan"]').forEach((radio) => radio.addEventListener('change', () => {
      chosenPlan = radio.value;
      updateUser({ plan: chosenPlan, cycle });
      ctx.rerender();
    }));

    root.querySelector('[data-back]')?.addEventListener('click', () => {
      updateUser({ onboardingStep: step - 1 });
      ctx.rerender();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());

      if (step === 1) {
        if (!String(data.artistName || '').trim()) { toast('Artist name is required.', 'bad'); return; }
        updateUser({
          artistName: String(data.artistName).trim(),
          realName: String(data.realName || '').trim(),
          drawSize: String(data.drawSize || ''),
          homeCity: String(data.homeCity || '').trim(),
          homeState: String(data.homeState || '').trim(),
          genres,
          onboardingStep: 2,
        });
      }

      if (step === 2) {
        updateUser({
          links: {
            spotify: String(data['links.spotify'] || '').trim(),
            bandcamp: String(data['links.bandcamp'] || '').trim(),
            youtube: String(data['links.youtube'] || '').trim(),
            instagram: String(data['links.instagram'] || '').trim(),
            website: String(data['links.website'] || '').trim(),
          },
          photo,
          onboardingStep: 3,
        });
      }

      if (step === 3) {
        if (String(data.shortBio || '').trim().length < 20) {
          toast('Add a short bio — it becomes your email body.', 'bad');
          return;
        }
        updateUser({
          tagline: String(data.tagline || '').trim(),
          shortBio: String(data.shortBio).trim(),
          longBio: String(data.longBio || '').trim(),
          onboardingStep: 4,
        });
      }

      if (step === 4) {
        const u = updateUser({ plan: chosenPlan, cycle, onboarded: true, onboardingStep: 4 });
        if (!myEpks().length) {
          createEpk({
            title: `${u.artistName} — EPK`,
            tagline: u.tagline || '',
            shortBio: u.shortBio || '',
            longBio: u.longBio || '',
            genres: u.genres,
            homeCity: [u.homeCity, u.homeState].filter(Boolean).join(', '),
          });
        }
        toast(`You're on ${chosenPlan === 'pro' ? 'Pro' : 'Basic'}. Let's find you some shows.`, 'good');
        ctx.navigate('/dashboard');
        return;
      }

      ctx.rerender();
    });
  },
};
