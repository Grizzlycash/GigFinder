import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPin, Send, Phone } from 'lucide-react';
import { state, signUp, signIn, PLANS } from '@/store/store';
import { activeVenues } from '@/store/store';
import { money } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Stamp } from '@/components/Stamp';

const SELLING_POINTS = [
  { icon: MapPin, title: 'Every room, one list', body: 'Melbourne venues with real booking contacts, capacities and submission rules.' },
  { icon: Send, title: 'The pitch writes itself', body: 'Your EPK bio becomes the email body, so every approach reads the same.' },
  { icon: Phone, title: 'Know who owes you', body: 'Emailed, opened, replied, booked — stamped across your whole list.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signup');
  const venueCount = state.venues.length;

  function handleSignUp(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email')).trim();
    if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      toast.error('That email already has an account', { description: 'Sign in instead.' });
      return;
    }
    signUp(email, String(form.get('artistName')).trim());
    navigate('/onboarding');
  }

  function handleSignIn(e) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    if (!signIn(email)) {
      toast.error('No account with that email on this device');
      return;
    }
    navigate('/dashboard');
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_minmax(0,26rem)]">
      {/* ---- Show bill ---- */}
      <section className="relative flex flex-col justify-center overflow-hidden px-6 py-14 lg:px-14">
        <div className="pointer-events-none absolute -left-16 top-1/2 hidden -translate-y-1/2 -rotate-90 font-display text-[9rem] leading-none tracking-[0.3em] text-bone/[0.035] lg:block">
          LIVE
        </div>

        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[2px] bg-flash-red font-display text-sm text-[#fbf7ec]">GF</span>
            <span className="font-display text-xl tracking-[0.08em] text-bone">GigFinder</span>
          </div>

          <p className="eyebrow mb-3 text-flash-red">Melbourne · {venueCount} rooms</p>
          <h1 className="max-w-2xl text-[clamp(2.6rem,7vw,4.75rem)] leading-[0.92] text-bone">
            Find the room.
            <br />
            Send the pitch.
            <br />
            <span className="text-flash-red">Play the show.</span>
          </h1>

          <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-bone-muted">
            A working tool for gigging musicians — the venue list, the booking email and the
            follow-up, in one place. No spreadsheet, no guesswork about who replied.
          </p>

          <div className="mt-9 max-w-md space-y-4 border-t border-ink-line pt-7">
            {SELLING_POINTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-flash-red" />
                <div>
                  <p className="font-display uppercase tracking-[0.08em] text-[0.82rem] text-bone">{title}</p>
                  <p className="text-[0.82rem] leading-relaxed text-bone-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Stamp status="booked" seed="landing" size="lg" />
            <p className="text-[0.78rem] text-bone-muted">{`Basic ${money(PLANS.basic.monthly)}/mo · Pro ${money(PLANS.pro.monthly)}/mo · 20% off annually`}</p>
          </div>
        </div>
      </section>

      {/* ---- Paper form ---- */}
      <section className="flex items-center justify-center border-t border-ink-line bg-ink-raised px-5 py-12 lg:border-l lg:border-t-0">
        <div className="w-full max-w-sm rounded-[3px] border border-paper-line bg-paper p-6 text-paper-ink">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="w-full">
              <TabsTrigger value="signup" className="flex-1">Create account</TabsTrigger>
              <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <h2 className="text-xl">Start booking</h2>
                <p className="-mt-2 text-[0.8rem] text-paper-muted">Four short steps and you can send your first pitch.</p>
                <div className="space-y-1.5">
                  <Label htmlFor="su-artist">Artist or band name</Label>
                  <Input id="su-artist" name="artistName" required placeholder="e.g. The Rustlers" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <Button type="submit" size="lg" className="w-full">Create account</Button>
                <p className="text-[0.72rem] text-paper-muted">No card needed — you pick a plan at the end of setup.</p>
              </form>
            </TabsContent>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <h2 className="text-xl">Welcome back</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" required placeholder="you@example.com" />
                </div>
                <Button type="submit" size="lg" className="w-full">Sign in</Button>
                {state.users.length > 0 ? (
                  <p className="text-[0.72rem] text-paper-muted">
                    On this device:{' '}
                    {state.users.map((u, i) => (
                      <span key={u.id}>
                        {i > 0 && ', '}
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-flash-red"
                          onClick={() => { signIn(u.email); navigate('/dashboard'); }}
                        >
                          {u.email}
                        </button>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-[0.72rem] text-paper-muted">No accounts on this device yet — create one first.</p>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
