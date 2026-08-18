# Where GigBook stands

Last updated: 12 August 2026 (test-round prep). Branch: `claude/gigbook-web-app-6tpcs3`.

Read this first when picking the project back up — state, decisions already made, and the
questions still open.

## Running it

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # builds, then drives the whole app in Chromium (37 steps)
```

Stack: React + Vite + Tailwind v4 + shadcn/ui, hash routing, state in `localStorage`.

**Hosting is moving** — see `docs/hosting.md`. The beta runs on Cloudflare Pages behind
Cloudflare Access on gigbook.com.au, because a login can't be enforced on a static file host.
The old GitHub Pages workflow (`.github/workflows/pages.yml`, publishing to
`https://grizzlycash.github.io/GigFinder/`) stays until the cut-over, then gets switched off.

## What happened in this session

The app was rebuilt from scratch on React + Tailwind + shadcn/ui and restyled to
`docs/design-brief.md` (gig poster / tattoo flash sheet), replacing the previous
zero-dependency vanilla build and its dark blue-grey theme, and reseeded with Melbourne
venues. It was briefly renamed GigBook during that round and renamed back to GigBook once
the domain was registered — if you find a stray "GigBook" anywhere, that's where it's from.

The store, plan limits, CSV import and pipeline logic were ported across rather than
rewritten — that logic was already proven, so only the presentation layer is new.

## The press kit PDF (latest round)

Outreach now has two halves: the short introduction email, and a **generated PDF press kit**
attached to it. `src/lib/epkDocument.js` turns the EPK's fields into an ordered run of
editable text blocks; `src/lib/epkPdf.js` prints that to a real PDF with Anton and Inter
embedded; `src/components/PressKit.jsx` is the preview, the editor and the `usePressKit()`
hook. Step 6 of the send flow previews it, edits it and downloads it, and the outreach
record keeps the document as sent so it can rebuild that exact PDF later.

Calls made while building it:
- **Blocks are plain text, even the structured ones.** The rider and link lists flatten to
  `Label — value` lines, so editing is one textarea per block rather than a second form.
- **Edits save to the EPK, not to the send.** Consistency is the product's promise; a
  per-send override would be a second source of truth. "Rebuild from EPK" is the escape hatch.
- **The record stores the document, not the bytes.** A few hundred KB of PDF per send would
  exhaust the localStorage quota, so the PDF is rebuilt on demand from the snapshot.
- **Fonts are embedded** (`src/assets/fonts/*.ttf`, decompressed from the `.woff2` the web
  build uses — jsPDF can't read woff2). Without them the kit prints in Helvetica on the
  booker's machine, which is a different product.
- **Building a kit is Pro**, like the rest of the generator; Basic still attaches its own
  file. One line in `store.js` (`can('epkGenerator')`) if you want that split elsewhere.
- jspdf and the fonts (~500KB) are **dynamically imported**, so the app only loads them when
  a kit is actually built.

## Decisions already made

**Design** — all from the brief, plus a few judgement calls it didn't cover:
- Six stamp inks, one per status: grey not contacted, ochre emailed, blue opened, red
  replied, green booked, dead grey passed. Green = success and red = attention, matching the
  brief's roles for the two flash colours.
- "Sent" was renamed **"Emailed"** throughout, to match the brief's status vocabulary.
- The default "Not contacted" stamp prints faint, or it drowns out the ones that matter.
- Admin keeps the same chrome but switches its accent to the ochre ink and stamps ADMIN under
  the wordmark — a separate colour scheme wasn't needed once everything was already dark.
- Fonts are self-hosted, not loaded from Google, so the app works offline.

**Product** (unchanged from earlier rounds):
- Basic $9.99 AUD (15 emails/month), Pro $19.99 AUD, 20% off annually. The price points were
  kept and re-denominated rather than converted from USD — they're chosen numbers, not a
  conversion.
- Basic keeps the EPK generator's Biography section, because the booking email is written
  from its short bio.
- Venues added by a subscriber are either private, or submitted to the shared database for
  admin approval. Three calls on the review flow, made when it was built out properly:
  a declined submission is **kept, not deleted**, with a required reason the submitter sees —
  otherwise the same venue comes back next week; **approve publishes the admin's edited
  form**, so a useful room with a missing email is corrected rather than bounced; and
  duplicates are flagged on both sides, matched on name + suburb against venues that account
  can see (never another user's private rows).

## Handing it to testers

See `docs/test-round.md`. The app now says what it is — a first-run notice, a sidebar stamp
and a line by the send button — because sending is convincing enough that a tester could
believe they had emailed a venue. Testers export their round as JSON and send it back;
there's no backend, so that file is the only way to see what they did.

Behind Access, `src/lib/access.js` reads the email Cloudflare already verified and signs that
tester straight in, so they see one login rather than two. It no-ops anywhere else.

`src/config.js` is the whole switchboard: `PROTOTYPE`, `FEEDBACK_EMAIL` (empty by default —
this repo is public and addresses get scraped; empty means the feedback button copies to the
clipboard instead) and `BUILD_LABEL`.

**Venue data.** `src/data/venues.js` is now the real database — 222 Victorian rooms,
generated from the spreadsheet by `scripts/import-venues.mjs`. Don't hand-edit it; re-run the
importer and commit. The fictional generator (invented names, `example.com` addresses, made-up
booking contacts) is gone entirely.

Two things the real data exposed that the fictional set never did: a venue at 0,0 rendered a
literal `0` in the detail panel (`{(venue.lat || venue.lng) && …}` — a falsy number is not
nothing in JSX), and 43 rooms have no booking email at all, so the send flow now defaults to
a room you can actually write to and says so when there isn't one.

**14 venues are entered twice** in the spreadsheet, with conflicting emails and capacities.
The importer reports them rather than merging: choosing between two booking addresses chooses
who gets pitched. Fix the spreadsheet and re-run.

## Open questions

1. **Connect a model provider when you have a backend.** The seam is built
   (`src/lib/draft.js`); rewrites currently run on-device. Decision taken: the artist's bio
   may be sent, the booking contact's name and email may not — they're a third party's
   personal information. See the README section for the `setDraftProvider()` contract. Still
   to do on your side: the endpoint, the provider's zero-retention/no-training settings, a
   rate limit, and a line in the privacy policy. Rewrites are gated to Pro but deliberately
   **not advertised on the pricing cards** until a model is actually connected.
2. **Venue coordinates.** The real 222-venue database is in (`src/data/venues.js`, generated
   by `scripts/import-venues.mjs`), but **no row has coordinates**, so the Map screen is
   empty. Geocoding is blocked from the build sandbox; run it once on your own machine:
   `node scripts/import-venues.mjs <csv> --geocode`, then commit the regenerated file.
   Do this before a test round — an empty Map is a whole nav item showing nothing.
3. **Unadvertised Pro features.** Saved lists, CSV export and analytics work but aren't
   listed on the pricing cards, because the pricing mockup didn't list them.
4. **GST.** Prices are now AUD but say nothing about GST. Australian SaaS usually states
   "incl. GST" — worth confirming with your accountant before the copy claims either way.
5. **Should the PDF press kit be advertised on the pricing cards?** It's a concrete Pro
   capability and probably the most sellable one, but the cards still list what the pricing
   mockup listed. Same open question as saved lists and CSV export.
6. **Onboarding, pricing, settings and admin weren't in the brief's scope list** — they follow
   the same design language, but they haven't been designed against a brief the way the four
   named screens were.

## Known prototype boundaries

- Sending is simulated — the outreach record keeps its own copy of the email and of the press
  kit document, but no provider is contacted. The PDF itself is real and downloads; nothing
  physically attaches it to an email until there's a send provider.
- Drafts are generated locally; there is no AI call.
- The map is hand-drawn SVG, not a tile map, so it works offline; dense inner-suburb pins
  cluster into numbered markers that split as you zoom.
- No payments; choosing a plan just switches the feature set.
- Auth is email-only and on-device.

## Bugs already fixed (don't reintroduce)

- Map pins were unselectable because `setPointerCapture` on drag retargets the following
  `click` to the `<svg>`. Panning uses window listeners instead, and `npm test` asserts a pin
  click opens the side panel.
- Melbourne's density meant inner-suburb pins covered each other and could never be clicked —
  hence clustering.
- Venues with no coordinates stretched the map projection; they're excluded from the map.
- The dashboard greeted the band name's first word ("Good morning, The"); it uses the contact
  name.
- The press kit's PHOTOS heading printed at the foot of a page with its photos overleaf.
  `Sheet.heading()` takes a `keepWith` height so a heading never separates from its content.
- The cover's red rule printed *behind* the headline: jsPDF's `text()` y is a baseline, so
  the block grows upward. The cover is laid out bottom-up now, and the rule clears the caps.

## Sandbox note

`npx shadcn add` can't reach `ui.shadcn.com` from this environment (proxy returns 403), so
`src/components/ui/` was hand-vendored in the same style on the same Radix + CVA primitives.
The components match the shadcn API, so `npx shadcn add <name>` works normally on your
machine and will sit alongside them.
