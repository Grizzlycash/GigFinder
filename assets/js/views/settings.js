// Settings — profile, outreach defaults, and data controls.

import { currentUser, updateUser, state, save, resetAll, loadDemoOutreach, isPro } from '../store.js';
import { esc, icon, toast, confirmModal } from '../ui.js';

export default {
  title: 'Settings',

  render() {
    const user = currentUser();
    const s = state.settings;
    return `
      <div class="page-head"><h1>Settings</h1></div>

      <form class="stack" data-settings style="max-width:760px">
        <div class="card">
          <h3>Profile</h3>
          <div class="form-grid" style="margin-top:12px">
            <div class="field"><label for="st-artist">Artist name</label><input class="input" id="st-artist" name="artistName" value="${esc(user.artistName)}"></div>
            <div class="field"><label for="st-real">Your name</label><input class="input" id="st-real" name="realName" value="${esc(user.realName)}"></div>
            <div class="field"><label for="st-email">Email</label><input class="input" id="st-email" name="email" type="email" value="${esc(user.email)}"></div>
            <div class="field"><label for="st-draw">Typical draw</label>
              <select class="select" id="st-draw" name="drawSize">
                ${['', 'Under 25', '25–50', '50–100', '100–250', '250+'].map((v) => `<option ${user.drawSize === v ? 'selected' : ''}>${v || 'Select…'}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label for="st-city">Home city</label><input class="input" id="st-city" name="homeCity" value="${esc(user.homeCity)}"></div>
            <div class="field"><label for="st-state">State</label><input class="input" id="st-state" name="homeState" value="${esc(user.homeState)}"></div>
            <div class="field span-2"><label for="st-genres">Genres</label><input class="input" id="st-genres" name="genres" value="${esc((user.genres || []).join(', '))}"></div>
          </div>
        </div>

        <div class="card">
          <h3>Outreach defaults</h3>
          <div class="stack" style="margin-top:12px">
            <div class="field">
              <label for="st-subject">Subject template</label>
              <input class="input" id="st-subject" name="defaultSubject" value="${esc(s.defaultSubject)}">
              <div class="hint">Placeholders: <code>{artist}</code>, <code>{venue}</code>, <code>{city}</code></div>
            </div>
            <div class="field">
              <label for="st-sig">Email signature</label>
              <textarea class="textarea" id="st-sig" name="signature" rows="3" placeholder="Bandcamp · Instagram · phone">${esc(s.signature)}</textarea>
            </div>
            <div class="field">
              <label for="st-remind">Remind me to follow up after</label>
              <select class="select" id="st-remind" name="remindAfterDays" ${isPro() ? '' : 'disabled'}>
                ${[7, 10, 14, 21].map((d) => `<option value="${d}" ${Number(s.remindAfterDays) === d ? 'selected' : ''}>${d} days</option>`).join('')}
              </select>
              ${isPro() ? '' : '<div class="hint">Follow-up reminders are a Pro feature. <a href="#/pricing">Upgrade</a></div>'}
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Access</h3>
          <label class="check" style="margin-top:10px">
            <input type="checkbox" name="isAdmin" ${user.isAdmin ? 'checked' : ''}>
            <span>Admin access <span class="muted small">— shows the venue-database admin panel in the sidebar. In production this is granted by GigBook staff, not self-served.</span></span>
          </label>
        </div>

        <div class="row">
          <button class="btn btn-primary" type="submit">Save settings</button>
        </div>
      </form>

      <div class="card" style="max-width:760px;margin-top:18px">
        <h3>Data</h3>
        <p class="muted small">This prototype stores everything in your browser's local storage — nothing leaves the device.</p>
        <div class="row" style="margin-top:10px">
          <button class="btn btn-sm" data-demo>${icon('db')} Load sample pipeline</button>
          <button class="btn btn-sm btn-danger" data-reset>${icon('trash')} Reset all data</button>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const form = root.querySelector('[data-settings]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      updateUser({
        artistName: String(data.artistName || '').trim(),
        realName: String(data.realName || '').trim(),
        email: String(data.email || '').trim(),
        drawSize: String(data.drawSize || '').replace('Select…', ''),
        homeCity: String(data.homeCity || '').trim(),
        homeState: String(data.homeState || '').trim(),
        genres: String(data.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
        isAdmin: Boolean(data.isAdmin),
      });
      state.settings.defaultSubject = String(data.defaultSubject || '');
      state.settings.signature = String(data.signature || '');
      state.settings.remindAfterDays = Number(data.remindAfterDays || 10);
      save();
      toast('Settings saved.', 'good');
      ctx.rerender();
    });

    root.querySelector('[data-demo]')?.addEventListener('click', () => {
      loadDemoOutreach();
      toast('Sample pipeline loaded.', 'good');
      ctx.navigate('/outreach');
    });

    root.querySelector('[data-reset]')?.addEventListener('click', () => {
      confirmModal('Reset everything?', 'Deletes your account, EPKs and outreach from this browser and restores the seeded venue database.', () => resetAll(), 'Reset');
    });
  },
};
