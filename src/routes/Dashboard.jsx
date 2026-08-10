import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Send, Clock, ArrowRight, FileText } from 'lucide-react';
import {
  currentUser, myOutreach, outreachStats, activeVenues, venueById, dueFollowUps,
  sendsRemaining, plan, isPro, can, defaultEpk, epkProgress, loadDemoOutreach,
} from '@/store/store';
import AppShell from '@/components/AppShell';
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fmtDate, relTime } from '@/lib/format';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function Tile({ label, value, foot, accent }) {
  return (
    <div className="rounded-[3px] border border-ink-line bg-ink-raised px-4 py-3.5" data-tile={label}>
      <p className="eyebrow text-bone-muted/80">{label}</p>
      <p className="mt-1.5 font-display text-3xl leading-none" data-tile-value style={{ color: accent || 'var(--color-bone)' }}>{value}</p>
      {foot && <p className="mt-1.5 text-[0.72rem] text-bone-muted">{foot}</p>}
    </div>
  );
}

export default function Dashboard() {
  const user = currentUser();
  const stats = outreachStats();
  const mine = myOutreach();
  const epk = defaultEpk();
  const progress = epkProgress(epk);
  const remaining = sendsRemaining();
  const venues = activeVenues();
  const contacted = new Set(mine.map((o) => o.venueId));
  const booked = mine.filter((o) => o.status === 'booked');
  const follows = dueFollowUps();
  const recent = [...mine].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);
  const upcoming = mine
    .filter((o) => o.followUpAt && ['emailed', 'opened'].includes(o.status))
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt))
    .slice(0, 4);
  const coverage = venues.length ? (contacted.size / venues.length) * 100 : 0;

  const needsEpk = !epk || !progress.done.bio || (can('epkGenerator') && progress.count < progress.total);
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AppShell
      title={`${greeting()}, ${(user.realName || '').trim().split(/\s+/)[0] || user.artistName}`}
      subtitle={`${today}${follows.length ? ` · ${follows.length} follow-up${follows.length === 1 ? '' : 's'} due` : ''}`}
    >
      {needsEpk && (
        <Card className="mb-4 border-l-[3px] border-l-flash-red">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <FileText className="size-5 shrink-0 text-flash-red" />
            <div className="min-w-0 flex-1">
              <p className="font-display uppercase tracking-[0.06em] text-[0.9rem] text-paper-ink">
                {epk ? "Your EPK isn't finished" : 'Your EPK isn\'t set up yet'}
              </p>
              <p className="text-[0.78rem] text-paper-muted">
                {!epk
                  ? 'Add your bio, photos and links before you start sending.'
                  : can('epkGenerator')
                    ? `${progress.count} of ${progress.total} sections done — venues see whatever is filled in.`
                    : 'Add a short bio — it becomes the body of every booking email.'}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to={epk ? `/epk/${epk.id}` : '/epk'}>{epk ? 'Finish it' : 'Set it up'}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Emails sent" value={stats.sent} foot="all time" />
        <Tile
          label="Sends left"
          value={remaining === Infinity ? '∞' : remaining}
          foot={remaining === Infinity ? 'Pro · unlimited' : `Basic · ${plan().limits.sendsPerMonth}/month`}
          accent={remaining !== Infinity && remaining <= 3 ? 'var(--color-stamp-emailed)' : undefined}
        />
        <Tile label="Rooms contacted" value={contacted.size} foot={`of ${venues.length} on the list`} />
        <Tile
          label="Shows booked"
          value={booked.length}
          accent={booked.length ? 'var(--color-flash-green)' : undefined}
          foot={booked.length ? booked.slice(0, 2).map((o) => venueById(o.venueId)?.name).filter(Boolean).join(', ') : 'keep pitching'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Recent outreach</CardTitle>
            <Link to="/outreach" className="font-display uppercase tracking-[0.08em] text-[0.7rem] text-flash-red hover:underline">
              View all
            </Link>
          </CardHeader>
          {recent.length ? (
            <ul>
              {recent.map((o) => {
                const v = venueById(o.venueId);
                return (
                  <li key={o.id} className="border-b border-dashed border-paper-line last:border-0">
                    <Link to={`/venues/${o.venueId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper-shade/70">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display uppercase tracking-[0.04em] text-[0.9rem] text-paper-ink">{v?.name}</span>
                        <span className="block truncate text-[0.72rem] text-paper-muted">{v?.city} · Cap. {v?.capacity} · {relTime(o.updatedAt)}</span>
                      </span>
                      <Stamp status={o.status} seed={o.id} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <CardContent className="py-10 text-center">
              <p className="text-[0.85rem] text-paper-muted">Nothing sent yet — pick a room and draft your first email.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button asChild size="sm"><Link to="/venues"><Send className="size-4" /> Browse rooms</Link></Button>
                <Button variant="paper" size="sm" onClick={() => { loadDemoOutreach(); toast.success('Sample pipeline loaded'); }} data-demo>
                  Load sample
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
              {!isPro() && <span className="stamp" style={{ color: 'var(--color-stamp-none)', borderColor: 'var(--color-stamp-none)' }}>Pro</span>}
            </CardHeader>
            {!isPro() ? (
              <CardContent>
                <p className="text-[0.8rem] text-paper-muted">
                  Pro nudges you when a room has gone quiet, so a warm lead never goes cold.{' '}
                  <Link to="/pricing" className="text-flash-red hover:underline">Compare plans</Link>
                </p>
              </CardContent>
            ) : upcoming.length ? (
              <ul>
                {upcoming.map((o) => {
                  const v = venueById(o.venueId);
                  const overdue = new Date(o.followUpAt) <= new Date();
                  return (
                    <li key={o.id} className="flex items-center gap-2.5 border-b border-dashed border-paper-line px-4 py-2.5 last:border-0">
                      <Clock className={overdue ? 'size-3.5 shrink-0 text-flash-red' : 'size-3.5 shrink-0 text-paper-muted'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.82rem] text-paper-ink">{v?.name}</span>
                        <span className="block text-[0.7rem] text-paper-muted">{overdue ? 'Due now' : fmtDate(o.followUpAt)}</span>
                      </span>
                      <Button variant="ghost-paper" size="sm" asChild>
                        <Link to={`/send?venue=${o.venueId}`}>Nudge <ArrowRight className="size-3.5" /></Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <CardContent><p className="text-[0.8rem] text-paper-muted">Nothing due — everything's inside the reminder window.</p></CardContent>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>List coverage</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between text-[0.8rem]">
                <span className="text-paper-muted">Rooms contacted</span>
                <span className="font-display text-base text-paper-ink">{contacted.size} / {venues.length}</span>
              </div>
              <Progress value={Math.max(1, Math.round(coverage))} className="mt-2" />
              <p className="mt-2 text-[0.72rem] text-paper-muted">{(100 - coverage).toFixed(1)}% of the list is still untouched.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <Link to="/outreach" className="font-display uppercase tracking-[0.08em] text-[0.7rem] text-flash-red hover:underline">Tracker</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ['replied', stats.replied],
                ['emailed', mine.filter((o) => ['emailed', 'opened'].includes(o.status)).length],
                ['declined', stats.declined],
              ].map(([status, n]) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <Stamp status={status} seed={status} />
                  <span className="font-display text-base text-paper-ink">{n}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-dashed border-paper-line pt-2 text-[0.8rem]">
                <span className="text-paper-muted">Reply rate</span>
                <span className="font-display text-base text-paper-ink">{stats.replyRate}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
