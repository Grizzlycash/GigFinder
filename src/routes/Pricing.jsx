import { useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { PLANS, planPrice, annualTotal, currentUser, updateUser, ANNUAL_DISCOUNT } from '@/store/store';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { money, moneyAud } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Pricing() {
  const user = currentUser();
  const annual = user.cycle === 'annual';
  const cycle = annual ? 'annual' : 'monthly';
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);

  function choose(id) {
    if (id === 'basic' && user.plan === 'pro') { setConfirmDowngrade(true); return; }
    updateUser({ plan: id });
    toast.success(id === 'pro' ? 'Welcome to Pro' : 'Plan updated');
  }

  return (
    <AppShell title="Plan & billing" subtitle={`${PLANS[user.plan].name} · billed ${annual ? 'annually' : 'monthly'}`}>
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-none text-bone">Simple, honest pricing</h2>
          <p className="mt-2 text-[0.9rem] text-bone-muted">Everything you need to book more shows — no hidden fees.</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className={cn('font-display uppercase tracking-[0.1em] text-[0.78rem]', !annual ? 'text-bone' : 'text-bone-muted')}>Monthly</span>
          <Switch checked={annual} onCheckedChange={(v) => updateUser({ cycle: v ? 'annual' : 'monthly' })} aria-label="Bill annually" data-cycle />
          <span className={cn('font-display uppercase tracking-[0.1em] text-[0.78rem]', annual ? 'text-bone' : 'text-bone-muted')}>Annual</span>
          <span className={cn('stamp transition-opacity', annual ? 'opacity-100' : 'opacity-0')} style={{ color: 'var(--color-flash-green)', borderColor: 'var(--color-flash-green)' }}>
            Save {Math.round(ANNUAL_DISCOUNT * 100)}%
          </span>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {['basic', 'pro'].map((id) => {
            const p = PLANS[id];
            const current = user.plan === id;
            const featured = id === 'pro';
            return (
              <Card key={id} className={cn('flex flex-col', featured && 'border-2 border-flash-red')}>
                <CardContent className="flex flex-1 flex-col p-5">
                  <span
                    className="stamp self-start"
                    style={{
                      color: current ? 'var(--color-flash-green)' : featured ? 'var(--color-flash-red)' : 'var(--color-stamp-none)',
                      borderColor: current ? 'var(--color-flash-green)' : featured ? 'var(--color-flash-red)' : 'var(--color-stamp-none)',
                    }}
                  >
                    {current ? 'Current plan' : featured ? 'Most popular' : p.name}
                  </span>

                  <h3 className="mt-4 text-2xl leading-none">{p.name}</h3>
                  <p className="mt-1.5 text-[0.8rem] text-paper-muted">{p.blurb}</p>

                  <p className="mt-4 font-display text-4xl leading-none">
                    {money(planPrice(id, cycle))}
                    <span className="ml-1 font-sans text-[0.75rem] font-normal normal-case tracking-normal text-paper-muted">/month</span>
                  </p>
                  <p className="mt-1 text-[0.72rem] text-paper-muted">
                    {annual
                      ? `${moneyAud(annualTotal(id))} billed yearly — saves ${money(+(p.monthly * 12 - annualTotal(id)).toFixed(2))}`
                      : `or ${money(p.annualMonthly)}/mo billed yearly`}
                  </p>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f.label} className="flex gap-2.5 text-[0.83rem] leading-snug">
                        <Check className={cn('mt-0.5 size-4 shrink-0', featured ? 'text-flash-red' : 'text-paper-muted')} />
                        <span>
                          {f.label}
                          {f.note && <span className="block text-[0.72rem] text-paper-muted">{f.note}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-5 w-full"
                    size="lg"
                    variant={featured ? 'default' : 'paper'}
                    disabled={current}
                    onClick={() => choose(id)}
                    data-choose={id}
                  >
                    {current ? 'Current plan' : featured ? 'Get Pro' : 'Switch to Basic'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[0.78rem] text-bone-muted">
          Cancel anytime · Secure billing via Stripe · All prices in AUD
        </p>

        <Card className="mt-6">
          <CardContent className="space-y-3 p-5 text-[0.83rem] leading-relaxed">
            <div>
              <h3 className="text-[0.95rem]">What counts as a send?</h3>
              <p className="mt-1 text-paper-muted">One booking email to one contact. Follow-ups sent from the tracker count too. Basic resets on your billing date; Pro is uncapped.</p>
            </div>
            <div>
              <h3 className="text-[0.95rem]">Billing</h3>
              <p className="mt-1 text-paper-muted">This prototype doesn't process payments — choosing a plan switches the feature set immediately so you can see both tiers.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmDowngrade} onOpenChange={setConfirmDowngrade}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Switch to Basic?</DialogTitle>
            <DialogDescription>
              You keep your data, but sends cap at 15/month and the EPK generator, follow-up reminders,
              saved lists, export and analytics switch off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost-paper" onClick={() => setConfirmDowngrade(false)}>Stay on Pro</Button>
            <Button variant="destructive" onClick={() => { updateUser({ plan: 'basic' }); setConfirmDowngrade(false); toast('Switched to Basic'); }}>
              Switch to Basic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
