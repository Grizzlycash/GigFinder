import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Pencil, Send, Trash2, Lock } from 'lucide-react';
import { myEpks, createEpk, updateEpk, deleteEpk, plan, isPro, currentUser, epkProgress, can } from '@/store/store';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { relTime } from '@/lib/format';

export default function EpkList() {
  const navigate = useNavigate();
  const epks = myEpks();
  const atCap = epks.length >= plan().limits.epks;

  function create() {
    if (atCap) { toast('Basic includes one EPK', { description: 'Upgrade for more.' }); navigate('/pricing'); return; }
    const user = currentUser();
    navigate(`/epk/${createEpk({ title: `${user.artistName || 'New'} — EPK ${epks.length + 1}` }).id}`);
  }

  return (
    <AppShell
      title="My EPK"
      subtitle={epks.length ? `${epks.length} press kit${epks.length === 1 ? '' : 's'}` : 'Electronic press kit'}
      actions={<Button variant="secondary" size="sm" onClick={create} data-new><Plus className="size-4" /> New EPK</Button>}
    >
      {atCap && !isPro() && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-l-[3px] border-flash-red bg-ink-raised px-4 py-3 text-[0.82rem] text-bone-muted">
          <Lock className="size-4 text-flash-red" />
          Basic includes one press kit. Pro adds the full generator and a separate kit per project.
          <Link to="/pricing" className="font-display uppercase tracking-[0.08em] text-[0.72rem] text-flash-red hover:underline">Compare plans</Link>
        </div>
      )}

      {epks.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {epks.map((e) => {
            const p = epkProgress(e);
            return (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[2px] border border-paper-line bg-paper-shade">
                      {e.photos?.[0]
                        ? <img src={e.photos[0].src} alt="" className="size-full object-cover" />
                        : <span className="eyebrow text-paper-muted">EPK</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[1.05rem] leading-tight">{e.title}</h2>
                        {e.isDefault && <span className="stamp shrink-0" style={{ color: 'var(--color-flash-green)', borderColor: 'var(--color-flash-green)' }}>Default</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[0.78rem] text-paper-muted">{e.tagline || 'No tagline yet'}</p>
                      <Progress value={Math.round((p.count / p.total) * 100)} className="mt-2.5" />
                      <p className="mt-1.5 text-[0.7rem] text-paper-muted">
                        {can('epkGenerator')
                          ? `${p.count} of ${p.total} sections complete`
                          : p.done.bio ? 'Bio ready to send' : 'Short bio still needed'}
                        {e.uploadedFile ? ` · ${e.uploadedFile.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-[0.8rem] leading-relaxed text-paper-ink">
                    {e.shortBio || 'No short bio yet — add one before sending.'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-paper-line pt-3">
                    <span className="text-[0.7rem] text-paper-muted">Updated {relTime(e.updatedAt)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {!e.isDefault && (
                        <Button variant="ghost-paper" size="sm" onClick={() => { myEpks().forEach((x) => updateEpk(x.id, { isDefault: x.id === e.id })); toast.success('Default updated'); }}>
                          Make default
                        </Button>
                      )}
                      <Button variant="paper" size="sm" asChild><Link to={`/epk/${e.id}`}><Pencil className="size-3.5" /> Edit</Link></Button>
                      <Button size="sm" asChild><Link to={`/send?epk=${e.id}`}><Send className="size-3.5" /> Use it</Link></Button>
                      {epks.length > 1 && (
                        <Button variant="destructive" size="icon-sm" aria-label="Delete" onClick={() => { deleteEpk(e.id); toast('EPK deleted'); }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mx-auto max-w-lg">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl">No press kit yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[0.85rem] text-paper-muted">Create one and GigFinder pre-fills it from your profile.</p>
            <Button className="mt-4" onClick={create} data-new><Plus className="size-4" /> Create my EPK</Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
