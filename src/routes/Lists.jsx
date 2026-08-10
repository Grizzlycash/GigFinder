import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Send, X, Lock } from 'lucide-react';
import { isPro, myLists, createList, deleteList, toggleListVenue, venueById, outreachForVenue, PLANS } from '@/store/store';
import AppShell from '@/components/AppShell';
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { plural, money } from '@/lib/format';

export default function Lists() {
  if (!isPro()) {
    return (
      <AppShell title="Saved lists" subtitle="Pro feature">
        <Card className="mx-auto max-w-lg"><CardContent className="py-12 text-center">
          <Lock className="mx-auto size-6 text-flash-red" />
          <h2 className="mt-3 text-xl">Saved lists come with Pro</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.85rem] text-paper-muted">
            Group rooms into a run — "Regional, October" — and work the list without losing your place.
          </p>
          <Button asChild className="mt-4"><Link to="/pricing">See Pro — {money(PLANS.pro.monthly)}/mo</Link></Button>
        </CardContent></Card>
      </AppShell>
    );
  }

  const lists = myLists();

  function add() {
    const name = prompt('Name this list (e.g. "Regional run — October")');
    if (name?.trim()) { createList(name.trim()); toast.success('List created'); }
  }

  return (
    <AppShell
      title="Saved lists"
      subtitle="Build a route, then work down it"
      actions={<Button variant="secondary" size="sm" onClick={add}><Plus className="size-4" /> New list</Button>}
    >
      {lists.length ? (
        <div className="space-y-4">
          {lists.map((l) => {
            const venues = l.venueIds.map(venueById).filter(Boolean);
            const untouched = venues.filter((v) => !outreachForVenue(v.id));
            return (
              <Card key={l.id}>
                <CardHeader>
                  <div>
                    <CardTitle>{l.name}</CardTitle>
                    <p className="mt-0.5 text-[0.75rem] text-paper-muted">{plural(venues.length, 'room')} · {untouched.length} not contacted</p>
                  </div>
                  <div className="flex gap-1.5">
                    {untouched.length > 0 && (
                      <Button size="sm" asChild><Link to={`/send?venue=${untouched[0].id}`}><Send className="size-3.5" /> Next</Link></Button>
                    )}
                    <Button variant="destructive" size="icon-sm" aria-label="Delete list" onClick={() => { deleteList(l.id); toast('List deleted'); }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                {venues.length ? (
                  <ul>
                    {venues.map((v) => (
                      <li key={v.id} className="flex items-center gap-3 border-b border-dashed border-paper-line px-4 py-2.5 last:border-0">
                        <Link to={`/venues/${v.id}`} className="min-w-0 flex-1">
                          <span className="block truncate font-display uppercase tracking-[0.04em] text-[0.9rem] hover:text-flash-red">{v.name}</span>
                          <span className="block truncate text-[0.72rem] text-paper-muted">{v.city} · Cap. {v.capacity}</span>
                        </Link>
                        <Stamp status={outreachForVenue(v.id)?.status || 'none'} seed={v.id} />
                        <Button variant="ghost-paper" size="icon-sm" aria-label="Remove" onClick={() => toggleListVenue(l.id, v.id)}>
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <CardContent><p className="text-[0.82rem] text-paper-muted">Empty — add rooms with "Save to list" on any venue.</p></CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mx-auto max-w-lg"><CardContent className="py-12 text-center">
          <h2 className="text-xl">No lists yet</h2>
          <p className="mt-2 text-[0.85rem] text-paper-muted">Create one, then save rooms to it from the venue list.</p>
          <Button className="mt-4" onClick={add}><Plus className="size-4" /> New list</Button>
        </CardContent></Card>
      )}
    </AppShell>
  );
}
