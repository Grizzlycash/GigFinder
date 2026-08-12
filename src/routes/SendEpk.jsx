import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Send, RefreshCw, Pencil, Lock, AlertTriangle, Sparkles, ShieldCheck, Loader2, FileText,
} from 'lucide-react';
import {
  activeVenues, venueById, myEpks, defaultEpk, epkById, currentUser, state,
  recordSend, outreachForVenue, sendsRemaining, plan, isPro, normaliseEpk, can,
} from '@/store/store';
import {
  TONES, REWRITES, buildPayload, draftEmail, redactContact, applyContact,
  previewTransmission, hasDraftProvider,
} from '@/lib/draft';
import { PROTOTYPE } from '@/config';
import { printableSections, documentFilename } from '@/lib/epkDocument';
import AppShell from '@/components/AppShell';
import { PressKitActions, PressKitEditor, usePressKit } from '@/components/PressKit';
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { relTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function fillTemplate(template, { user, venue }) {
  return String(template)
    .replaceAll('{artist}', user.artistName || 'Artist')
    .replaceAll('{venue}', venue?.name || 'your venue')
    .replaceAll('{city}', venue?.city || '');
}

function Step({ n, title, sub, aside, children }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-[2px] bg-flash-red font-display text-[0.75rem] text-[#fbf7ec]">
            {n}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.95rem] leading-tight">{title}</h2>
            {sub && <p className="mt-0.5 text-[0.76rem] text-paper-muted">{sub}</p>}
          </div>
          {aside}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ChipButton({ active, disabled, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem] transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
        'disabled:cursor-not-allowed disabled:opacity-45',
        active ? 'border-flash-red bg-flash-red text-[#fbf7ec]' : 'border-paper-line text-paper-muted hover:bg-paper-shade',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default function SendEpk() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = currentUser();
  const epks = myEpks();
  const venues = activeVenues();

  const venueId = params.get('venue') || venues[0]?.id || '';
  const epkId = params.get('epk') || defaultEpk()?.id || '';
  const venue = venueById(venueId);
  const epk = useMemo(() => normaliseEpk(epkById(epkId)), [epkId]);

  const remaining = sendsRemaining();
  const prior = venue ? outreachForVenue(venue.id) : null;
  const canRewrite = can('aiRewrite');

  const [tone, setTone] = useState('straight');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(null);
  const [disclosure, setDisclosure] = useState(false);
  const [editingKit, setEditingKit] = useState(false);

  const kit = usePressKit(epk);
  const kitFilename = documentFilename(kit.document);

  const payload = useMemo(
    () => (venue && epk ? buildPayload({ user, venue, epk }) : null),
    [venueId, epkId, user, venue, epk],
  );

  // The draft is derived from the venue, the kit and the tone — not typed from scratch.
  useEffect(() => {
    if (!venue || !epk || !payload) return;
    let cancelled = false;
    setSubject(fillTemplate(state.settings.defaultSubject, { user, venue }));
    setTo(venue.contactEmail || '');
    draftEmail({ payload, tone }).then(({ text }) => {
      if (cancelled) return;
      setBody(applyContact(text, venue.contactName));
    });
    return () => { cancelled = true; };
  }, [venueId, epkId, tone]); // eslint-disable-line react-hooks/exhaustive-deps

  async function rewrite(action) {
    if (!canRewrite) { toast('Rewrites are a Pro feature'); navigate('/pricing'); return; }
    setBusy(action);
    try {
      // Strip the contact's name back out before the text goes anywhere.
      const redacted = redactContact(body, venue.contactName);
      const { text, source: from } = await draftEmail({ payload, action, text: redacted });
      setBody(applyContact(text, venue.contactName));
      if (from === 'local' && hasDraftProvider()) toast('Model unavailable — rewrote on-device instead');
    } catch {
      toast.error("Couldn't rewrite that draft");
    } finally {
      setBusy(null);
    }
  }

  if (!epks.length) {
    return (
      <AppShell title="Draft an email" subtitle="You need an EPK first">
        <Card className="mx-auto max-w-lg">
          <CardContent className="py-10 text-center">
            <h2 className="text-xl">You need an EPK first</h2>
            <p className="mx-auto mt-2 max-w-sm text-[0.85rem] text-paper-muted">
              The email is written from an EPK's short bio, so there's nothing to draft from yet.
            </p>
            <Button asChild className="mt-4"><Link to="/epk">Create my EPK</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (remaining === 0) {
    return (
      <AppShell title="Draft an email" subtitle="Monthly sends used up">
        <Card className="mx-auto max-w-lg">
          <CardContent className="py-10 text-center">
            <Lock className="mx-auto size-6 text-flash-red" />
            <h2 className="mt-3 text-xl">That's all {plan().limits.sendsPerMonth} sends this month</h2>
            <p className="mx-auto mt-2 max-w-sm text-[0.85rem] text-paper-muted">
              Basic resets on your billing date. Pro removes the cap and adds follow-up reminders.
            </p>
            <Button asChild className="mt-4"><Link to="/pricing">See Pro</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy('send');

    // Build the kit for real before recording the send, so the page count on the record is
    // the document's, not an estimate — and so a kit that can't be built is found now
    // rather than by the booker. A failure here still sends: losing the outreach record
    // over a PDF would be the worse trade.
    let attachment = null;
    if (can('epkGenerator')) {
      try {
        const { filename, pages } = await kit.build();
        attachment = { kind: 'pdf', filename, pages, document: kit.document };
      } catch {
        attachment = { kind: 'pdf', filename: kitFilename, pages: kit.pages, document: kit.document };
        toast('Attached the press kit, but the PDF needs rebuilding');
      }
    } else if (epk?.uploadedFile) {
      attachment = { kind: 'file', filename: epk.uploadedFile.name, size: epk.uploadedFile.size };
    }

    recordSend({ venueId: venue.id, epkId, to: to.trim(), subject: subject.trim(), body, attachment });
    setBusy(null);
    toast.success(`Sent to ${venue.name}`, {
      description: attachment ? `${attachment.filename} attached · tracked in your outreach.` : 'Tracked in your outreach.',
    });
    navigate('/outreach');
  }

  return (
    <AppShell
      title="Draft the booking email"
      subtitle={remaining === Infinity ? 'Unlimited sends on Pro' : `${remaining} send${remaining === 1 ? '' : 's'} left this month`}
    >
      <form onSubmit={submit} data-send className="mx-auto max-w-2xl space-y-3">
        <Step n={1} title="Which room?" sub="Pick from your venue list.">
          <Select value={venueId} onValueChange={(v) => setParams({ venue: v, epk: epkId })}>
            <SelectTrigger data-venue><SelectValue /></SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name} — {v.city} (cap {v.capacity})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {prior && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 border-l-2 border-stamp-emailed bg-stamp-emailed/10 px-3 py-2 text-[0.78rem] text-paper-ink">
              <AlertTriangle className="size-3.5 shrink-0 text-stamp-emailed" />
              You already contacted {venue.name} {relTime(prior.sentAt)} — currently
              <Stamp status={prior.status} seed={prior.id} />. Sending again logs a second entry.
            </p>
          )}
        </Step>

        <Step n={2} title="Booking contact" sub="From the venue record — edit if you have a better address.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Contact</Label>
              <Input id="s-name" value={venue?.contactName || ''} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-to">Send to</Label>
              <Input id="s-to" type="email" required value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {venue?.notes && <p className="mt-2 text-[0.75rem] text-paper-muted">{venue.notes}</p>}
        </Step>

        <Step n={3} title="Which EPK?" sub="The email body is written from this kit's short bio.">
          <Select value={epkId} onValueChange={(v) => setParams({ venue: venueId, epk: v })}>
            <SelectTrigger data-epk><SelectValue /></SelectTrigger>
            <SelectContent>
              {epks.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}{e.isDefault ? ' (default)' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          {epks.length === 1 && !isPro() && (
            <p className="mt-2 text-[0.75rem] text-paper-muted">Pro lets you keep a different kit per project.</p>
          )}
        </Step>

        <Step n={4} title="Subject line" sub="Kept short — bookers scan on a phone.">
          <Input name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Step>

        <Step
          n={5}
          title="The message"
          sub="Built from your EPK short bio. Edit freely — this send keeps its own copy."
          aside={
            <Button
              type="button"
              variant="ghost-paper"
              size="sm"
              disabled={Boolean(busy)}
              onClick={() => draftEmail({ payload, tone }).then(({ text }) => {
                setBody(applyContact(text, venue.contactName));
                toast('Draft rebuilt from your EPK');
              })}
              data-reset
            >
              <RefreshCw className="size-3.5" /> Rebuild
            </Button>
          }
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="eyebrow text-paper-muted">Tone</span>
            {TONES.map((t) => (
              <ChipButton key={t.id} active={tone === t.id} disabled={Boolean(busy)} onClick={() => setTone(t.id)}>
                {t.label}
              </ChipButton>
            ))}
          </div>

          <Textarea name="body" required rows={16} value={body} onChange={(e) => setBody(e.target.value)} data-body />

          {/* ---- Rewrites ---- */}
          <div className="mt-3 rounded-[3px] border border-paper-line bg-paper-shade/60 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow flex items-center gap-1.5 text-paper-muted">
                <Sparkles className="size-3.5" /> Rewrite
              </span>
              {REWRITES.map((r) => (
                <ChipButton
                  key={r.id}
                  title={r.hint}
                  disabled={Boolean(busy) || !canRewrite}
                  onClick={() => rewrite(r.id)}
                  data-rewrite={r.id}
                >
                  {busy === r.id ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
                  {r.label}
                </ChipButton>
              ))}
              {!canRewrite && (
                <Link to="/pricing" className="font-display uppercase tracking-[0.08em] text-[0.68rem] text-flash-red hover:underline">
                  Pro
                </Link>
              )}
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-1 text-[0.72rem] text-paper-muted">
              <ShieldCheck className="size-3.5 shrink-0 text-flash-green" />
              {hasDraftProvider()
                ? 'Your bio and this room\'s public details are sent to draft this. The contact\'s name and address never leave your device.'
                : 'Rewrites run on your device — nothing is sent anywhere.'}
              <button
                type="button"
                onClick={() => setDisclosure(true)}
                className="underline underline-offset-2 hover:text-flash-red focus-visible:outline-2 focus-visible:outline-flash-red"
                data-disclosure
              >
                See exactly what gets sent
              </button>
            </p>
          </div>
        </Step>

        <Step
          n={6}
          title="The press kit"
          sub="A PDF built from your EPK, attached to the email."
          aside={
            <span className="whitespace-nowrap text-[0.72rem] text-paper-muted" data-kit-pages>
              {kitFilename} · ~{kit.pages} pages
            </span>
          }
        >
          {can('epkGenerator') ? (
            <>
              <div className="flex items-start gap-3 rounded-[3px] border border-paper-line bg-paper-shade/70 p-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-flash-red" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display uppercase tracking-[0.06em] text-[0.85rem] text-paper-ink">
                    {kit.document.headline}
                  </p>
                  <p className="truncate text-[0.75rem] text-paper-muted">
                    {printableSections(kit.document).map((s) => s.title).join(' · ') || 'Nothing switched on yet'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={editingKit ? 'secondary' : 'paper'}
                  size="sm"
                  onClick={() => setEditingKit((v) => !v)}
                  data-kit-edit
                >
                  <Pencil className="size-3.5" /> {editingKit ? 'Done editing' : 'Edit'}
                </Button>
              </div>

              <PressKitActions kit={kit} epk={epk} className="mt-3" />

              {editingKit && (
                <div className="mt-3 border-t border-dashed border-paper-line pt-3">
                  <p className="mb-3 text-[0.76rem] text-paper-muted">
                    Reword it, switch sections off, or reorder them. Changes save to this EPK, and the venue is
                    sent the version you see here.
                  </p>
                  <PressKitEditor document={kit.document} epk={epk} onChange={kit.setDocument} />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[3px] border border-paper-line bg-paper-shade/70 p-3">
              <p className="text-[0.82rem] text-paper-ink">
                {epk?.uploadedFile
                  ? <>Your uploaded press kit <strong className="font-semibold">{epk.uploadedFile.name}</strong> goes out with this email.</>
                  : 'No press kit attached — this email goes out on its own.'}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] text-paper-muted">
                <Lock className="size-3.5" /> Building a PDF press kit from your EPK is part of Pro.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button type="button" variant="paper" size="sm" asChild>
                  <Link to={`/epk/${epk?.id}`}><Pencil className="size-3.5" /> Attach my own</Link>
                </Button>
                <Button type="button" size="sm" asChild><Link to="/pricing">See Pro</Link></Button>
              </div>
            </div>
          )}
        </Step>

        {PROTOTYPE && (
          <p className="flex items-start gap-2 rounded-[3px] border border-ink-line bg-ink-raised px-3 py-2.5 text-[0.78rem] text-bone-muted" data-simulated>
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stamp-emailed" />
            <span>
              <strong className="font-semibold text-bone">Nothing is actually emailed.</strong> This is a
              prototype: sending records the pitch in your pipeline so you can try the flow, but{' '}
              {venue?.name || 'the venue'} will not hear from you.
            </span>
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={() => navigate('/venues')}>Cancel</Button>
          <Button type="submit" size="lg" disabled={Boolean(busy)}>
            {busy === 'send' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy === 'send' ? 'Building the kit…' : 'Send it'}
          </Button>
        </div>
      </form>

      {/* ---- What gets sent ---- */}
      <Dialog open={disclosure} onOpenChange={setDisclosure}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>What gets sent</DialogTitle>
            <DialogDescription>
              {hasDraftProvider()
                ? 'This is the exact request a rewrite makes. Nothing else leaves your device.'
                : 'No model is connected, so nothing leaves your device at all. If one were connected, this is exactly what it would receive.'}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-[3px] border border-paper-line bg-white/60 p-3 text-[0.72rem] leading-relaxed text-paper-ink">
            {JSON.stringify(
              previewTransmission({ payload, action: 'tighten', tone, text: body, contactName: venue?.contactName }),
              null,
              2,
            )}
          </pre>
          <p className="text-[0.75rem] text-paper-muted">
            Note what's absent: the booking contact's name and email address. The draft uses a{' '}
            <code className="text-flash-red">{'{contact}'}</code> placeholder and your browser fills in the
            real name afterwards.
          </p>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
