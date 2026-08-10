import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, Image as ImageIcon, Music, Globe, SlidersHorizontal, Check, Lock,
  Eye, ChevronLeft, ChevronRight, Plus, Trash2, Send, Upload,
} from 'lucide-react';
import { epkById, updateEpk, currentUser, normaliseEpk, epkProgress, can, isPro, PLANS } from '@/store/store';
import { ALL_GENRES } from '@/data/venues';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uid, money } from '@/lib/format';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'bio', label: 'Biography', icon: User, pro: false },
  { id: 'photos', label: 'Photos', icon: ImageIcon, pro: true },
  { id: 'music', label: 'Music links', icon: Music, pro: true },
  { id: 'socials', label: 'Socials', icon: Globe, pro: true },
  { id: 'rider', label: 'Tech rider', icon: SlidersHorizontal, pro: true },
];

const MUSIC_FIELDS = [['spotify', 'Spotify'], ['soundcloud', 'SoundCloud'], ['appleMusic', 'Apple Music'], ['youtube', 'YouTube'], ['bandcamp', 'Bandcamp']];
const SOCIAL_FIELDS = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['x', 'X / Twitter'], ['website', 'Website']];

export default function EpkEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = currentUser();
  const stored = epkById(id);
  const [draft, setDraft] = useState(() => (stored ? JSON.parse(JSON.stringify(normaliseEpk(stored))) : null));
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(false);
  const photoInput = useRef(null);

  useEffect(() => {
    if (stored && (!draft || draft.id !== stored.id)) setDraft(JSON.parse(JSON.stringify(normaliseEpk(stored))));
  }, [stored?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(() => epkProgress(draft), [draft]);
  const generator = can('epkGenerator');

  if (!draft) {
    return (
      <AppShell title="My EPK">
        <Card className="mx-auto max-w-md"><CardContent className="py-10 text-center">
          <p className="text-[0.9rem] text-paper-muted">That EPK doesn't exist.</p>
          <Button asChild className="mt-3"><Link to="/epk">Back to your EPKs</Link></Button>
        </CardContent></Card>
      </AppShell>
    );
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setIn = (group, key, value) => setDraft((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));

  function persist(message) {
    updateEpk(draft.id, {
      title: draft.title, tagline: draft.tagline, shortBio: draft.shortBio, longBio: draft.longBio,
      notable: draft.notable, genres: draft.genres, homeCity: draft.homeCity, setLength: draft.setLength,
      audienceSize: draft.audienceSize, music: draft.music, socials: draft.socials, rider: draft.rider,
      photos: draft.photos, uploadedFile: draft.uploadedFile,
      tracks: (draft.tracks || []).filter((t) => t.title || t.url),
      pressQuotes: (draft.pressQuotes || []).filter((q) => q.text),
    });
    if (message) toast.success(message);
  }

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { toast.error('Please pick an image under 1.5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, photos: [...(d.photos || []), { id: uid('img'), src: String(reader.result), label: file.name }] }));
    reader.readAsDataURL(file);
  }

  const section = SECTIONS[index];
  const locked = section.pro && !generator;

  return (
    <AppShell title="My EPK" subtitle={draft.title} flush>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---- Section rail ---- */}
        <aside className="shrink-0 border-b border-ink-line bg-ink-raised lg:w-56 lg:border-b-0 lg:border-r">
          <div className="hidden border-b border-ink-line p-4 lg:block">
            <p className="font-display uppercase tracking-[0.08em] text-bone">Press kit</p>
            <Progress value={Math.round((progress.count / progress.total) * 100)} className="mt-2.5 bg-ink-hover" />
            <p className="mt-1.5 text-[0.7rem] text-bone-muted">{progress.count} of {progress.total} sections complete</p>
          </div>

          <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon;
              const done = progress.done[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { persist(); setIndex(i); }}
                  data-section={i}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left font-display uppercase tracking-[0.08em] text-[0.78rem]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red lg:w-full',
                    i === index ? 'bg-ink-hover text-bone shadow-[inset_2px_0_0_var(--color-flash-red)]' : 'text-bone-muted hover:bg-ink-hover hover:text-bone',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{s.label}</span>
                  {s.pro && !generator
                    ? <Lock className="size-3.5 shrink-0 text-bone-muted/70" />
                    : done
                      ? <Check className="size-3.5 shrink-0 text-flash-green" />
                      : <span className="size-3.5 shrink-0 rounded-full border border-ink-line-strong" />}
                </button>
              );
            })}
          </nav>

          <div className="hidden p-3 lg:block">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => { persist(); setPreview(true); }} data-preview>
              <Eye className="size-4" /> Preview EPK
            </Button>
          </div>
        </aside>

        {/* ---- Form ---- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-line px-4 py-2.5">
            <Button variant="ghost" size="sm" asChild><Link to="/epk"><ChevronLeft className="size-4" /> All EPKs</Link></Button>
            <span className="flex-1" />
            {section.pro && <span className="stamp hidden sm:inline-flex" style={{ color: 'var(--color-flash-red)', borderColor: 'var(--color-flash-red)' }}>Pro feature</span>}
            <Button variant="secondary" size="sm" asChild><Link to={`/send?epk=${draft.id}`}><Send className="size-4" /> Use it</Link></Button>
            <Button size="sm" onClick={() => persist('Section saved')} data-save>Save</Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
            {locked ? (
              <Card className="mx-auto max-w-lg">
                <CardContent className="py-12 text-center">
                  <Lock className="mx-auto size-6 text-flash-red" />
                  <h2 className="mt-3 text-xl">{section.label} is part of the Pro generator</h2>
                  <p className="mx-auto mt-2 max-w-sm text-[0.85rem] text-paper-muted">
                    Pro builds the full kit — photos, music links, socials and a tech rider — and keeps unlimited kits.
                  </p>
                  <Button asChild className="mt-4"><Link to="/pricing">See Pro — {money(PLANS.pro.monthly)}/mo</Link></Button>
                </CardContent>
              </Card>
            ) : (
              <div className="mx-auto max-w-2xl space-y-3">
                {section.id === 'bio' && (
                  <>
                    <Card><CardContent className="space-y-4 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="e-title">EPK title</Label>
                          <Input id="e-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="e-city">Based in</Label>
                          <Input id="e-city" value={draft.homeCity} onChange={(e) => set({ homeCity: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="e-tag">Tagline</Label>
                        <Input id="e-tag" maxLength={90} value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="One line a booker could paste into a listing" />
                      </div>
                      <div className="space-y-2">
                        <Label>Genre tags</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[...new Set([...ALL_GENRES, ...(draft.genres || [])])].map((g) => {
                            const on = (draft.genres || []).includes(g);
                            return (
                              <button
                                key={g}
                                type="button"
                                aria-pressed={on}
                                onClick={() => set({ genres: on ? draft.genres.filter((x) => x !== g) : [...(draft.genres || []), g] })}
                                className={cn(
                                  'rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem]',
                                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
                                  on ? 'border-flash-red bg-flash-red text-[#fbf7ec]' : 'border-paper-line text-paper-muted hover:bg-paper-shade',
                                )}
                              >
                                {g}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="e-set">Typical set length</Label>
                          <Select value={draft.setLength} onValueChange={(v) => set({ setLength: v })}>
                            <SelectTrigger id="e-set"><SelectValue /></SelectTrigger>
                            <SelectContent>{['30 minutes', '45 minutes', '60 minutes', '90 minutes', '120 minutes'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="e-aud">Typical audience</Label>
                          <Select value={draft.audienceSize} onValueChange={(v) => set({ audienceSize: v })}>
                            <SelectTrigger id="e-aud"><SelectValue /></SelectTrigger>
                            <SelectContent>{['Under 50', '50–150', '150–300', '300–600', '600+'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent></Card>

                    <Card><CardContent className="space-y-4 p-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="e-short">Short bio <span className="normal-case tracking-normal text-paper-muted/80">(writes your booking emails)</span></Label>
                        <Textarea id="e-short" rows={5} maxLength={700} value={draft.shortBio} onChange={(e) => set({ shortBio: e.target.value })} />
                        <p className="text-right text-[0.7rem] text-paper-muted">{draft.shortBio.length} / 700</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="e-long">Full biography</Label>
                        <Textarea id="e-long" rows={6} value={draft.longBio} onChange={(e) => set({ longBio: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="e-notable">Notable shows / press</Label>
                        <Textarea id="e-notable" rows={3} value={draft.notable} onChange={(e) => set({ notable: e.target.value })} placeholder="Residencies, supports, radio play, reviews…" />
                      </div>
                    </CardContent></Card>

                    {!isPro() && (
                      <Card><CardContent className="p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Upload className="size-4 text-flash-red" />
                          <p className="font-display uppercase tracking-[0.06em] text-[0.9rem]">Upload your own EPK</p>
                        </div>
                        {draft.uploadedFile ? (
                          <div className="flex items-center gap-3 rounded-[3px] border border-paper-line bg-paper-shade/70 p-2.5">
                            <span className="min-w-0 flex-1 truncate text-[0.82rem]">{draft.uploadedFile.name} <span className="text-paper-muted">({draft.uploadedFile.size})</span></span>
                            <Button variant="destructive" size="icon-sm" aria-label="Remove" onClick={() => set({ uploadedFile: null })}><Trash2 className="size-3.5" /></Button>
                          </div>
                        ) : (
                          <Input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) { set({ uploadedFile: { name: f.name, size: `${Math.round(f.size / 1024)} KB` } }); toast.success('Press kit attached'); }
                            }}
                          />
                        )}
                        <p className="mt-2 text-[0.72rem] text-paper-muted">Basic sends a kit you made elsewhere. The full generator comes with Pro.</p>
                      </CardContent></Card>
                    )}
                  </>
                )}

                {section.id === 'photos' && (
                  <Card><CardContent className="p-4">
                    <p className="mb-3 text-[0.82rem] text-paper-muted">Up to 6 photos. The first is the cover image.</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const p = draft.photos?.[i];
                        return p ? (
                          <div key={p.id} className="relative aspect-square overflow-hidden rounded-[3px] border border-paper-line">
                            <img src={p.src} alt="" className="size-full object-cover" />
                            <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-1.5 py-1 text-center text-[0.62rem] text-bone">{i === 0 ? 'Cover' : `Photo ${i + 1}`}</span>
                            <Button variant="destructive" size="icon-sm" className="absolute right-1 top-1 bg-paper" aria-label="Remove" onClick={() => set({ photos: draft.photos.filter((x) => x.id !== p.id) })}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            key={`slot-${i}`}
                            type="button"
                            onClick={() => photoInput.current?.click()}
                            className="grid aspect-square place-items-center rounded-[3px] border border-dashed border-paper-line bg-paper-shade/60 text-paper-muted hover:border-flash-red hover:text-flash-red focus-visible:outline-2 focus-visible:outline-flash-red"
                          >
                            <Plus className="size-5" />
                          </button>
                        );
                      })}
                    </div>
                    <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                  </CardContent></Card>
                )}

                {section.id === 'music' && (
                  <>
                    <Card><CardContent className="space-y-3 p-4">
                      {MUSIC_FIELDS.map(([key, label]) => (
                        <div key={key} className="flex items-center gap-3">
                          <Label className="w-24 shrink-0">{label}</Label>
                          <Input value={draft.music[key] || ''} onChange={(e) => setIn('music', key, e.target.value)} data-link={`music.${key}`} />
                        </div>
                      ))}
                    </CardContent></Card>
                    <Card><CardContent className="space-y-3 p-4">
                      <p className="font-display uppercase tracking-[0.06em] text-[0.9rem]">Featured tracks</p>
                      {(draft.tracks || []).map((t, i) => (
                        <div key={t.id || i} className="flex flex-wrap items-center gap-2">
                          <Input className="max-w-48" value={t.title} placeholder="Track title" data-track-title={i}
                            onChange={(e) => set({ tracks: draft.tracks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                          <Input className="min-w-40 flex-1" value={t.url} placeholder="https://…" data-track-url={i}
                            onChange={(e) => set({ tracks: draft.tracks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                          <Button variant="destructive" size="icon-sm" aria-label="Remove" onClick={() => set({ tracks: draft.tracks.filter((_, j) => j !== i) })}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="paper" size="sm" onClick={() => set({ tracks: [...(draft.tracks || []), { id: uid('trk'), title: '', url: '' }] })} data-add-track>
                        <Plus className="size-3.5" /> Add track
                      </Button>
                    </CardContent></Card>
                  </>
                )}

                {section.id === 'socials' && (
                  <>
                    <Card><CardContent className="space-y-3 p-4">
                      {SOCIAL_FIELDS.map(([key, label]) => (
                        <div key={key} className="flex items-center gap-3">
                          <Label className="w-24 shrink-0">{label}</Label>
                          <Input value={draft.socials[key] || ''} onChange={(e) => setIn('socials', key, e.target.value)} data-link={`socials.${key}`} />
                        </div>
                      ))}
                    </CardContent></Card>
                    <Card><CardContent className="space-y-3 p-4">
                      <p className="font-display uppercase tracking-[0.06em] text-[0.9rem]">Press quotes</p>
                      {(draft.pressQuotes || []).map((q, i) => (
                        <div key={q.id || i} className="flex flex-wrap items-center gap-2">
                          <Input className="min-w-40 flex-1" value={q.text} placeholder="“They played like the room owed them money.”"
                            onChange={(e) => set({ pressQuotes: draft.pressQuotes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                          <Input className="max-w-40" value={q.source} placeholder="Source"
                            onChange={(e) => set({ pressQuotes: draft.pressQuotes.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })} />
                          <Button variant="destructive" size="icon-sm" aria-label="Remove" onClick={() => set({ pressQuotes: draft.pressQuotes.filter((_, j) => j !== i) })}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="paper" size="sm" onClick={() => set({ pressQuotes: [...(draft.pressQuotes || []), { id: uid('prq'), text: '', source: '' }] })}>
                        <Plus className="size-3.5" /> Add quote
                      </Button>
                    </CardContent></Card>
                  </>
                )}

                {section.id === 'rider' && (
                  <Card><CardContent className="space-y-4 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="r-format">Performance format</Label>
                        <Select value={draft.rider.format} onValueChange={(v) => setIn('rider', 'format', v)}>
                          <SelectTrigger id="r-format"><SelectValue /></SelectTrigger>
                          <SelectContent>{['Solo acoustic', 'Duo', 'Trio', 'Full band', 'Solo with backing track'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="r-pa">PA required</Label>
                        <Select value={draft.rider.pa} onValueChange={(v) => setIn('rider', 'pa', v)}>
                          <SelectTrigger id="r-pa"><SelectValue /></SelectTrigger>
                          <SelectContent>{['Yes — venue to provide', 'No — self-contained', 'Flexible'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {[['mics', 'Microphones', '2 × vocal, 1 × instrument'], ['di', 'DI boxes', '1 × DI'], ['monitors', 'Monitors', '2 × floor wedge']].map(([k, label, ph]) => (
                        <div key={k} className="space-y-1.5">
                          <Label htmlFor={`r-${k}`}>{label}</Label>
                          <Input id={`r-${k}`} value={draft.rider[k]} placeholder={ph} onChange={(e) => setIn('rider', k, e.target.value)} />
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <Label htmlFor="r-setup">Setup time</Label>
                        <Select value={draft.rider.setupTime} onValueChange={(v) => setIn('rider', 'setupTime', v)}>
                          <SelectTrigger id="r-setup"><SelectValue /></SelectTrigger>
                          <SelectContent>{['15 minutes', '30 minutes', '45 minutes', '60 minutes'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="r-notes">Additional notes</Label>
                      <Textarea id="r-notes" rows={3} value={draft.rider.notes} onChange={(e) => setIn('rider', 'notes', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="r-hosp">Hospitality</Label>
                      <Input id="r-hosp" value={draft.rider.hospitality} onChange={(e) => setIn('rider', 'hospitality', e.target.value)} placeholder="Meal or drinks tab, parking…" />
                    </div>
                  </CardContent></Card>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink-line px-4 py-2.5">
            <span className="text-[0.75rem] text-bone-muted">Section {index + 1} of {SECTIONS.length}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => { persist(); setPreview(true); }}>
                <Eye className="size-4" /> Preview
              </Button>
              <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => { persist(); setIndex(index - 1); }}>
                <ChevronLeft className="size-4" /> Back
              </Button>
              {index === SECTIONS.length - 1 ? (
                <Button size="sm" onClick={() => { persist('EPK saved'); navigate('/epk'); }}>Finish</Button>
              ) : (
                <Button size="sm" onClick={() => { persist(); setIndex(index + 1); }}>
                  Next: {SECTIONS[index + 1].label} <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Preview ---- */}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>EPK preview</DialogTitle></DialogHeader>
          <div className="-mx-5 -mb-5 border-t border-paper-line">
            <div className="bg-ink px-5 py-6 text-bone">
              <h2 className="text-3xl leading-none">{draft.title || user.artistName}</h2>
              <p className="mt-1.5 text-[0.85rem] text-bone-muted">{draft.tagline || 'No tagline yet'}</p>
            </div>
            <div className="space-y-4 px-5 py-5 text-[0.85rem] leading-relaxed">
              {draft.photos?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {draft.photos.slice(0, 3).map((p) => (
                    <img key={p.id} src={p.src} alt="" className="aspect-square rounded-[2px] border border-paper-line object-cover" />
                  ))}
                </div>
              )}
              <section><p className="eyebrow text-paper-muted">Bio</p><p className="mt-1">{draft.shortBio || 'No short bio yet.'}</p></section>
              {draft.longBio && <section><p className="eyebrow text-paper-muted">More</p><p className="mt-1">{draft.longBio}</p></section>}
              <section>
                <p className="eyebrow text-paper-muted">Details</p>
                <p className="mt-1 text-paper-muted">
                  {draft.homeCity || '—'} · {(draft.genres || []).join(', ') || 'No genres'} · {draft.setLength} set · draws {draft.audienceSize}
                </p>
              </section>
              {draft.notable && <section><p className="eyebrow text-paper-muted">Notable</p><p className="mt-1">{draft.notable}</p></section>}
              {draft.tracks?.some((t) => t.url) && (
                <section>
                  <p className="eyebrow text-paper-muted">Listen</p>
                  {draft.tracks.filter((t) => t.url).map((t) => <p key={t.id} className="mt-1 truncate">{t.title || 'Untitled'} — <span className="text-paper-muted">{t.url}</span></p>)}
                </section>
              )}
              <section>
                <p className="eyebrow text-paper-muted">Links</p>
                {[...Object.entries(draft.music), ...Object.entries(draft.socials)].filter(([, v]) => v).map(([k, v]) => (
                  <p key={k} className="mt-1 truncate capitalize">{k}: <span className="text-paper-muted">{v}</span></p>
                )) }
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
