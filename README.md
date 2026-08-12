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
and walks 31 steps — signup through onboarding, venue filtering, map pins, both tier states
of the EPK generator, a press kit edited and downloaded as a real PDF, a send, the tracker,
the venue submission round trip, the admin CSV import — failing on any console
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

**The ground is a wall with bills pasted to it**, in four layers, none of which any
component has to know about:

| Layer | Where |
| --- | --- |
| Ink in four levels — `ink-deep` spine, `ink` top bar, `ink-ground`, `ink-raised` panels | `@theme` tokens |
| Two very wide washes, warm from above the fold, cool pooling bottom-right | `html` |
| Torn poster sheets at slight angles | `src/assets/paste-up.svg` via `body::before` |
| Fractal-noise grain over the lot | `body::after`, inline SVG |

Both overlays are `position: fixed; z-index: -1`, so they sit above the ground and below
every pixel of the app — paper surfaces stay clean. Nothing is fetched: the noise is an
inline data URI and Vite inlines `paste-up.svg` too. Keep app wrappers transparent, or an
opaque `bg-background` will cover the whole thing (which is exactly what it used to do).

Two components carry the aesthetic:

- **`Stamp`** — the signature element. Contact status printed as a rubber stamp, one ink per
  status, each tilted a few degrees by a hash of the venue id so it's consistent but never
  mechanical. "Not contacted" prints faint so contacted rooms pop. The same stamps carry the
  review states of a submitted venue — ochre "In review", dead grey "Not accepted".
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
| Booking email | `/send` | Linear six-step draft, tone presets, press kit PDF |
| Outreach (CRM) | `/outreach` | Stamped table, or a drag-and-drop board |
| Saved lists | `/lists` | Pro — route a run of dates |
| Plan & billing | `/pricing` | Basic / Pro, monthly or annual |
| Settings | `/settings` | Profile, outreach defaults, data |
| Admin | `/admin/*` | Venue DB, CSV import, submissions, users |

## Layout

```
src/
  index.css          palette, ground layers, fonts, .stamp and .stub classes
  assets/paste-up.svg  the torn bills pasted to the ink ground
  App.jsx            routes + auth guards
  components/
    AppShell.jsx     sidebar, top bar, account dialog
    Stamp.jsx        the signature status element
    VenueCard.jsx    the ticket stub
    PressKit.jsx     press kit preview, editor and usePressKit()
    ui/              shadcn/ui components (Radix + CVA)
  routes/            one file per screen
  store/store.js     all state, persistence and plan limits
  data/venues.js     Melbourne seed database
  lib/               cn(), formatting helpers
    epkDocument.js   the press kit as an editable document model
    epkPdf.js        that document rendered to a real PDF
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
| PDF press kit | — | ✓ |
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

## The press kit PDF

The booking email is short on purpose. The full pitch travels as a **PDF press kit**,
generated from the EPK, previewed and edited in the send flow, and attached to the email.

Three modules, each with one job:

| | |
| --- | --- |
| `src/lib/epkDocument.js` | The EPK's structured fields → an ordered run of titled text blocks. Pure, no browser, unit-tested. |
| `src/lib/epkPdf.js` | That document → a real PDF, in the product's own type. |
| `src/components/PressKit.jsx` | Preview, editor, and the `usePressKit()` hook the routes use. |

**Every block is plain text**, including the ones built from structured data — the rider
and the link list flatten to `Label — value` lines. One textarea per block is the whole
editing model, so an artist can write "Spotify — we're the loud one" instead of a bare URL.
Sections can be reworded, renamed, reordered or switched off; empty ones never print.
Edits save to the EPK, and **Rebuild from EPK** throws them away and re-derives.

The PDF is vector text with **Anton and Inter embedded** (the `.ttf` files in
`src/assets/fonts`, the same faces as the web build — jsPDF can't read the `.woff2`), so a
kit opens in the product's type on the booker's machine rather than falling back to
Helvetica. If you ever replace a font, regenerate its `.ttf` from the `.woff2`:

```bash
npx -y wawoff2 decompress src/assets/fonts/anton-400.woff2 src/assets/fonts/anton-400.ttf
``` Cover page on ink with the photo band and poster type; content pages on flash
paper with red section rules and a footer. jsPDF and the fonts are ~500KB together and are
**dynamically imported**, so the app only pays for them when a kit is actually built.

Sending snapshots the document onto the outreach record, exactly as the email body is
snapshotted — editing the EPK next month never rewrites what a venue was sent. The record
stores the document, not the bytes: a few hundred KB of PDF per send would exhaust the
localStorage quota, so **Outreach → a record → PDF** rebuilds that exact kit on demand.

Building a kit is a **Pro** capability, like the rest of the generator. Basic still attaches
a press kit made elsewhere (`uploadedFile`).

## Adding venues

An artist adding a venue picks where it lives. **Private** is theirs alone — live straight
away, never visible to another account. **Submit to the shared database** puts it in front of
an admin first, because the shared database is every subscriber's data and one bad row costs
everyone a wasted pitch.

A submitted venue sits at `status: 'pending'`, which `activeVenues()` excludes — so it stays
out of the venue list, the map, the send dropdown and the dashboard counts until it's
approved. **Your submissions** on the Venues page is what stops it looking like the venue
simply vanished: it shows the review stamp while the room is queued and the admin's reason if
it was declined.

In **Admin → Submissions** (sidebar-badged with the queue length), reviewing opens the whole
record. Approving publishes *the form*, not the submission — a good room with a missing email
is worth fixing rather than declining. Declining requires a reason and keeps the row rather
than deleting it, so the submitter finds out why instead of resending the same venue next
week. Both sides warn on a likely duplicate, matched on *name + suburb* against venues that
account can actually see.

The lifecycle lives in `src/store/store.js`: `addVenue(data, visibility)`,
`mySubmissions()`, `pendingSubmissions()`, `findDuplicateVenue()`, `approveVenue(id, patch)`,
`rejectVenue(id, reason)`, `dismissSubmission(id)`.

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
- **The press kit PDF is real** — it downloads, embeds the fonts and opens anywhere — but
  because sending is simulated, nothing physically attaches it to an email. A send provider
  would take the same blob from `generateEpkPdf()`.
- **The map is hand-drawn SVG**, not a tile map, so it works offline. It reads as a plot of
  Victoria rather than a street map.
- **No payments.** Choosing a plan switches the feature set only.
- **Auth is email-only and on-device** — enough to demo multi-user and admin.
