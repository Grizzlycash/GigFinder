// Plan & billing — Basic / Pro, monthly or annual (20% off).

import { PLANS, planPrice, annualTotal, currentUser, updateUser, ANNUAL_DISCOUNT } from '../store.js';
import { esc, icon, money, toast, confirmModal } from '../ui.js';

function card(id, cycle, currentPlan) {
  const p = PLANS[id];
  const current = currentPlan === id;
  const featured = id === 'pro';
  return `
    <div class="price-card ${featured ? 'featured' : ''}">
      <div class="row-between">
        <span class="badge ${current ? 'badge-brand' : featured ? 'badge-pro' : ''}">${
          current ? 'CURRENT PLAN' : featured ? 'MOST POPULAR' : esc(p.name.toUpperCase())
        }</span>
      </div>
      <h2 style="margin:14px 0 4px">${esc(p.name)}</h2>
      <p class="small muted" style="margin:0 0 16px">${esc(p.blurb)}</p>

      <div class="row" style="align-items:baseline;gap:5px">
        <span class="price-amount">${money(planPrice(id, cycle))}</span>
        <span class="small muted">/month</span>
      </div>
      <div class="price-note">${cycle === 'annual'
        ? `Billed as ${money(annualTotal(id))}/year — saves ${money(+(p.monthly * 12 - annualTotal(id)).toFixed(2))}`
        : `or ${money(p.annualMonthly)}/mo billed annually`}</div>

      <ul class="price-list">
        ${p.features.map((f) => `
          <li>
            <span class="price-check ${featured ? 'on' : ''}">${icon('check')}</span>
            <span>${esc(f.label)}${f.note ? `<span class="price-note" style="display:block">${esc(f.note)}</span>` : ''}</span>
          </li>`).join('')}
      </ul>

      <button class="btn ${featured ? 'btn-primary' : ''} btn-lg btn-block" style="margin-top:20px" data-choose="${id}" ${current ? 'disabled' : ''}>
        ${current ? 'Current plan' : featured ? 'Get Pro' : 'Switch to Basic'}
      </button>
    </div>`;
}

export default {
  title: 'Plan & Billing',

  topbar() {
    const user = currentUser();
    return { title: 'Plan & billing', sub: `${esc(PLANS[user.plan].name)} · billed ${esc(user.cycle === 'annual' ? 'annually' : 'monthly')}` };
  },

  render() {
    const user = currentUser();
    const cycle = user.cycle || 'monthly';

    return `
      <div class="price-head">
        <h1>Simple, transparent pricing</h1>
        <p class="muted">Everything you need to book more shows — no hidden fees.</p>
      </div>

      <div class="switch-row" style="margin-bottom:26px">
        <span class="switch-label ${cycle === 'monthly' ? 'on' : ''}">Monthly</span>
        <button class="switch" data-cycle role="switch" aria-checked="${cycle === 'annual'}" aria-label="Bill annually"></button>
        <span class="switch-label ${cycle === 'annual' ? 'on' : ''}">Annual</span>
        <span class="badge badge-brand" style="opacity:${cycle === 'annual' ? 1 : 0};transition:opacity .15s">SAVE ${Math.round(ANNUAL_DISCOUNT * 100)}%</span>
      </div>

      <div class="price-grid">
        ${card('basic', cycle, user.plan)}
        ${card('pro', cycle, user.plan)}
      </div>

      <p class="center small muted" style="margin-top:24px">Cancel anytime · Secure billing via Stripe · All prices in USD</p>

      <div class="card" style="max-width:700px;margin:22px auto 0">
        <h3>What counts as a send?</h3>
        <p class="small muted">One EPK email to one booking contact. Follow-ups sent from the tracker count too. Basic resets on your billing date; Pro is uncapped.</p>
        <h3 style="margin-top:14px">Billing</h3>
        <p class="small muted" style="margin:0">This prototype doesn't process payments — choosing a plan switches the feature set immediately so you can see both tiers.</p>
      </div>`;
  },

  mount(root, ctx) {
    root.querySelector('[data-cycle]')?.addEventListener('click', () => {
      updateUser({ cycle: currentUser().cycle === 'annual' ? 'monthly' : 'annual' });
      ctx.rerender();
    });

    root.querySelectorAll('[data-choose]').forEach((btn) => btn.addEventListener('click', () => {
      const id = btn.dataset.choose;
      if (id === 'basic' && currentUser().plan === 'pro') {
        confirmModal(
          'Switch to Basic?',
          'You keep your data, but sends are capped at 15/month and the EPK generator, follow-up reminders, saved lists, export and analytics switch off.',
          () => { updateUser({ plan: 'basic' }); toast('Switched to Basic.'); ctx.rerender(); },
          'Switch to Basic',
        );
        return;
      }
      updateUser({ plan: id });
      toast(id === 'pro' ? 'Welcome to Pro.' : 'Plan updated.', 'good');
      ctx.rerender();
    }));
  },
};
