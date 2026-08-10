// Plan & billing — Basic / Pro with a 20% annual discount.

import { PLANS, planPrice, annualTotal, currentUser, updateUser, ANNUAL_DISCOUNT } from '../store.js';
import { esc, icon, money, toast, confirmModal } from '../ui.js';

export default {
  title: 'Plan & Billing',

  render() {
    const user = currentUser();
    const cycle = user.cycle || 'monthly';

    const card = (id) => {
      const p = PLANS[id];
      const current = user.plan === id;
      const saving = +(p.monthly * 12 - annualTotal(id)).toFixed(2);
      return `
        <div class="price-card ${id === 'pro' ? 'featured' : ''}">
          <div class="row-between">
            <h2 style="margin:0">${esc(p.name)}</h2>
            ${current ? '<span class="badge badge-brand">CURRENT PLAN</span>' : id === 'pro' ? '<span class="badge badge-pro">MOST POPULAR</span>' : ''}
          </div>
          <p class="muted small" style="margin-top:4px">${esc(p.blurb)}</p>
          <div class="price-amount" style="margin-top:14px">${money(planPrice(id, cycle))}<span class="muted" style="font-size:14px;font-weight:400">/month</span></div>
          <div class="small muted">${cycle === 'annual' ? `${money(annualTotal(id))} billed yearly — you save ${money(saving)}` : `or ${money(p.annualMonthly)}/mo billed yearly`}</div>
          <ul class="price-list">
            ${p.features.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}
            ${p.missing.map((f) => `<li class="off">${icon('x')}<span>${esc(f)}</span></li>`).join('')}
          </ul>
          <button class="btn ${id === 'pro' ? 'btn-primary' : ''} btn-lg btn-block" style="margin-top:16px" data-choose="${id}" ${current && cycle === user.cycle ? 'disabled' : ''}>
            ${current ? 'Current plan' : id === 'pro' ? 'Upgrade to Pro' : 'Switch to Basic'}
          </button>
        </div>`;
    };

    return `
      <div class="page-head">
        <h1>Plan &amp; billing</h1>
        <p class="muted">You're on <strong>${esc(PLANS[user.plan].name)}</strong>, billed ${esc(cycle)}. Change or cancel any time.</p>
      </div>

      <div class="row" style="margin-bottom:18px">
        <div class="segmented" data-cycle>
          <button data-c="monthly" aria-pressed="${cycle === 'monthly'}">Monthly</button>
          <button data-c="annual" aria-pressed="${cycle === 'annual'}">Annual — save ${Math.round(ANNUAL_DISCOUNT * 100)}%</button>
        </div>
      </div>

      <div class="price-grid">${card('basic')}${card('pro')}</div>

      <div class="card" style="margin-top:22px;max-width:780px">
        <h3>What counts as a send?</h3>
        <p class="muted small">One EPK email to one booking contact. Follow-ups you send from the tracker count too. Basic resets on the 1st of each month; Pro is uncapped.</p>
        <h3 style="margin-top:14px">Billing</h3>
        <p class="muted small">This prototype does not process payments — choosing a plan switches the feature set immediately so you can see both tiers.</p>
      </div>`;
  },

  mount(root, ctx) {
    root.querySelectorAll('[data-cycle] button').forEach((btn) => btn.addEventListener('click', () => {
      updateUser({ cycle: btn.dataset.c });
      ctx.rerender();
    }));

    root.querySelectorAll('[data-choose]').forEach((btn) => btn.addEventListener('click', () => {
      const id = btn.dataset.choose;
      const user = currentUser();
      if (id === 'basic' && user.plan === 'pro') {
        confirmModal(
          'Switch to Basic?',
          'You keep your data, but sends are capped at 25/month and follow-up reminders, saved lists, export and analytics switch off.',
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
