// Landing + sign in / sign up (chrome: bare).

import { state, signUp, signIn } from '../store.js';
import { esc, icon, toast } from '../ui.js';

export default {
  title: 'GigBook',
  chrome: 'bare',
  auth: false,

  render() {
    const hasAccounts = state.users.length > 0;
    return `
      <div class="auth-wrap">
        <section class="auth-hero">
          <div class="row" style="gap:10px;margin-bottom:22px">
            <div class="brand-mark" style="background:#fff"></div>
            <span style="font-weight:700;font-size:20px">GigBook</span>
          </div>
          <h1>Book more shows without losing the thread.</h1>
          <p>GigBook gives independent musicians a curated venue database, a press kit that writes your outreach email for you, and a pipeline that shows exactly who owes you a reply.</p>
          <div style="margin-top:12px">
            <div class="feat">${icon('pin')}<div><strong>Curated venue database</strong><br><span style="color:#DFF1EA">Real booking contacts, capacities and submission rules — kept current.</span></div></div>
            <div class="feat">${icon('send')}<div><strong>One-screen EPK sends</strong><br><span style="color:#DFF1EA">Your short bio auto-fills the email body, so every pitch reads consistently.</span></div></div>
            <div class="feat">${icon('inbox')}<div><strong>Outreach tracker</strong><br><span style="color:#DFF1EA">Sent, opened, replied, booked, declined — at a glance.</span></div></div>
          </div>
          <p style="margin-top:26px;color:#CBE8DE;font-size:12px">Basic $9.99/mo · Pro $19.99/mo · Save 20% annually</p>
        </section>

        <section class="auth-form">
          <div class="auth-form-inner">
            <div class="tabs" style="margin-bottom:18px">
              <button class="tab" data-tab="signup" aria-selected="true">Create account</button>
              <button class="tab" data-tab="signin" aria-selected="false">Sign in</button>
            </div>

            <form class="stack" data-form="signup">
              <h2>Start booking</h2>
              <p class="muted small">Four short steps and you can send your first EPK.</p>
              <div class="field">
                <label for="su-artist">Artist or band name</label>
                <input class="input" id="su-artist" name="artistName" placeholder="e.g. The Paper Kites" required>
              </div>
              <div class="field">
                <label for="su-email">Email</label>
                <input class="input" id="su-email" name="email" type="email" placeholder="you@example.com" required>
              </div>
              <button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>
              <p class="hint">No card needed to look around — you pick a plan at the end of onboarding.</p>
            </form>

            <form class="stack hidden" data-form="signin">
              <h2>Welcome back</h2>
              <div class="field">
                <label for="si-email">Email</label>
                <input class="input" id="si-email" name="email" type="email" placeholder="you@example.com" required>
              </div>
              <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
              ${hasAccounts
                ? `<p class="hint">Accounts on this device: ${state.users.map((u) => `<a href="#" data-quick="${esc(u.email)}">${esc(u.email)}</a>`).join(', ')}</p>`
                : '<p class="hint">No accounts on this device yet — create one first.</p>'}
            </form>
          </div>
        </section>
      </div>`;
  },

  mount(root, ctx) {
    const tabs = root.querySelectorAll('[data-tab]');
    const forms = {
      signup: root.querySelector('[data-form="signup"]'),
      signin: root.querySelector('[data-form="signin"]'),
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      Object.entries(forms).forEach(([key, form]) => form.classList.toggle('hidden', key !== tab.dataset.tab));
    }));

    forms.signup.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(forms.signup);
      const email = String(data.get('email')).trim();
      if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        toast('That email already has an account — sign in instead.', 'bad');
        return;
      }
      signUp(email, String(data.get('artistName')).trim());
      ctx.navigate('/onboarding');
      ctx.rerender();
    });

    forms.signin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = String(new FormData(forms.signin).get('email')).trim();
      if (!signIn(email)) { toast('No account with that email on this device.', 'bad'); return; }
      ctx.navigate('/dashboard');
      ctx.rerender();
    });

    root.querySelectorAll('[data-quick]').forEach((link) => link.addEventListener('click', (e) => {
      e.preventDefault();
      signIn(link.dataset.quick);
      ctx.navigate('/dashboard');
      ctx.rerender();
    }));
  },
};
