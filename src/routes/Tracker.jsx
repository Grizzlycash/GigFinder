import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Download, LayoutGrid, Rows3, Send, Trash2, Paperclip, Loader2 } from 'lucide-react';
import {
  myOutreach, venueById, STATUSES, statusMeta, setOutreachStatus, updateOutreach,
  deleteOutreach, outreachStats, dueFollowUps, isPro, can, loadDemoOutreach, epkById, currentUser,
} from '@/store/store';
import AppShell from '@/components/AppShell';
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { generateEpkPdf } from '@/lib/epkPdf';
import { fmtDate, fmtDateTime, toCsv, download } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The press kit as it went out. The document is snapshotted on the record, so this
 * rebuilds *that* PDF — not whatever the EPK says today.
 */
function SentAttachment({ record, epk }) {
  const [building, setBuilding] = useState(false);
  const { attachment } = record;

  async function rebuild() {
    setBuilding(true);
    try {
      const { blob, filename } = await generateEpkPdf({ document: attachment.document, epk, user: currentUser() });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error('Could not rebuild that press kit', { description: err.message });
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-[3px] border border-paper-line bg-paper-shade/70 p-3" data-attachment>
      <Paperclip className="size-4 shrink-0 text-flash-red" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.82rem] text-paper-ink">{attachment.filename}</p>
        <p className="text-[0.72rem] text-paper-muted">
          {attachment.kind === 'pdf' ? `Press kit · ${attachment.pages} pages as sent` : `Uploaded file${attachment.size ? ` · ${attachment.size}` : ''}`}
        </p>
      </div>
      {attachment.kind === 'pdf' && attachment.document && (
        <Button variant="paper" size="sm" onClick={rebuild} disabled={building} data-attachment-download>
          {building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} PDF
        </Button>
      )}
    </div>
  );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Awaiting reply' },
  { id: 'followups', label: 'Follow-ups due' },
];

function Stat({ label, value, foot }) {
  return (
    <div className="rounded-[3px] border border-ink-line bg-ink-raised px-4 py-3">
      <p className="eyebrow text-bone-muted/80">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none text-bone">{value}</p>
      {foot && <p className="mt-1 text-[0.7rem] text-bone-muted">{foot}</p>}
    </div>
  );
}

export default function Tracker() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get('filter') || 'all');
  const [q, setQ] = useState('');
  const [view, setView] = useState('table');
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);

  const stats = outreachStats();
  const all = myOutreach();
  const due = useMemo(() => new Set(dueFollowUps().map((o) => o.id)), [all]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all
      .filter((o) => {
        if (filter === 'followups' && !due.has(o.id)) return false;
        if (filter === 'open' && !['emailed', 'opened'].includes(o.status)) return false;
        if (term) {
          const v = venueById(o.venueId);
          if (!`${v?.name} ${v?.city} ${o.to} ${o.subject}`.toLowerCase().includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [all, filter, q, due]);

  const record = openId ? all.find((o) => o.id === openId) : null;

  function exportCsv() {
    if (!can('csvExport')) { toast('CSV export is a Pro feature'); return; }
    const head = ['Venue', 'Suburb', 'Sent to', 'Subject', 'Sent', 'Status', 'Follow-up', 'Notes'];
    download('gigbook-outreach.csv', toCsv([head, ...rows.map((o) => {
      const v = venueById(o.venueId);
      return [v?.name, v?.city, o.to, o.subject, fmtDate(o.sentAt), statusMeta(o.status).label, o.followUpAt ? fmtDate(o.followUpAt) : '', o.notes];
    })]));
    toast.success('Pipeline exported');
  }

  if (!all.length) {
    return (
      <AppShell title="Outreach" subtitle="Nothing sent yet">
        <Card className="mx-auto max-w-lg">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl">No outreach yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[0.85rem] text-paper-muted">
              Every email you send lands here, stamped with where it got to.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/venues"><Send className="size-4" /> Find a room</Link></Button>
              <Button variant="paper" onClick={() => { loadDemoOutreach(); toast.success('Sample pipeline loaded'); }} data-demo>
                Load sample pipeline
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Outreach"
      subtitle={`${stats.sent} sent · ${stats.replied} replied (${stats.replyRate}%) · ${stats.booked} booked`}
      actions={
        <div className="hidden items-center gap-1.5 sm:flex">
          <Button variant={view === 'table' ? 'default' : 'secondary'} size="sm" onClick={() => setView('table')} data-mode="table">
            <Rows3 className="size-4" /> Table
          </Button>
          <Button variant={view === 'board' ? 'default' : 'secondary'} size="sm" onClick={() => setView('board')} data-mode="board">
            <LayoutGrid className="size-4" /> Board
          </Button>
        </div>
      }
    >
      {isPro() ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Reply rate" value={`${stats.replyRate}%`} foot={`${stats.replied} of ${stats.sent}`} />
          <Stat label="Booking rate" value={`${stats.bookRate}%`} foot={`${stats.booked} confirmed`} />
          <Stat label="Awaiting reply" value={all.filter((o) => ['emailed', 'opened'].includes(o.status)).length} foot={`${due.size} overdue`} />
          <Stat label="Passed" value={stats.declined} foot="worth a retry next run" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-[3px] border border-ink-line bg-ink-raised px-4 py-3 text-[0.8rem] text-bone-muted">
          <span>Reply and booking analytics come with Pro.</span>
          <Link to="/pricing" className="font-display uppercase tracking-[0.08em] text-[0.75rem] text-flash-red hover:underline">Compare plans</Link>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-bone-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-q
            placeholder="Search venue, suburb, subject…"
            className="border-ink-line-strong bg-ink-raised pl-8 text-bone placeholder:text-bone-muted/70"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                'rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
                filter === f.id ? 'border-flash-red bg-flash-red text-[#fbf7ec]' : 'border-ink-line-strong text-bone-muted hover:bg-ink-hover hover:text-bone',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="icon" onClick={exportCsv} aria-label="Export CSV" data-export>
          <Download className="size-4" />
        </Button>
      </div>

      {view === 'table' ? (
        <Card className="mt-4 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Venue</TableHead>
                <TableHead className="hidden md:table-cell">Sent to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Sent</TableHead>
                <TableHead className="hidden lg:table-cell">Follow-up</TableHead>
                <TableHead className="text-right">—</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const v = venueById(o.venueId);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link to={`/venues/${o.venueId}`} className="font-display uppercase tracking-[0.04em] text-[0.9rem] hover:text-flash-red">
                        {v?.name || 'Venue'}
                      </Link>
                      <span className="block text-[0.72rem] text-paper-muted">{v?.city}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[0.78rem] text-paper-muted">{o.to}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(val) => { setOutreachStatus(o.id, val); toast.success('Status updated'); }}>
                        <SelectTrigger data-status className="h-8 w-[9.5rem] border-transparent bg-transparent px-1 hover:bg-paper-shade">
                          <Stamp status={o.status} seed={o.id} />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell whitespace-nowrap text-[0.78rem] text-paper-muted">{fmtDate(o.sentAt)}</TableCell>
                    <TableCell className={cn('hidden lg:table-cell whitespace-nowrap text-[0.78rem]', due.has(o.id) ? 'text-flash-red' : 'text-paper-muted')}>
                      {o.followUpAt ? fmtDate(o.followUpAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost-paper" size="sm" onClick={() => setOpenId(o.id)} data-open>Open</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length && <p className="p-8 text-center text-[0.85rem] text-paper-muted">Nothing matches that filter.</p>}
        </Card>
      ) : (
        <div className="mt-4 grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${STATUSES.length}, minmax(13rem, 1fr))` }}>
          {STATUSES.map((s) => {
            const items = rows.filter((o) => o.status === s.id);
            return (
              <div
                key={s.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) { setOutreachStatus(dragId, s.id); setDragId(null); toast.success(`Moved to ${s.label}`); } }}
                className="rounded-[3px] border border-ink-line bg-ink-raised p-2"
                data-col={s.id}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <Stamp status={s.id} seed={s.id} onDark />
                  <span className="text-[0.7rem] text-bone-muted">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => {
                    const v = venueById(o.venueId);
                    return (
                      <article
                        key={o.id}
                        draggable
                        onDragStart={() => setDragId(o.id)}
                        onDragEnd={() => setDragId(null)}
                        className="cursor-grab rounded-[3px] border border-paper-line bg-paper p-2.5 active:cursor-grabbing"
                        data-card
                      >
                        <p className="truncate font-display uppercase tracking-[0.04em] text-[0.85rem] text-paper-ink">{v?.name}</p>
                        <p className="truncate text-[0.7rem] text-paper-muted">{v?.city} · {fmtDate(o.sentAt)}</p>
                        <Button variant="ghost-paper" size="sm" className="mt-1.5 -ml-2" onClick={() => setOpenId(o.id)}>Open</Button>
                      </article>
                    );
                  })}
                  {!items.length && <p className="px-1 py-2 text-[0.7rem] text-bone-muted/70">Drop here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Record dialog ---- */}
      <Dialog open={Boolean(record)} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          {record && (() => {
            const v = venueById(record.venueId);
            const kit = epkById(record.epkId);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{v?.name}</DialogTitle>
                  <DialogDescription>{v?.city} · sent {fmtDateTime(record.sentAt)} · {kit?.title || 'deleted EPK'}</DialogDescription>
                </DialogHeader>

                <div className="rounded-[3px] border border-paper-line bg-paper-shade/70 p-3 text-[0.82rem]">
                  <p className="text-paper-muted">To <span className="text-paper-ink">{record.to}</span></p>
                  <p className="mt-1 text-paper-muted">Subject <span className="text-paper-ink">{record.subject}</span></p>
                </div>

                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[3px] border border-paper-line bg-white/50 p-3 font-sans text-[0.8rem] leading-relaxed text-paper-ink">
                  {record.body}
                </pre>

                {record.attachment && <SentAttachment record={record} epk={kit} />}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-status">Status</Label>
                    <Select value={record.status} onValueChange={(val) => setOutreachStatus(record.id, val)}>
                      <SelectTrigger id="m-status"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-follow">Follow-up date</Label>
                    <Input
                      id="m-follow"
                      type="date"
                      disabled={!isPro()}
                      defaultValue={record.followUpAt ? new Date(record.followUpAt).toISOString().slice(0, 10) : ''}
                      onChange={(e) => updateOutreach(record.id, { followUpAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null })}
                    />
                    {!isPro() && <p className="text-[0.7rem] text-paper-muted">Reminders are a Pro feature.</p>}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="m-notes">Notes</Label>
                    <Textarea id="m-notes" rows={3} defaultValue={record.notes || ''} onBlur={(e) => updateOutreach(record.id, { notes: e.target.value })} />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => { deleteOutreach(record.id); setOpenId(null); toast('Removed from pipeline'); }}
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                  <Button onClick={() => { setOpenId(null); toast.success('Saved'); }}>Done</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
