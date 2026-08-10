# Where GigBook stands

Last updated: 10 August 2026. Branch: `claude/gigbook-web-app-6tpcs3`.

Read this first when picking the project back up — it records the state, the decisions
already made, and the questions still open.

## Running it

```bash
npm start     # http://localhost:4173
npm test      # end-to-end browser suite, 21 steps, screenshots in test/screenshots/
```

No dependencies for the app itself. `npm test` needs Playwright
(`npm i -D playwright && npx playwright install chromium`); it starts and stops its own
server, and fails on any console or page error.

To see it without cloning: enable GitHub Pages on this branch (Settings → Pages → Deploy
from a branch → `claude/gigbook-web-app-6tpcs3`, folder `/`), which publishes to
`https://grizzlycash.github.io/GigFinder/`. For a quick look with no setup,
`https://raw.githack.com/Grizzlycash/GigFinder/claude/gigbook-web-app-6tpcs3/index.html`
works while the repo is public.

## What's built

Every screen in the v2.0 spec is implemented and clickable: landing, four-step onboarding,
dashboard, venue browser, map, EPK generator, send flow, outreach tracker, saved lists,
plan & billing, settings, and the admin panel (venue database, CSV import, submissions
queue, users). See `README.md` for the route table and `docs/product-spec.md` for the
screen-by-screen spec.

The build was refined against the five HTML mockups, which are kept in `docs/mockups/` so
the design source travels with the code.

## Decisions already made

**Design**
- Dark theme in blue and grey (replacing the `#1D9E75` brand green). Green now means
  "booked" only. All colour lives in `assets/css/tokens.css`.
- Arial, two weights only (400/700). The mockups used 500; Arial has no 500, so bold
  carries the emphasis.
- Send flow stays one linear top-to-bottom column, body auto-filled from the EPK short bio.
- Venues and Map stay separate nav items; Venues is a three-pane browser.
- Admin is set apart by contrast direction — a *lighter* steel sidebar with an amber rail,
  because a dark sidebar no longer distinguishes anything in a dark app.

**Product**
- Tiers follow the pricing mockup: Basic $9.99 (15 sends/month), Pro $19.99, 20% off
  annually. Upload-your-own-EPK and private venues on both tiers; EPK generator, unlimited
  sends and follow-up reminders on Pro.
- **Basic keeps the generator's Biography section** even though the generator is a Pro
  feature — the outreach email is written from its short bio, so locking it would break the
  core flow for a paying Basic user.
- Venues added by a subscriber can be private (live immediately, only they see it) or
  submitted to the shared database, where they wait at `pending` for admin approval.

## Open questions for tomorrow

1. **Brand colour.** The green is gone in favour of blue and grey. If you want it kept for
   the logo mark or as a secondary accent, that's a two-token change in `tokens.css`.
2. **Unadvertised Pro features.** Saved lists, CSV export and outreach analytics work but
   aren't listed on the pricing cards, because the mockup didn't list them. Decide whether
   to surface them.
3. **Send cap wording.** The pricing card says Basic resets "on your billing date"; the
   code resets on the calendar month. Align one to the other.
4. **Seed data.** The 70 venues are fictional with `example.com` addresses. Replace them by
   importing the real spreadsheet through Admin → Import Spreadsheet (CSV; it guesses the
   column mapping from headers and de-duplicates on name + city).

## Known prototype boundaries

- **Sending is simulated.** An outreach record with its own copy of the email is written;
  no email provider is contacted. That integration is a Bubble-side concern.
- **The map is hand-drawn SVG**, not a tile map, so it works offline. It reads as a plot of
  the US rather than a street map. Bubble's native map element replaces this pane; the pin
  colours, legend and side panel carry over.
- **No payments.** Choosing a plan switches the feature set only.
- **Auth is email-only and on-device.** Enough to demo multi-user and admin, nothing more.
- **State lives in `localStorage`** under `gigbook:v1`. `assets/js/store.js` is the only
  module that touches persistence — swapping it for API calls is the single change needed
  to move to a real backend.

## Bugs fixed while building (so they don't get reintroduced)

- Map pins were unselectable: `setPointerCapture` on drag retargets the following `click`
  to the `<svg>`. The map now pans via window listeners instead. `npm test` asserts a pin
  click opens the side panel.
- The EPK rail's completion dot rendered as a large oval — its `empty` modifier collided
  with the global `.empty` empty-state rule and inherited its padding. Renamed to `todo`.
- The dashboard greeted the band name's first word ("Good morning, The"); it now uses the
  contact name.
- Venues sharing a city landed on the same pixel and covered each other; co-located pins
  are fanned apart.
- Venues with no coordinates (hand-added or imported) stretched the map projection to the
  Gulf of Guinea; the map now excludes them.
