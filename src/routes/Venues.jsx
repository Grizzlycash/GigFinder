import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Plus, Download, Star, Map as MapIcon, Mail, ExternalLink, X, AlertTriangle } from 'lucide-react';
import {
  activeVenues, venueById, outreachForVenue, myOutreach, STATUSES, setOutreachStatus,
  updateOutreach, isPro, myLists, createList, toggleListVenue, can, addVenue, myPrivateVenues,
  mySubmissions, dismissSubmission, findDuplicateVenue,
} from '@/store/store';
import { VENUE_TYPES, ALL_GENRES } from '@/data/venues';
import AppShell from '@/components/AppShell';
import VenueCard from '@/components/VenueCard';
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { fmtDateTime, plural, toCsv, download, initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const SIZES = [
  { id: 'small', label: 'Small <150' },
  { id: 'mid', label: 'Mid 150–400' },
  { id: 'large', label: 'Large 400+' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'none', label: 'Not contacted' },
  { id: 'emailed', label: 'Emailed' },
  { id: 'followup', label: 'Follow-up due' },
  { id: 'replied', label: 'Replied' },
  { id: 'booked', label: 'Booked' },
];

function FilterChip({ active, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem] transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
        active
          ? 'border-flash-red bg-flash-red text-[#fbf7ec]'
          : 'border-ink-line-strong text-bone-muted hover:bg-ink-hover hover:text-bone',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function AddVenueDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [visibility, setVisibility] = useState('private');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');

  // Checked as they type, so nobody submits a room that's already in the database
  // and waits a week to be told so.
  const duplicate = findDuplicateVenue({ name, city });

  function submit(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!String(d.name || '').trim() || !String(d.city || '').trim()) {
      toast.error('Name and suburb are required');
      return;
    }
    const venue = addVenue({
      name: String(d.name).trim(),
      city: String(d.city).trim(),
      state: 'VIC',
      capacity: Number(d.capacity) || 0,
      type: String(d.type || 'Pub'),
      contactName: String(d.contactName || '').trim(),
      contactEmail: String(d.contactEmail || '').trim(),
      genres: String(d.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
      notes: String(d.notes || '').trim(),
    }, visibility);
    onOpenChange(false);
    setName('');
    setCity('');
    if (visibility === 'shared') {
      toast.success('Sent for review', { description: 'The GigFinder team will check it before it goes live for everyone.' });
    } else {
      toast.success('Private venue added');
      navigate(`/venues/${venue.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a venue</DialogTitle>
          <DialogDescription>Keep it to yourself, or send it to the shared database for review.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="av-name">Venue name</Label>
            <Input id="av-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-city">Suburb</Label>
            <Input id="av-city" name="city" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-cap">Capacity</Label>
            <Input id="av-cap" name="capacity" type="number" min="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-type">Type</Label>
            <Select name="type" defaultValue="Pub">
              <SelectTrigger id="av-type"><SelectValue /></SelectTrigger>
              <SelectContent>{VENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-contact">Booking contact</Label>
            <Input id="av-contact" name="contactName" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="av-email">Booking email</Label>
            <Input id="av-email" name="contactEmail" type="email" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="av-genres">Genres</Label>
            <Input id="av-genres" name="genres" placeholder="Indie, Punk" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="av-notes">Notes</Label>
            <Textarea id="av-notes" name="notes" rows={2} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Where should it live?</Label>
            <RadioGroup value={visibility} onValueChange={setVisibility}>
              <label className="flex items-start gap-2 text-[0.82rem]">
                <RadioGroupItem value="private" id="vis-private" className="mt-0.5" />
                <span>
                  Private — only you see it
                  <span className="block text-[0.72rem] text-paper-muted">Live straight away, and it never leaves your account.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-[0.82rem]">
                <RadioGroupItem value="shared" id="vis-shared" className="mt-0.5" />
                <span>
                  Submit to the shared database
                  <span className="block text-[0.72rem] text-paper-muted">
                    A GigFinder admin checks it before every subscriber sees it. You&apos;ll see the outcome under
                    &ldquo;Your submissions&rdquo;.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          {duplicate && (
            <p
              data-duplicate
              className="sm:col-span-2 flex gap-2 rounded-[3px] border border-stamp-emailed/50 bg-stamp-emailed/10 px-3 py-2 text-[0.78rem] text-paper-ink"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stamp-emailed" />
              <span>
                <strong className="font-semibold">{duplicate.name}</strong> in {duplicate.city} is already in the
                database. Submitting it again will most likely be declined as a duplicate.
              </span>
            </p>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost-paper" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" data-add-save>
              {visibility === 'shared' ? 'Send for review' : 'Add venue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What happened to the venues this artist sent in. Submitted rooms are held out of the
 * shared list until an admin approves them, so without this panel they'd simply vanish
 * on submit — and a declined one would vanish without a reason.
 */
function YourSubmissions() {
  const rows = mySubmissions();
  if (!rows.length) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Your submissions</CardTitle>
        <span className="text-[0.72rem] text-paper-muted">{plural(rows.length, 'room')} awaiting or reviewed</span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((v) => (
          <div
            key={v.id}
            data-submission={v.status}
            className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-dashed border-paper-line pb-2.5 last:border-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display uppercase tracking-[0.04em] text-[0.9rem] leading-tight">{v.name}</p>
              <p className="text-[0.74rem] text-paper-muted">
                {v.city} · sent {fmtDateTime(v.addedAt)}
              </p>
              {v.status === 'pending' && (
                <p className="mt-1 text-[0.76rem] text-paper-muted">
                  With the GigFinder team. It goes live for everyone once it&apos;s approved.
                </p>
              )}
              {v.status === 'rejected' && (
                <p className="mt-1 text-[0.76rem] text-paper-ink">
                  {v.review?.reason || 'Declined without a reason given.'}
                </p>
              )}
            </div>
            <Stamp status={v.status === 'rejected' ? 'rejected' : 'pending'} seed={v.id} />
            {v.status === 'rejected' && (
              <Button
                variant="ghost-paper"
                size="icon-sm"
                aria-label={`Dismiss ${v.name}`}
                data-dismiss
                onClick={() => { dismissSubmission(v.id); toast('Cleared'); }}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SaveToListDialog({ venue, open, onOpenChange }) {
  const lists = myLists();
  const [name, setName] = useState('');
  if (!venue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save to list</DialogTitle>
          <DialogDescription>{venue.name}</DialogDescription>
        </DialogHeader>
        {lists.length > 0 && (
          <div className="space-y-2">
            {lists.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-[0.85rem]">
                <Checkbox
                  defaultChecked={l.venueIds.includes(venue.id)}
                  onCheckedChange={() => toggleListVenue(l.id, venue.id)}
                />
                <span>{l.name} <span className="text-paper-muted">({l.venueIds.length})</span></span>
              </label>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="new-list">{lists.length ? 'Or create a new list' : 'Create your first list'}</Label>
          <Input id="new-list" value={name} onChange={(e) => setName(e.target.value)} placeholder="Regional run — October" />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (name.trim()) toggleListVenue(createList(name.trim()).id, venue.id);
              onOpenChange(false);
              toast.success('Saved');
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailPanel({ venue, onSaveToList }) {
  if (!venue) {
    return (
      <Card className="bg-paper-shade/60">
        <CardContent className="py-10 text-center">
          <p className="font-display uppercase tracking-[0.1em] text-paper-muted">Pick a room</p>
          <p className="mt-1 text-[0.8rem] text-paper-muted">Select a venue to see the booking contact and your history with it.</p>
        </CardContent>
      </Card>
    );
  }

  const outreach = outreachForVenue(venue.id);
  const history = myOutreach()
    .filter((o) => o.venueId === venue.id)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <h2 className="text-xl leading-tight">{venue.name}</h2>
          <p className="mt-1 text-[0.8rem] text-paper-muted">
            {venue.city}, {venue.state} · Cap. {venue.capacity || '—'} · {venue.type}
          </p>
          <div className="mt-2.5">
            <Stamp status={outreach?.status || 'none'} seed={venue.id} size="lg" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.genres.map((g) => (
              <span key={g} className="rounded-[2px] border border-paper-line px-2 py-0.5 font-display uppercase tracking-[0.08em] text-[0.65rem] text-paper-muted">
                {g}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to={`/send?venue=${venue.id}`}><Mail className="size-4" /> Draft booking email</Link>
            </Button>
            {isPro() && (
              <Button variant="paper" size="sm" onClick={onSaveToList} data-save-list>
                <Star className="size-4" /> Save to list
              </Button>
            )}
            {(venue.lat || venue.lng) && (
              <Button variant="paper" size="sm" asChild>
                <Link to={`/map?venue=${venue.id}`}><MapIcon className="size-4" /> Map</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Booking contact</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper-shade font-display text-[0.7rem] text-paper-muted">
              {initials(venue.contactName || venue.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.85rem] font-semibold text-paper-ink">{venue.contactName || 'Booking desk'}</p>
              <a href={`mailto:${venue.contactEmail}`} className="block truncate text-[0.78rem] text-flash-red hover:underline">
                {venue.contactEmail || '—'}
              </a>
            </div>
          </div>
          <dl className="space-y-1 border-t border-dashed border-paper-line pt-3 text-[0.8rem]">
            {[
              ['Pay', venue.payType],
              ['Submit via', venue.submissionMethod],
              ['Website', venue.website],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="text-paper-muted">{k}</dt>
                <dd className="truncate text-right text-paper-ink">
                  {k === 'Website' && v ? (
                    <a href={v} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-flash-red hover:underline">
                      {String(v).replace(/^https?:\/\//, '')} <ExternalLink className="size-3" />
                    </a>
                  ) : (v || '—')}
                </dd>
              </div>
            ))}
          </dl>
          {venue.notes && <p className="border-t border-dashed border-paper-line pt-3 text-[0.8rem] leading-relaxed text-paper-muted">{venue.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {outreach ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="vd-status">Status</Label>
                <Select value={outreach.status} onValueChange={(v) => { setOutreachStatus(outreach.id, v); toast.success('Status updated'); }}>
                  <SelectTrigger id="vd-status" data-status><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vd-notes">Private notes</Label>
                <Textarea
                  id="vd-notes"
                  rows={2}
                  defaultValue={outreach.notes || ''}
                  onBlur={(e) => { updateOutreach(outreach.id, { notes: e.target.value }); toast('Notes saved'); }}
                  placeholder="Dates offered, who to chase…"
                />
              </div>
              <ol className="space-y-2 border-t border-dashed border-paper-line pt-3">
                {history.flatMap((o) => o.history.map((h, i) => (
                  <li key={`${o.id}-${i}`} className="flex gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-flash-red" />
                    <span>
                      <span className="block text-[0.8rem] text-paper-ink">{h.label}</span>
                      <span className="block text-[0.7rem] text-paper-muted">{fmtDateTime(h.at)}</span>
                    </span>
                  </li>
                )))}
              </ol>
            </>
          ) : (
            <p className="text-[0.82rem] text-paper-muted">
              Not contacted yet. Drafting an email starts the history here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Venues() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [genre, setGenre] = useState(null);
  const [size, setSize] = useState(null);
  const [sort, setSort] = useState('name');
  const [allGenres, setAllGenres] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = activeVenues().filter((v) => {
      if (term && ![v.name, v.city, v.type, v.contactName, v.genres.join(' ')].join(' ').toLowerCase().includes(term)) return false;

      const out = outreachForVenue(v.id);
      if (status === 'none' && out) return false;
      if (status === 'emailed' && !(out && ['emailed', 'opened'].includes(out.status))) return false;
      if (status === 'replied' && out?.status !== 'replied') return false;
      if (status === 'booked' && out?.status !== 'booked') return false;
      if (status === 'followup') {
        const due = out?.followUpAt && new Date(out.followUpAt) <= new Date() && ['emailed', 'opened'].includes(out.status);
        if (!due) return false;
      }

      if (genre && !v.genres.includes(genre)) return false;
      if (size === 'small' && v.capacity >= 150) return false;
      if (size === 'mid' && (v.capacity < 150 || v.capacity >= 400)) return false;
      if (size === 'large' && v.capacity < 400) return false;
      return true;
    });

    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name),
      suburb: (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name),
      capDesc: (a, b) => b.capacity - a.capacity,
      capAsc: (a, b) => a.capacity - b.capacity,
    };
    return list.sort(sorters[sort]);
  }, [q, status, genre, size, sort]);

  const selected = venueById(id) || rows[0] || null;
  const privateCount = myPrivateVenues().length;

  function exportCsv() {
    if (!can('csvExport')) { toast('CSV export is a Pro feature'); navigate('/pricing'); return; }
    const head = ['Name', 'Suburb', 'Capacity', 'Type', 'Genres', 'Contact', 'Email', 'Website'];
    download('gigfinder-venues.csv', toCsv([head, ...rows.map((v) => [v.name, v.city, v.capacity, v.type, v.genres.join('; '), v.contactName, v.contactEmail, v.website])]));
    toast.success(`Exported ${rows.length} venues`);
  }

  return (
    <AppShell
      title="Venues"
      subtitle={`${plural(rows.length, 'room')}${privateCount ? ` · ${privateCount} private` : ''}`}
      actions={
        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)} data-add className="hidden sm:inline-flex">
          <Plus className="size-4" /> Add venue
        </Button>
      }
    >
      {/* ---- Filters ---- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bone-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-q
              placeholder="Search rooms, suburbs, genres…"
              className="border-ink-line-strong bg-ink-raised pl-8 text-bone placeholder:text-bone-muted/70"
            />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-auto min-w-36 border-ink-line-strong bg-ink-raised text-bone" data-sort>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="suburb">Sort: Suburb</SelectItem>
              <SelectItem value="capDesc">Sort: Biggest room</SelectItem>
              <SelectItem value="capAsc">Sort: Smallest room</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" size="icon" onClick={exportCsv} aria-label="Export CSV" data-export>
            <Download className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setAddOpen(true)} aria-label="Add venue" className="sm:hidden">
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 text-bone-muted/70">Status</span>
          {STATUS_FILTERS.map((s) => (
            <FilterChip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)} data-filter="status" data-value={s.id}>
              {s.label}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-ink-line-strong" />
          <span className="eyebrow mr-1 text-bone-muted/70">Size</span>
          {SIZES.map((s) => (
            <FilterChip key={s.id} active={size === s.id} onClick={() => setSize(size === s.id ? null : s.id)} data-filter="size" data-value={s.id}>
              {s.label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 text-bone-muted/70">Genre</span>
          {(allGenres ? ALL_GENRES : ALL_GENRES.slice(0, 8)).map((g) => (
            <FilterChip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)} data-filter="genre" data-value={g}>
              {g}
            </FilterChip>
          ))}
          {ALL_GENRES.length > 8 && (
            <button
              type="button"
              onClick={() => setAllGenres((v) => !v)}
              className="shrink-0 px-1.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem] text-flash-red hover:underline focus-visible:outline-2 focus-visible:outline-flash-red"
            >
              {allGenres ? 'Fewer' : `+${ALL_GENRES.length - 8} more`}
            </button>
          )}
        </div>
      </div>

      {/* ---- Flash sheet + detail ---- */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start">
        <div className="space-y-2">
          <YourSubmissions />
          {rows.length ? (
            rows.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                selected={selected?.id === v.id}
                onSelect={(venue) => navigate(`/venues/${venue.id}`)}
              />
            ))
          ) : (
            <Card className="bg-paper-shade/60">
              <CardContent className="py-10 text-center">
                <p className="font-display uppercase tracking-[0.1em] text-paper-muted">Nothing matches</p>
                <Button
                  variant="paper"
                  size="sm"
                  className="mt-3"
                  onClick={() => { setQ(''); setStatus('all'); setGenre(null); setSize(null); }}
                  data-clear
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="xl:sticky xl:top-20 order-first xl:order-none">
          <DetailPanel venue={selected} onSaveToList={() => setListOpen(true)} />
        </div>
      </div>

      <AddVenueDialog open={addOpen} onOpenChange={setAddOpen} />
      <SaveToListDialog venue={selected} open={listOpen} onOpenChange={setListOpen} />
    </AppShell>
  );
}
