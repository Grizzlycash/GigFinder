# GigFinder

Venue discovery, booking emails and outreach tracking for gigging musicians — built around a
database of Melbourne live music rooms.

**Picking this up after a break?** `docs/handover.md` has the current state, the decisions
already made, and the open questions.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # builds, then drives the whole app in Chromium
```

React + Vite + Tailwind v4 + shadcn/ui. `npm test` builds the production bundle, serves it,
and walks 21 steps — signup through onboarding, venue filtering, map pins, both tier states
of the EPK generator, a real send, the tracker, the admin CSV import — failing on any console
or page error. It also asserts there's a visible keyboard focus ring and no horizontal
overflow on mobile. Screenshots land in `test/screenshots/` (gitignored). Playwright is
needed for the test only: `npm i -D playwright && npx playwright install chromium`.

## Design

The look is governed by **`docs/design-brief.md`** — gig poster meets tattoo flash sheet. The
short version:

| | |
| --- | --- |
| Ink (ground) | `#12151C` |
| Flash paper (surfaces) | `#F6F1E3` |
| Flash red (primary) | `#B23A2E` |
| Flash green (success) | `#3C6E52` |
| Display type | Anton — headings and venue names only |
| Body type | Inter — lists, forms, data |

Everything lives in `src/index.css`: the palette as Tailwind v4 `@theme` tokens, plus the
shadcn variable contract (`--background`, `--card`, `--primary`…) mapped onto it, so
components follow the palette automatically. Fonts are self-hosted in `src/assets/fonts` —
no CDN, works offline.

Two components carry the aesthetic:

- **`Stamp`** — the signature element. Contact status printed as a rubber stamp, one ink per
  status, each tilted a few degrees by a hash of the venue id so it's consistent but never
  mechanical. "Not contacted" prints faint so contacted rooms pop.
- **`VenueCard`** — a venue as a ticket stub: perforated left edge, paper stock, name in
  poster type, dashed rule above the genre/pay footer.

## Screens

| Screen | Route | Notes |
| --- | --- | --- |
| Landing / sign in | `/` | Show-bill hero + paper form card |
| Onboarding | `/onboarding` | Four steps: act → links → bio → plan |
| Dashboard | `/dashboard` | Tiles, recent outreach, follow-ups, coverage |
| Venues | `/venues`, `/venues/:id` | Flash-sheet card list + detail panel |
| Map | `/map` | Clustered pins in stamp inks, nearby rooms |
| EPK generator | `/epk`, `/epk/:id` | Section rail: bio, photos, music, socials, rider |
| Booking email | `/send` | Linear six-step draft, three tone presets |
| Outreach (CRM) | `/outreach` | Stamped table, or a drag-and-drop board |
| Saved lists | `/lists` | Pro — route a run of dates |
| Plan & billing | `/pricing` | Basic / Pro, monthly or annual |
| Settings | `/settings` | Profile, outreach defaults, data |
| Admin | `/admin/*` | Venue DB, CSV import, submissions, users |

## Layout

```
src/
  index.css          palette, fonts, .stamp and .stub component classes
  App.jsx            routes + auth guards
  components/
    AppShell.jsx     sidebar, top bar, account dialog
    Stamp.jsx        the signature status element
    VenueCard.jsx    the ticket stub
    ui/              shadcn/ui components (Radix + CVA)
  routes/            one file per screen
  store/store.js     all state, persistence and plan limits
  data/venues.js     Melbourne seed database
  lib/               cn(), formatting helpers
test/smoke.mjs       end-to-end browser suite
docs/design-brief.md the visual brief — source of truth for the look
docs/handover.md     state, decisions, open questions
docs/product-spec.md behaviour spec
docs/mockups/        earlier HTML mockups (superseded by the brief)
```

## Subscription tiers

|  | Basic | Pro |
| --- | --- | --- |
| Monthly | $9.99 AUD | $19.99 AUD |
| Annual (20% off) | $7.99/mo | $15.99/mo |
| Venue database + map | ✓ | ✓ |
| Booking emails | 15 / month | Unlimited |
| Outreach tracking | ✓ | ✓ |
| Upload your own EPK | ✓ | ✓ |
| Add private venues | ✓ | ✓ |
| EPK generator | Bio only | Full |
| Follow-up reminders, saved lists, CSV export, analytics | — | ✓ |

Basic keeps the generator's **Biography** section even though the generator is a Pro feature:
the booking email is written from its short bio, so locking it would break the core flow for
a paying user. Limits live in one place (`plan()`, `can()`, `sendsRemaining()` in
`src/store/store.js`). Prices are in **AUD** — `money()` in `src/lib/format.js` formats
everything through `Intl.NumberFormat('en-AU')`, so changing currency is one line.

## Drafting the booking email

`src/lib/draft.js` is the seam between "the app writes the email" and "a model writes the
email". Today everything runs on-device; connecting a backend is one function call.

**The privacy boundary is the point of the module.** The booking contact's name and email
address never enter the payload — they belong to a third party who never agreed to be
processed by a model vendor. Drafts carry a literal `{contact}` placeholder and the browser
substitutes the real name for display only. Editing the draft and then rewriting it
re-redacts first, so a name typed into the body can't escape either. `test/draft.test.mjs`
asserts all of this; it fails if someone widens the payload without meaning to.

The artist's bio *is* sent (when a provider is connected) — it's their own marketing copy,
written to be read by strangers.

To connect a real model, register a provider once at startup:

```js
import { setDraftProvider } from '@/lib/draft';

setDraftProvider(async ({ payload, action, tone, text, signal }) => {
  const res = await fetch('/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload, action, tone, text }),
    signal,
  });
  if (!res.ok) throw new Error(`draft failed: ${res.status}`);
  return (await res.json()).text;   // must keep {contact} intact
});
```

Your backend holds the API key — never this bundle. If the provider is absent, errors or
returns empty, drafting falls back to the deterministic on-device version, so the app keeps
working offline and when the model is down. Results are cached per venue + bio + action, and
the cache clears when the provider changes.

Rewrites (`Tighten`, `Warm it up`, `Shorten`, `Personalise`) act on the draft that already
exists rather than generating from scratch — consistency is the product's promise, and the
first draft should never be a dice roll. They're gated to Pro (`can('aiRewrite')`).

## Data

State is in `localStorage` under `gigfinder:v1` — nothing leaves the browser. `store.js` is
the only module that touches persistence, so swapping it for API calls is the single change
needed to move to a real backend.

**The seeded venues are fictional.** Names, contacts and addresses are invented and every
email uses the reserved `example.com` domain. The real 222-venue spreadsheet replaces them
via **Admin → Import spreadsheet**, which reads a CSV, guesses the column mapping from the
headers, previews the rows, and de-duplicates on *name + suburb* so re-imports update rather
than duplicate.

## Deploying

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on push. Set **Settings →
Pages → Source: GitHub Actions** once, and it deploys to
`https://grizzlycash.github.io/GigFinder/`. The build uses `base: './'`, so it also works
from any subpath or a plain static host.

## Known prototype boundaries

- **Sending is simulated.** An outreach record with its own copy of the email is written; no
  email provider is contacted.
- **The draft is generated locally, not by an AI call.** Tone presets reshape the framing
  around the artist's own bio; nothing is sent to a model. Wiring in a real generator means
  replacing `composeBody()` in `src/routes/SendEpk.jsx`.
- **The map is hand-drawn SVG**, not a tile map, so it works offline. It reads as a plot of
  Victoria rather than a street map.
- **No payments.** Choosing a plan switches the feature set only.
- **Auth is email-only and on-device** — enough to demo multi-user and admin.
