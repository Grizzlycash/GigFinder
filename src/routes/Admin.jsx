import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Plus, Download, Upload, Check, X, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import {
  state, save, upsertVenue, deleteVenue, PLANS, planPrice, currentUser,
  pendingSubmissions, findDuplicateVenue, approveVenue, rejectVenue,
  sampleVenues, removeSampleVenues,
} from '@/store/store';
import { VENUE_TYPES, slugify } from '@/data/venues';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtDate, money, plural, toCsv, download, uid } from '@/lib/format';

const TABS = ['overview', 'venues', 'import', 'submissions', 'users'];

/* ---------- CSV ---------- */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

const FIELDS = [
  ['name', 'Venue name', true],
  ['city', 'Suburb', true],
  ['capacity', 'Capacity'],
  ['type', 'Venue type'],
  ['genres', 'Genres'],
  ['contactName', 'Booking contact'],
  ['contactEmail', 'Booking email'],
  ['website', 'Website'],
  ['lat', 'Latitude'],
  ['lng', 'Longitude'],
  ['payType', 'Pay structure'],
  ['submissionMethod', 'Submission method'],
  ['notes', 'Booking notes'],
];

const ALIASES = {
  name: ['venue', 'venuename', 'name'],
  city: ['suburb', 'city', 'town', 'location'],
  capacity: ['capacity', 'cap', 'size'],
  type: ['type', 'venuetype', 'category'],
  genres: ['genres', 'genre', 'styles'],
  contactName: ['contact', 'contactname', 'booker', 'bookingcontact'],
  contactEmail: ['email', 'contactemail', 'bookingemail'],
  website: ['website', 'url', 'site'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
  payType: ['pay', 'paytype', 'deal', 'payment'],
  submissionMethod: ['submission', 'submissionmethod', 'submitvia', 'method'],
  notes: ['notes', 'note', 'comments'],
};

function guessColumn(headers, field) {
  const norm = (t) => t.toLowerCase().replace(/[^a-z]/g, '');
  const wants = ALIASES[field] || [field.toLowerCase()];
  return headers.findIndex((h) => wants.includes(norm(h)));
}

/* ---------- Venue editor ---------- */
function VenueDialog({ venue, open, onOpenChange }) {
  if (!open) return null;
  const v = venue || {};

  function submit(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!String(d.name || '').trim()) { toast.error('Venue name is required'); return; }
    upsertVenue({
      ...v,
      id: v.id || `ven_${slugify(String(d.name))}_${uid('x').slice(-4)}`,
      name: String(d.name).trim(),
      city: String(d.city).trim(),
      state: 'VIC',
      country: 'Australia',
      capacity: Number(d.capacity) || 0,
      type: String(d.type),
      contactName: String(d.contactName || '').trim(),
      contactEmail: String(d.contactEmail || '').trim(),
      website: String(d.website || '').trim(),
      payType: String(d.payType || '').trim(),
      submissionMethod: v.submissionMethod || 'Email',
      lat: Number(d.lat) || v.lat || 0,
      lng: Number(d.lng) || v.lng || 0,
      genres: String(d.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
      notes: String(d.notes || ''),
      status: String(d.status),
      visibility: v.visibility || 'shared',
      source: v.source || 'manual',
    });
    onOpenChange(false);
    toast.success('Venue saved');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{venue ? `Edit ${venue.name}` : 'Add venue'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="v-name">Venue name</Label>
            <Input id="v-name" name="name" defaultValue={v.name} required />
          </div>
          {[['city', 'Suburb'], ['capacity', 'Capacity'], ['contactName', 'Booking contact'], ['contactEmail', 'Booking email'],
            ['website', 'Website'], ['payType', 'Pay structure'], ['lat', 'Latitude'], ['lng', 'Longitude']].map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`v-${k}`}>{label}</Label>
              <Input id={`v-${k}`} name={k} defaultValue={v[k]} type={['capacity', 'lat', 'lng'].includes(k) ? 'number' : 'text'} step="any" />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="v-type">Type</Label>
            <Select name="type" defaultValue={v.type || 'Pub'}>
              <SelectTrigger id="v-type"><SelectValue /></SelectTrigger>
              <SelectContent>{VENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-status">Status</Label>
            <Select name="status" defaultValue={v.status || 'active'}>
              <SelectTrigger id="v-status"><SelectValue /></SelectTrigger>
              <SelectContent>{['active', 'pending', 'rejected', 'archived'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="v-genres">Genres</Label>
            <Input id="v-genres" name="genres" defaultValue={(v.genres || []).join(', ')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="v-notes">Booking notes</Label>
            <Textarea id="v-notes" name="notes" rows={2} defaultValue={v.notes} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost-paper" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save venue</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tabs ---------- */
function Overview() {
  const venues = state.venues;
  const users = state.users;
  const mrr = users.reduce((sum, u) => sum + (u.onboarded ? planPrice(u.plan, u.cycle) : 0), 0);
  const bySuburb = venues.reduce((acc, v) => { acc[v.city] = (acc[v.city] || 0) + 1; return acc; }, {});
  const top = Object.entries(bySuburb).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Venues (active)', venues.filter((v) => v.status === 'active').length, `${venues.length} total rows`],
          ['Pending review', venues.filter((v) => v.status === 'pending').length, 'user submissions'],
          ['Subscribers', users.length, `${users.filter((u) => u.plan === 'pro').length} on Pro`],
          ['Est. MRR (AUD)', money(mrr), 'at current plans'],
        ].map(([label, value, foot]) => (
          <div key={label} className="rounded-[3px] border border-ink-line bg-ink-raised px-4 py-3.5">
            <p className="eyebrow text-bone-muted/80">{label}</p>
            <p className="mt-1.5 font-display text-2xl leading-none text-bone">{value}</p>
            <p className="mt-1 text-[0.7rem] text-bone-muted">{foot}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Coverage by suburb</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {top.map(([suburb, n]) => (
              <div key={suburb} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[0.78rem] text-paper-muted">{suburb}</span>
                <Progress value={Math.round((n / top[0][1]) * 100)} className="flex-1" />
                <span className="w-6 shrink-0 text-right font-display text-[0.8rem]">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Database health</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-[0.83rem]">
              {[
                ['Missing booking email', venues.filter((v) => !v.contactEmail).length],
                ['Missing coordinates', venues.filter((v) => !v.lat || !v.lng).length],
                ['Missing capacity', venues.filter((v) => !v.capacity).length],
                ['Archived', venues.filter((v) => v.status === 'archived').length],
              ].map(([k, n]) => (
                <div key={k} className="flex items-baseline justify-between border-b border-dashed border-paper-line pb-2 last:border-0">
                  <dt className="text-paper-muted">{k}</dt>
                  <dd className="font-display text-base">{n}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function VenuesTab() {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(undefined);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return state.venues
      .filter((v) => !term || `${v.name} ${v.city} ${v.contactEmail}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, state.venues.length]);

  const samples = sampleVenues();

  function exportAll() {
    download('gigbook-master-venues.csv', toCsv([
      FIELDS.map(([, label]) => label),
      ...state.venues.map((v) => FIELDS.map(([key]) => (key === 'genres' ? v.genres.join('; ') : v[key] ?? ''))),
    ]));
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bone-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} data-q placeholder="Search name, suburb, email…"
            className="border-ink-line-strong bg-ink-raised pl-8 text-bone placeholder:text-bone-muted/70" />
        </div>
        <Button variant="secondary" size="sm" onClick={exportAll}><Download className="size-4" /> Export</Button>
        <Button size="sm" onClick={() => setEditing(null)} data-add><Plus className="size-4" /> Add venue</Button>
      </div>

      {samples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[3px] border border-stamp-emailed/50 bg-stamp-emailed/10 px-3 py-2.5">
          <AlertTriangle className="size-4 shrink-0 text-stamp-emailed" />
          <p className="min-w-0 flex-1 text-[0.8rem] text-paper-ink">
            <strong className="font-semibold">{samples.length} sample venues</strong> are still in the
            database. They're invented, every address is <code className="text-flash-red">example.com</code>,
            and subscribers can't tell them from real rooms. Import the real list first — this can't be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            data-remove-samples
            onClick={() => {
              if (!confirm(`Permanently delete ${samples.length} sample venues and any outreach against them?`)) return;
              const n = removeSampleVenues();
              toast.success(`Removed ${n} sample venues`);
            }}
          >
            <Trash2 className="size-3.5" /> Remove sample venues
          </Button>
        </div>
      )}

      <Card className="mt-3 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Venue</TableHead>
              <TableHead className="hidden sm:table-cell">Suburb</TableHead>
              <TableHead>Cap</TableHead>
              <TableHead className="hidden lg:table-cell">Booking email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">—</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 200).map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <span className="font-display uppercase tracking-[0.04em] text-[0.88rem]">{v.name}</span>
                  <span className="block text-[0.7rem] text-paper-muted">{v.source} · {fmtDate(v.addedAt)}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-[0.8rem] text-paper-muted">{v.city}</TableCell>
                <TableCell className="text-[0.8rem]">{v.capacity || '—'}</TableCell>
                <TableCell className="hidden lg:table-cell text-[0.78rem] text-paper-muted">{v.contactEmail || '—'}</TableCell>
                <TableCell>
                  <span className="stamp" style={{
                    color: v.status === 'active' ? 'var(--color-flash-green)' : v.status === 'pending' ? 'var(--color-stamp-emailed)' : 'var(--color-stamp-none)',
                    borderColor: v.status === 'active' ? 'var(--color-flash-green)' : v.status === 'pending' ? 'var(--color-stamp-emailed)' : 'var(--color-stamp-none)',
                  }}>{v.status}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button variant="ghost-paper" size="icon-sm" aria-label="Edit" onClick={() => setEditing(v)}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost-paper" size="icon-sm" aria-label="Delete" onClick={() => { deleteVenue(v.id); toast('Venue deleted'); }}><Trash2 className="size-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 200 && <p className="border-t border-paper-line p-3 text-[0.78rem] text-paper-muted">Showing 200 of {rows.length}. Narrow with search.</p>}
      </Card>

      <VenueDialog venue={editing} open={editing !== undefined} onOpenChange={(v) => !v && setEditing(undefined)} />
    </>
  );
}

function ImportTab() {
  const [pending, setPending] = useState(null);
  const [asPending, setAsPending] = useState(false);
  const [text, setText] = useState('');

  function begin(csv, filename) {
    const rows = parseCsv(csv);
    if (rows.length < 2) { toast.error('That CSV has no data rows'); return; }
    const headers = rows[0];
    const mapping = {};
    FIELDS.forEach(([key]) => { mapping[key] = guessColumn(headers, key); });
    setPending({ rows, mapping, filename });
  }

  function run() {
    const { rows, mapping } = pending;
    if (mapping.name < 0 || mapping.city < 0) { toast.error('Map at least the venue name and suburb columns'); return; }
    const get = (row, key) => (mapping[key] >= 0 ? (row[mapping[key]] || '').trim() : '');
    let added = 0; let updated = 0; let skipped = 0;

    rows.slice(1).forEach((row) => {
      const name = get(row, 'name');
      const city = get(row, 'city');
      if (!name || !city) { skipped += 1; return; }
      const existing = state.venues.find((v) => v.name.toLowerCase() === name.toLowerCase() && v.city.toLowerCase() === city.toLowerCase());
      const genresRaw = get(row, 'genres');
      const record = {
        name, city, state: 'VIC', country: 'Australia',
        capacity: Number(get(row, 'capacity')) || existing?.capacity || 0,
        type: get(row, 'type') || existing?.type || 'Pub',
        genres: genresRaw ? genresRaw.split(/[;,]/).map((g) => g.trim()).filter(Boolean) : existing?.genres || [],
        contactName: get(row, 'contactName') || existing?.contactName || '',
        contactEmail: get(row, 'contactEmail') || existing?.contactEmail || '',
        website: get(row, 'website') || existing?.website || '',
        payType: get(row, 'payType') || existing?.payType || '',
        submissionMethod: get(row, 'submissionMethod') || existing?.submissionMethod || 'Email',
        lat: Number(get(row, 'lat')) || existing?.lat || 0,
        lng: Number(get(row, 'lng')) || existing?.lng || 0,
        notes: get(row, 'notes') || existing?.notes || '',
        status: asPending ? 'pending' : existing?.status || 'active',
        visibility: 'shared',
        source: 'spreadsheet',
      };
      if (existing) { Object.assign(existing, record); updated += 1; }
      else { state.venues.push({ ...record, id: `ven_${slugify(name)}_${slugify(city)}`, ownerId: null, addedAt: new Date().toISOString() }); added += 1; }
    });

    save();
    setPending(null);
    toast.success(`Imported: ${added} new, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}`);
  }

  if (!pending) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="p-5">
          <div
            className="rounded-[3px] border border-dashed border-paper-line bg-paper-shade/60 p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) f.text().then((t) => begin(t, f.name)); }}
          >
            <Upload className="mx-auto size-6 text-paper-muted" />
            <p className="mt-2 font-display uppercase tracking-[0.08em]">Drop the venue CSV here</p>
            <p className="mt-1 text-[0.78rem] text-paper-muted">or</p>
            <Input
              type="file"
              accept=".csv,text/csv"
              className="mx-auto mt-2 max-w-64"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => begin(t, f.name)); }}
            />
          </div>
          <div className="mt-5 space-y-1.5">
            <Label htmlFor="csv-paste">…or paste CSV</Label>
            <Textarea id="csv-paste" rows={6} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Venue,Suburb,Capacity,Booking Email&#10;The Rusted Anchor,Fitzroy,220,bookings@example.com" />
            <Button className="mt-2" onClick={() => (text.trim() ? begin(text, 'pasted data') : toast.error('Paste some CSV first'))} data-parse-paste>
              Read CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const [headers, ...body] = pending.rows;
  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>Map columns</CardTitle>
        <Button variant="ghost-paper" size="sm" onClick={() => setPending(null)}>Start over</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[0.82rem] text-paper-muted">{plural(body.length, 'row')} found in <strong>{pending.filename}</strong>.</p>

        <div className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-center">
          {FIELDS.map(([key, label, required]) => (
            <div key={key} className="contents">
              <Label htmlFor={`map-${key}`}>{label}{required && <span className="text-flash-red"> *</span>}</Label>
              <Select
                defaultValue={String(pending.mapping[key])}
                onValueChange={(v) => setPending((p) => ({ ...p, mapping: { ...p.mapping, [key]: Number(v) } }))}
              >
                <SelectTrigger id={`map-${key}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">— skip —</SelectItem>
                  {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-[3px] border border-paper-line">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {body.slice(0, 5).map((r, i) => (
                <TableRow key={i}>{headers.map((_, j) => <TableCell key={j} className="text-[0.78rem]">{r[j] || ''}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="border-l-2 border-flash-red bg-flash-red/8 px-3 py-2 text-[0.8rem]">
          Rows matching an existing venue on <strong>name + suburb</strong> are updated rather than duplicated.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={run} data-run-import><Upload className="size-4" /> Import {body.length} rows</Button>
          <label className="flex items-center gap-2 text-[0.82rem]">
            <Checkbox checked={asPending} onCheckedChange={setAsPending} /> Import as pending review
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Review one submission before it becomes everyone's data. Approving publishes whatever
 * is in this form, not whatever was typed by the subscriber — a good suggestion with a
 * missing email or a mangled suburb is worth fixing rather than declining.
 */
function ReviewDialog({ venue, open, onOpenChange }) {
  const [reason, setReason] = useState('');
  if (!open || !venue) return null;

  const duplicate = findDuplicateVenue(venue, venue.id);

  function readForm(form) {
    const d = Object.fromEntries(new FormData(form).entries());
    return {
      name: String(d.name || '').trim(),
      city: String(d.city || '').trim(),
      capacity: Number(d.capacity) || 0,
      type: String(d.type || venue.type),
      contactName: String(d.contactName || '').trim(),
      contactEmail: String(d.contactEmail || '').trim(),
      website: String(d.website || '').trim(),
      lat: Number(d.lat) || 0,
      lng: Number(d.lng) || 0,
      genres: String(d.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
      notes: String(d.notes || ''),
    };
  }

  function approve(e) {
    e.preventDefault();
    const patch = readForm(e.currentTarget);
    if (!patch.name || !patch.city) { toast.error('Name and suburb are required'); return; }
    approveVenue(venue.id, patch);
    onOpenChange(false);
    toast.success('Published to everyone', { description: `${patch.name} is now in the shared database.` });
  }

  function reject() {
    if (!reason.trim()) { toast.error('Give a reason — the submitter sees it'); return; }
    rejectVenue(venue.id, reason.trim());
    onOpenChange(false);
    setReason('');
    toast('Declined', { description: 'The submitter has been told why.' });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review submission</DialogTitle>
        </DialogHeader>

        <p className="text-[0.78rem] text-paper-muted">
          Sent by {venue.submittedByEmail || 'a subscriber'} on {fmtDate(venue.addedAt)}. Correct anything
          that&apos;s wrong before you publish it.
        </p>

        {duplicate && (
          <p
            data-review-duplicate
            className="flex gap-2 rounded-[3px] border border-stamp-emailed/50 bg-stamp-emailed/10 px-3 py-2 text-[0.78rem] text-paper-ink"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stamp-emailed" />
            <span>
              Possible duplicate of <strong className="font-semibold">{duplicate.name}</strong> in {duplicate.city},
              already active in the database.
            </span>
          </p>
        )}

        <form onSubmit={approve} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-name">Venue name</Label>
            <Input id="r-name" name="name" defaultValue={venue.name} required />
          </div>
          {[['city', 'Suburb'], ['capacity', 'Capacity'], ['contactName', 'Booking contact'], ['contactEmail', 'Booking email'],
            ['website', 'Website'], ['lat', 'Latitude'], ['lng', 'Longitude']].map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`r-${k}`}>{label}</Label>
              <Input
                id={`r-${k}`}
                name={k}
                // 0 means "the submitter didn't say", so show it as blank to fill in.
                defaultValue={venue[k] || ''}
                type={['capacity', 'lat', 'lng'].includes(k) ? 'number' : 'text'}
                step="any"
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="r-type">Type</Label>
            <Select name="type" defaultValue={venue.type || 'Pub'}>
              <SelectTrigger id="r-type"><SelectValue /></SelectTrigger>
              <SelectContent>{VENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-genres">Genres</Label>
            <Input id="r-genres" name="genres" defaultValue={(venue.genres || []).join(', ')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-notes">Booking notes</Label>
            <Textarea id="r-notes" name="notes" rows={2} defaultValue={venue.notes} />
          </div>

          <div className="space-y-1.5 sm:col-span-2 border-t border-dashed border-paper-line pt-3">
            <Label htmlFor="r-reason">Reason, if you&apos;re declining it</Label>
            <Input
              id="r-reason"
              data-reject-reason
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Already listed as The Tote, Collingwood"
            />
            <p className="text-[0.72rem] text-paper-muted">Shown to the artist who sent it in, so they know not to resend.</p>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost-paper" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" variant="paper" onClick={reject} data-reject>
              <X className="size-3.5" /> Decline
            </Button>
            <Button type="submit" data-approve>
              <Check className="size-3.5" /> Approve &amp; publish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Submissions() {
  const pending = pendingSubmissions();
  const [reviewing, setReviewing] = useState(null);

  if (!pending.length) {
    return (
      <Card className="mx-auto max-w-lg"><CardContent className="py-12 text-center">
        <h2 className="text-xl">Queue is clear</h2>
        <p className="mt-2 text-[0.85rem] text-paper-muted">Subscriber submissions land here for review before they hit the shared database.</p>
      </CardContent></Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Venue</TableHead><TableHead className="hidden sm:table-cell">Suburb</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((v) => {
              const duplicate = findDuplicateVenue(v, v.id);
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <span className="font-display uppercase tracking-[0.04em] text-[0.88rem]">{v.name}</span>
                    <span className="block text-[0.7rem] text-paper-muted">{v.source}</span>
                    {duplicate && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] text-stamp-emailed">
                        <AlertTriangle className="size-3" /> Possible duplicate
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[0.8rem] text-paper-muted">{v.city}</TableCell>
                  <TableCell className="hidden lg:table-cell text-[0.78rem] text-paper-muted">{v.contactEmail || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-[0.78rem] text-paper-muted">{fmtDate(v.addedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" data-review onClick={() => setReviewing(v)}>
                      <Pencil className="size-3.5" /> Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ReviewDialog venue={reviewing} open={Boolean(reviewing)} onOpenChange={(o) => !o && setReviewing(null)} />
    </>
  );
}

function Users() {
  const me = currentUser();
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Artist</TableHead><TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead>Plan</TableHead><TableHead className="hidden lg:table-cell">Joined</TableHead>
            <TableHead>Admin</TableHead><TableHead className="text-right">—</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <span className="font-display uppercase tracking-[0.04em] text-[0.88rem]">{u.artistName || '—'}</span>
                <span className="block text-[0.7rem] text-paper-muted">{u.homeCity}</span>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-[0.78rem] text-paper-muted">{u.email}{u.id === me.id && ' (you)'}</TableCell>
              <TableCell className="text-[0.8rem]">{PLANS[u.plan].name} · {money(planPrice(u.plan, u.cycle))}</TableCell>
              <TableCell className="hidden lg:table-cell whitespace-nowrap text-[0.78rem] text-paper-muted">{fmtDate(u.createdAt)}</TableCell>
              <TableCell>
                <Checkbox
                  defaultChecked={u.isAdmin}
                  disabled={u.id === me.id}
                  onCheckedChange={(checked) => { u.isAdmin = Boolean(checked); save(); }}
                />
              </TableCell>
              <TableCell className="text-right">
                {u.id !== me.id && (
                  <Button
                    variant="ghost-paper"
                    size="icon-sm"
                    aria-label="Delete user"
                    onClick={() => {
                      state.users = state.users.filter((x) => x.id !== u.id);
                      state.epks = state.epks.filter((e) => e.userId !== u.id);
                      state.outreach = state.outreach.filter((o) => o.userId !== u.id);
                      state.lists = state.lists.filter((l) => l.userId !== u.id);
                      save();
                      toast('User deleted');
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function Admin() {
  const { tab } = useParams();
  if (!TABS.includes(tab)) return <Navigate to="/admin/overview" replace />;

  const titles = {
    overview: ['Overview', 'Shared database and subscriber snapshot'],
    venues: ['Venue database', `${state.venues.length} rows · edits are live for every subscriber`],
    import: ['Import spreadsheet', 'Seed or top up the master database from CSV'],
    submissions: ['Submissions', `${plural(pendingSubmissions().length, 'venue')} waiting on review before subscribers see them`],
    users: ['Users', `${plural(state.users.length, 'account')} on this deployment`],
  };

  return (
    <AppShell admin title={titles[tab][0]} subtitle={titles[tab][1]}>
      {tab === 'overview' && <Overview />}
      {tab === 'venues' && <VenuesTab />}
      {tab === 'import' && <ImportTab />}
      {tab === 'submissions' && <Submissions />}
      {tab === 'users' && <Users />}
    </AppShell>
  );
}
