import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Database, Trash2 } from 'lucide-react';
import { currentUser, updateUser, state, save, resetAll, loadDemoOutreach, isPro } from '@/store/store';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DRAWS = ['Under 25', '25–50', '50–100', '100–250', '250+'];

export default function Settings() {
  const navigate = useNavigate();
  const user = currentUser();
  const s = state.settings;

  function submit(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    updateUser({
      artistName: String(d.artistName || '').trim(),
      realName: String(d.realName || '').trim(),
      email: String(d.email || '').trim(),
      homeCity: String(d.homeCity || '').trim(),
      genres: String(d.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
      isAdmin: d.isAdmin === 'on',
    });
    state.settings.defaultSubject = String(d.defaultSubject || '');
    state.settings.signature = String(d.signature || '');
    save();
    toast.success('Settings saved');
  }

  return (
    <AppShell title="Settings" subtitle={user.email}>
      <form onSubmit={submit} data-settings className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-artist">Artist name</Label>
              <Input id="st-artist" name="artistName" defaultValue={user.artistName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-real">Your name</Label>
              <Input id="st-real" name="realName" defaultValue={user.realName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-email">Email</Label>
              <Input id="st-email" name="email" type="email" defaultValue={user.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-city">Home suburb</Label>
              <Input id="st-city" name="homeCity" defaultValue={user.homeCity} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-draw">Typical draw</Label>
              <Select name="drawSize" defaultValue={user.drawSize || undefined}>
                <SelectTrigger id="st-draw"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{DRAWS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-genres">Genres</Label>
              <Input id="st-genres" name="genres" defaultValue={(user.genres || []).join(', ')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Outreach defaults</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-subject">Subject template</Label>
              <Input id="st-subject" name="defaultSubject" defaultValue={s.defaultSubject} />
              <p className="text-[0.72rem] text-paper-muted">Placeholders: {'{artist}'}, {'{venue}'}, {'{city}'}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-sig">Email signature</Label>
              <Textarea id="st-sig" name="signature" rows={3} defaultValue={s.signature} placeholder="Bandcamp · Instagram · phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-remind">Follow-up reminder</Label>
              <Select
                defaultValue={String(s.remindAfterDays)}
                disabled={!isPro()}
                onValueChange={(v) => { state.settings.remindAfterDays = Number(v); save(); }}
              >
                <SelectTrigger id="st-remind"><SelectValue /></SelectTrigger>
                <SelectContent>{[7, 10, 14, 21].map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}</SelectContent>
              </Select>
              {!isPro() && <p className="text-[0.72rem] text-paper-muted">Reminders are a Pro feature.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Access</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-start gap-2.5 text-[0.85rem]">
              <Checkbox name="isAdmin" defaultChecked={user.isAdmin} className="mt-0.5" />
              <span>
                Admin access
                <span className="block text-[0.75rem] text-paper-muted">
                  Shows the venue-database admin panel. In production this is granted by GigFinder staff, not self-served.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <Button type="submit" size="lg">Save settings</Button>
      </form>

      <Card className="mx-auto mt-4 max-w-2xl">
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[0.82rem] text-paper-muted">
            This prototype keeps everything in your browser's local storage — nothing leaves the device.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="paper" size="sm" data-demo onClick={() => { loadDemoOutreach(); toast.success('Sample pipeline loaded'); navigate('/outreach'); }}>
              <Database className="size-4" /> Load sample pipeline
            </Button>
            <Button variant="destructive" size="sm" onClick={() => { if (confirm('Delete your account, EPKs and outreach from this browser?')) resetAll(); }}>
              <Trash2 className="size-4" /> Reset all data
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
