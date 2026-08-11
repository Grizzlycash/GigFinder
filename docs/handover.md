# Where GigFinder stands

Last updated: 10 August 2026. Branch: `claude/gigbook-web-app-6tpcs3`.

Read this first when picking the project back up — state, decisions already made, and the
questions still open.

## Running it

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # builds, then drives the whole app in Chromium (21 steps)
```

Stack: React + Vite + Tailwind v4 + shadcn/ui, hash routing, state in `localStorage`.

To see it deployed: set **Settings → Pages → Source: GitHub Actions** once. The workflow in
`.github/workflows/pages.yml` builds and publishes on every push to
`https://grizzlycash.github.io/GigFinder/`.

## What happened in this session

The app was rebuilt from scratch on React + Tailwind + shadcn/ui and restyled to
`docs/design-brief.md` (gig poster / tattoo flash sheet), replacing the previous
zero-dependency vanilla build and its dark blue-grey theme. It was also renamed from GigBook
to GigFinder and reseeded with Melbourne venues.

The store, plan limits, CSV import and pipeline logic were ported across rather than
rewritten — that logic was already proven, so only the presentation layer is new.

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
  admin approval.

## Open questions

1. **Connect a model provider when you have a backend.** The seam is built
   (`src/lib/draft.js`); rewrites currently run on-device. Decision taken: the artist's bio
   may be sent, the booking contact's name and email may not — they're a third party's
   personal information. See the README section for the `setDraftProvider()` contract. Still
   to do on your side: the endpoint, the provider's zero-retention/no-training settings, a
   rate limit, and a line in the privacy policy. Rewrites are gated to Pro but deliberately
   **not advertised on the pricing cards** until a model is actually connected.
2. **Seed data.** The 79 Melbourne venues are fictional with `example.com` addresses. Import
   the real 222-venue spreadsheet through Admin → Import spreadsheet (CSV; it guesses the
   column mapping and de-duplicates on name + suburb).
3. **Unadvertised Pro features.** Saved lists, CSV export and analytics work but aren't
   listed on the pricing cards, because the pricing mockup didn't list them.
4. **GST.** Prices are now AUD but say nothing about GST. Australian SaaS usually states
   "incl. GST" — worth confirming with your accountant before the copy claims either way.
5. **Onboarding, pricing, settings and admin weren't in the brief's scope list** — they follow
   the same design language, but they haven't been designed against a brief the way the four
   named screens were.

## Known prototype boundaries

- Sending is simulated — the outreach record keeps its own copy of the email, but no provider
  is contacted.
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

## Sandbox note

`npx shadcn add` can't reach `ui.shadcn.com` from this environment (proxy returns 403), so
`src/components/ui/` was hand-vendored in the same style on the same Radix + CVA primitives.
The components match the shadcn API, so `npx shadcn add <name>` works normally on your
machine and will sit alongside them.
