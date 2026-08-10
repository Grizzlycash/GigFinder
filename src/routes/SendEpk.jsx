import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Send, RefreshCw, Pencil, Lock, AlertTriangle } from 'lucide-react';
import {
  activeVenues, venueById, myEpks, defaultEpk, epkById, currentUser, state,
  recordSend, outreachForVenue, sendsRemaining, plan, isPro, normaliseEpk,
} from '@/store/store';
import AppShell from '@/components/AppShell';
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONES = [
  { id: 'straight', label: 'Straight up' },
  { id: 'warm', label: 'Warm' },
  { id: 'short', label: 'Short' },
];

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

export function fillTemplate(template, { user, venue }) {
  return String(template)
    .replaceAll('{artist}', user.artistName || 'Artist')
    .replaceAll('{venue}', venue?.name || 'your venue')
    .replaceAll('{city}', venue?.city || '');
}

/**
 * Builds the booking email from the selected EPK. Deterministic and local — the tone
 * presets swap the framing around the artist's own short bio rather than rewriting it.
 */
export function composeBody({ user, venue, epk, settings, tone = 'straight' }) {
  const music = epk?.music || {};
  const bio = epk?.shortBio || 'Add a short bio to your EPK and it will appear here.';
  const tracks = (epk?.tracks || []).filter((t) => t.url).slice(0, 2);
  const primary = music.spotify || music.bandcamp || music.soundcloud || music.appleMusic;
  const lines = [];

  lines.push(`Hi ${firstName(venue?.contactName)},`);
  lines.push('');

  if (tone === 'warm') {
    lines.push(`Big fan of what you've been putting on at ${venue?.name || 'the venue'} — it's exactly the kind of room we want to play.`);
    lines.push('');
  }
  if (tone === 'short') {
    lines.push(`${user.artistName || 'We'} would love a date at ${venue?.name || 'your venue'}.`);
    lines.push('');
  }

  lines.push(bio);
  lines.push('');

  if (tracks.length) tracks.forEach((t) => lines.push(`${t.title || 'Listen'}: ${t.url}`));
  else if (primary) lines.push(`Listen: ${primary}`);
  if (music.youtube && tone !== 'short') lines.push(`Live video: ${music.youtube}`);

  if (tone !== 'short') {
    lines.push('');
    lines.push(`We'd love to be considered for a date at ${venue?.name || 'your venue'}${
      user.drawSize ? `. We usually pull ${user.drawSize.toLowerCase()} in-market` : ''
    }. Full EPK, photos and press are attached.`);
  }

  lines.push('');
  lines.push(tone === 'warm' ? 'Thanks so much for your time,' : 'Thanks for your time,');
  lines.push(user.realName || user.artistName || '');
  if (settings.signature) lines.push(settings.signature);
  return lines.join('\n');
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

  const [tone, setTone] = useState('straight');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState('');

  // Regenerate whenever the venue, kit or tone changes — the draft is derived, not typed.
  useEffect(() => {
    if (!venue || !epk) return;
    setSubject(fillTemplate(state.settings.defaultSubject, { user, venue }));
    setBody(composeBody({ user, venue, epk, settings: state.settings, tone }));
    setTo(venue.contactEmail || '');
  }, [venueId, epkId, tone]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function submit(e) {
    e.preventDefault();
    recordSend({ venueId: venue.id, epkId, to: to.trim(), subject: subject.trim(), body });
    toast.success(`Sent to ${venue.name}`, { description: 'Tracked in your outreach.' });
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
            <p className="mt-3 flex items-start gap-2 border-l-2 border-stamp-emailed bg-stamp-emailed/10 px-3 py-2 text-[0.78rem] text-paper-ink">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-stamp-emailed" />
              You already contacted {venue.name} {relTime(prior.sentAt)} — currently{' '}
              <Stamp status={prior.status} seed={prior.id} className="mx-1 -my-0.5" />. Sending again logs a second entry.
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
          sub="Generated from your EPK short bio. Edit freely — this send keeps its own copy."
          aside={
            <Button
              type="button"
              variant="ghost-paper"
              size="sm"
              onClick={() => {
                setBody(composeBody({ user, venue, epk, settings: state.settings, tone }));
                toast('Draft rebuilt from your EPK');
              }}
              data-reset
            >
              <RefreshCw className="size-3.5" /> Rebuild
            </Button>
          }
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="eyebrow text-paper-muted">Tone</span>
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                aria-pressed={tone === t.id}
                className={cn(
                  'rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
                  tone === t.id ? 'border-flash-red bg-flash-red text-[#fbf7ec]' : 'border-paper-line text-paper-muted hover:bg-paper-shade',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea name="body" required rows={16} value={body} onChange={(e) => setBody(e.target.value)} data-body className="font-sans" />
          <p className="mt-2 text-[0.72rem] text-paper-muted">
            Drafted on your device from your own bio — no text is sent anywhere until you hit send.
          </p>
        </Step>

        <Step n={6} title="What's attached" sub="What the venue receives with your message.">
          <div className="flex items-center gap-3 rounded-[3px] border border-paper-line bg-paper-shade/70 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display uppercase tracking-[0.06em] text-[0.85rem] text-paper-ink">{epk?.title}</p>
              <p className="truncate text-[0.75rem] text-paper-muted">
                {(epk?.photos || []).length} photo(s) · {(epk?.tracks || []).length} track(s) · {(epk?.pressQuotes || []).length} quote(s)
                {epk?.uploadedFile ? ` · ${epk.uploadedFile.name}` : ''}
              </p>
            </div>
            <Button variant="paper" size="sm" asChild>
              <Link to={`/epk/${epk?.id}`}><Pencil className="size-3.5" /> Edit</Link>
            </Button>
          </div>
        </Step>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={() => navigate('/venues')}>Cancel</Button>
          <Button type="submit" size="lg"><Send className="size-4" /> Send it</Button>
        </div>
      </form>
    </AppShell>
  );
}
