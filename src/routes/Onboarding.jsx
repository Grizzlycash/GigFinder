import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, Zap } from 'lucide-react';
import { currentUser, updateUser, createEpk, myEpks, PLANS, planPrice, annualTotal } from '@/store/store';
import { ALL_GENRES } from '@/data/venues';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

const STEPS = ['Your act', 'Where to hear you', 'Your bio', 'Your plan'];
const DRAWS = ['Under 25', '25–50', '50–100', '100–250', '250+'];

export default function Onboarding() {
  const navigate = useNavigate();
  const user = currentUser();
  const step = Math.min(4, Math.max(1, user.onboardingStep || 1));
  const [genres, setGenres] = useState(user.genres || []);
  const [photo, setPhoto] = useState(user.photo || '');
  const [bioLen, setBioLen] = useState((user.shortBio || '').length);
  const [plan, setPlan] = useState(user.plan || 'basic');
  const [annual, setAnnual] = useState(user.cycle === 'annual');

  function toggleGenre(g) {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 3) { toast('Pick up to 3 genres'); return prev; }
      return [...prev, g];
    });
  }

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { toast.error('Please pick an image under 1.5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());

    if (step === 1) {
      if (!String(d.artistName || '').trim()) { toast.error('Artist name is required'); return; }
      updateUser({
        artistName: String(d.artistName).trim(),
        realName: String(d.realName || '').trim(),
        drawSize: String(d.drawSize || ''),
        homeCity: String(d.homeCity || '').trim(),
        homeState: 'VIC',
        genres,
        onboardingStep: 2,
      });
    }

    if (step === 2) {
      updateUser({
        links: {
          spotify: String(d.spotify || '').trim(),
          bandcamp: String(d.bandcamp || '').trim(),
          youtube: String(d.youtube || '').trim(),
          instagram: String(d.instagram || '').trim(),
          website: String(d.website || '').trim(),
        },
        photo,
        onboardingStep: 3,
      });
    }

    if (step === 3) {
      if (String(d.shortBio || '').trim().length < 20) {
        toast.error('Add a short bio', { description: 'It becomes the body of every booking email.' });
        return;
      }
      updateUser({
        tagline: String(d.tagline || '').trim(),
        shortBio: String(d.shortBio).trim(),
        longBio: String(d.longBio || '').trim(),
        onboardingStep: 4,
      });
    }

    if (step === 4) {
      const u = updateUser({ plan, cycle: annual ? 'annual' : 'monthly', onboarded: true });
      if (!myEpks().length) {
        createEpk({
          title: `${u.artistName} — EPK`,
          tagline: u.tagline || '',
          shortBio: u.shortBio || '',
          longBio: u.longBio || '',
          genres: u.genres,
          homeCity: u.homeCity,
        });
      }
      toast.success(`You're on ${plan === 'pro' ? 'Pro' : 'Basic'}`, { description: "Let's find you some rooms." });
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-ink-line bg-ink-raised px-5 py-3.5">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="grid size-7 place-items-center rounded-[2px] bg-flash-red font-display text-[0.8rem] text-[#fbf7ec]">GF</span>
          <span className="font-display text-base tracking-[0.08em] text-bone">GigFinder</span>
          <span className="ml-auto eyebrow text-bone-muted">Step {step} of 4</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Poster-style step bar */}
        <ol className="mb-7 grid grid-cols-4 gap-2">
          {STEPS.map((name, i) => {
            const n = i + 1;
            return (
              <li key={name}>
                <div className={cn('h-1 rounded-[1px]', n <= step ? 'bg-flash-red' : 'bg-ink-line')} />
                <p className={cn('mt-2 font-display uppercase tracking-[0.1em] text-[0.68rem]',
                  n === step ? 'text-bone' : n < step ? 'text-bone-muted' : 'text-bone-muted/50')}>
                  {n}. {name}
                </p>
              </li>
            );
          })}
        </ol>

        <form onSubmit={submit} data-step-form className="rounded-[3px] border border-paper-line bg-paper p-6 text-paper-ink">
          {step === 1 && (
            <>
              <h2 className="text-2xl">Who's playing?</h2>
              <p className="mt-1 text-[0.85rem] text-paper-muted">This is what venues see first. All of it is editable later.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ob-artist">Artist / band name</Label>
                  <Input id="ob-artist" name="artistName" defaultValue={user.artistName} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-real">Your name</Label>
                  <Input id="ob-real" name="realName" defaultValue={user.realName} placeholder="Who signs the email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-draw">Typical local draw</Label>
                  <Select name="drawSize" defaultValue={user.drawSize || undefined}>
                    <SelectTrigger id="ob-draw"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{DRAWS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ob-city">Home suburb</Label>
                  <Input id="ob-city" name="homeCity" defaultValue={user.homeCity} placeholder="Brunswick" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Genres <span className="normal-case tracking-normal text-paper-muted/80">(up to 3 — used to match rooms)</span></Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_GENRES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        data-genre={g}
                        aria-pressed={genres.includes(g)}
                        className={cn(
                          'rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.7rem] transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
                          genres.includes(g)
                            ? 'border-flash-red bg-flash-red text-[#fbf7ec]'
                            : 'border-paper-line text-paper-muted hover:bg-paper-shade',
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl">Where can they hear you?</h2>
              <p className="mt-1 text-[0.85rem] text-paper-muted">One strong link beats five weak ones — bookers click the first.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ob-spotify">Primary streaming link</Label>
                  <Input id="ob-spotify" name="spotify" defaultValue={user.links?.spotify} placeholder="https://open.spotify.com/artist/…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-bandcamp">Bandcamp</Label>
                  <Input id="ob-bandcamp" name="bandcamp" defaultValue={user.links?.bandcamp} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-youtube">Live video</Label>
                  <Input id="ob-youtube" name="youtube" defaultValue={user.links?.youtube} placeholder="A full live song helps most" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-instagram">Instagram</Label>
                  <Input id="ob-instagram" name="instagram" defaultValue={user.links?.instagram} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-website">Website</Label>
                  <Input id="ob-website" name="website" defaultValue={user.links?.website} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Press photo</Label>
                  <div className="flex items-center gap-3">
                    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[2px] border border-paper-line bg-paper-shade">
                      {photo ? <img src={photo} alt="" className="size-full object-cover" /> : <span className="eyebrow text-paper-muted">None</span>}
                    </span>
                    <div>
                      <Input id="ob-photo" type="file" accept="image/*" onChange={onPhoto} className="max-w-64" />
                      <p className="mt-1 text-[0.7rem] text-paper-muted">JPG or PNG, under 1.5 MB.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl">Write your short bio</h2>
              <div className="mt-4 flex gap-3 border-l-2 border-flash-red bg-flash-red/8 px-4 py-3">
                <Zap className="mt-0.5 size-4 shrink-0 text-flash-red" />
                <p className="text-[0.82rem] leading-relaxed text-paper-ink">
                  This becomes the body of every booking email you send, so your outreach stays consistent.
                  Two to four sentences. Lead with what a booker cares about: sound, draw, recent shows.
                </p>
              </div>
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-tagline">One-line tagline</Label>
                  <Input id="ob-tagline" name="tagline" defaultValue={user.tagline} maxLength={90} placeholder="Grimy four-piece garage rock out of Brunswick" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-short">Short bio</Label>
                  <Textarea
                    id="ob-short"
                    name="shortBio"
                    rows={6}
                    maxLength={700}
                    defaultValue={user.shortBio}
                    onChange={(e) => setBioLen(e.target.value.length)}
                    placeholder="We're a four-piece from Brunswick playing loud, hooky garage rock. Second EP out in March, we pull 80–120 in-market, and we're putting a Victorian run together for spring."
                  />
                  <p className="text-right text-[0.7rem] text-paper-muted">{bioLen} / 700</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-long">Longer bio <span className="normal-case tracking-normal text-paper-muted/80">(optional — EPK only)</span></Label>
                  <Textarea id="ob-long" name="longBio" rows={4} defaultValue={user.longBio} />
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-2xl">Pick a plan</h2>
              <p className="mt-1 text-[0.85rem] text-paper-muted">Switch or cancel any time from Plan &amp; billing.</p>

              <div className="mt-5 flex items-center justify-center gap-3">
                <span className={cn('font-display uppercase tracking-[0.1em] text-[0.75rem]', !annual ? 'text-paper-ink' : 'text-paper-muted')}>Monthly</span>
                <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Bill annually" />
                <span className={cn('font-display uppercase tracking-[0.1em] text-[0.75rem]', annual ? 'text-paper-ink' : 'text-paper-muted')}>Annual</span>
                {annual && <span className="stamp" style={{ color: 'var(--color-flash-green)', borderColor: 'var(--color-flash-green)' }}>Save 20%</span>}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {['basic', 'pro'].map((id) => {
                  const p = PLANS[id];
                  const selected = plan === id;
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setPlan(id)}
                      data-plan={id}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-[3px] border p-4 text-left transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
                        selected ? 'border-flash-red border-2 bg-paper' : 'border-paper-line bg-paper-shade/60 hover:bg-paper-shade',
                      )}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-lg uppercase tracking-[0.06em]">{p.name}</span>
                        {selected && <Check className="size-4 text-flash-red" />}
                      </div>
                      <p className="mt-1 text-[0.78rem] text-paper-muted">{p.blurb}</p>
                      <p className="mt-3 font-display text-2xl">
                        {money(planPrice(id, annual ? 'annual' : 'monthly'))}
                        <span className="ml-1 font-sans text-[0.72rem] font-normal normal-case tracking-normal text-paper-muted">/mo</span>
                      </p>
                      <p className="text-[0.7rem] text-paper-muted">
                        {annual ? `${money(annualTotal(id))} billed yearly` : 'Billed monthly'}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {p.features.map((f) => (
                          <li key={f.label} className="flex gap-2 text-[0.78rem] text-paper-ink">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-flash-red" />
                            <span>{f.label}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-paper-line pt-5">
            <Button
              type="button"
              variant="ghost-paper"
              className={cn(step === 1 && 'invisible')}
              onClick={() => updateUser({ onboardingStep: step - 1 })}
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            <Button type="submit" size="lg">
              {step < 4 ? <>Continue <ChevronRight className="size-4" /></> : 'Finish setup'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
