# GigBook

Venue outreach and live-show booking for independent musicians. Browse a curated venue
database, send Electronic Press Kits to booking contacts, and track the outreach pipeline.

This repository is a **working reference implementation of the v2.0 product spec** — every
screen and flow in the spec is clickable here, so decisions can be checked against real
interaction before they are rebuilt in Bubble.io.

## Run it

```bash
npm start          # http://localhost:4173
```

No build step, no dependencies. `server.js` is a ~40-line static file server; the app is
plain ES modules, so any static host works. A server *is* required — browsers block ES
module imports over `file://`.

## What's in it

| Screen | Route | Notes |
| --- | --- | --- |
| Landing / sign in | `#/` | Split hero + create-account form |
| Onboarding | `#/onboarding` | Four steps: profile → links & photo → EPK bio → plan |
| Dashboard | `#/dashboard` | Greeting, metrics, recent outreach, follow-ups, coverage |
| Venues | `#/venues`, `#/venues/:id` | Chip filter bar, venue list column, detail pane |
| Map | `#/map` | Separate nav item from Venues; pins coloured by pipeline stage |
| EPK generator | `#/epk`, `#/epk/:id` | Section rail: bio, photos, music, socials, tech rider |
| Send EPK | `#/send` | Linear six-step flow, body auto-filled from the EPK short bio |
| Outreach tracker | `#/outreach` | Drag-and-drop board or table, notes, history |
| Saved lists | `#/lists` | Pro — route a run of dates |
| Plan & billing | `#/pricing` | Basic / Pro, monthly / annual |
| Settings | `#/settings` | Profile, outreach defaults, data controls |
| Admin panel | `#/admin/*` | Steel sidebar — venue DB, spreadsheet import, submissions, users |

### Four design decisions the build follows

- **The send flow is linear, top to bottom.** One column, six numbered steps, no tabs or
  modals. The email body is generated from the selected EPK's short bio on load, so every
  pitch reads consistently and the artist only edits when they want to.
- **Map and Venues are separate nav items.** A combined view made both jobs worse.
- **Venues is a three-pane browser** — filter chips across the top, a list column, and a
  detail pane — so filtering and reading a venue never cost a page change.
- **The admin panel is visually distinct.** It originally did this with a dark sidebar; now
  that the whole app is dark, admin uses a *lighter* steel sidebar with an amber rail. Same
  job: you can never mistake it for the artist-facing app.

## Subscription tiers

|  | Basic | Pro |
| --- | --- | --- |
| Monthly | $9.99 | $19.99 |
| Annual (20% off) | $7.99/mo — $95.88/yr | $15.99/mo — $191.88/yr |
| Venue database + map | ✓ | ✓ |
| EPK sends | 15 / month | Unlimited |
| Outreach tracker | ✓ | ✓ |
| Upload your own EPK | ✓ | ✓ |
| Add private venues | ✓ | ✓ |
| EPK generator | Bio only | Full — photos, music, socials, rider |
| EPKs | 1 | Unlimited |
| Follow-up reminders | — | ✓ |
| Saved venue lists | — | ✓ |
| CSV export | — | ✓ |
| Outreach analytics | — | ✓ |

Basic keeps the **Biography** section of the generator even though the generator is a Pro
feature: the outreach email is written from its short bio, so locking it would break the
core flow for paying Basic users. Everything else in the generator is Pro, and Basic can
attach a press kit built elsewhere instead.

Gating is enforced in `assets/js/store.js` (`plan()`, `can()`, `sendsRemaining()`), so the
tier boundary lives in one place. Switching plans on `#/pricing` swaps the feature set
immediately — useful for demoing both tiers.

## Layout

```
index.html
server.js                 static dev server (no dependencies)
assets/css/               tokens → base → components → layout → admin
assets/js/
  app.js                  shell, routing table, sidebar/topbar chrome
  router.js               hash router (#/venues/:id)
  store.js                state, persistence, plan limits, all mutations
  seed.js                 seed venue database
  ui.js                   escaping, icons, formatting, toasts, modals
  views/                  one module per screen: { title, render(ctx), mount(el, ctx) }
docs/product-spec.md      condensed v2.0 spec
```

Each view exports `render(ctx)` returning an HTML string plus an optional `mount(root, ctx)`
for event wiring. `ctx` carries `params`, `query`, `navigate` and `rerender`.

## Data

State lives in `localStorage` under `gigbook:v1` — nothing leaves the browser. `store.js` is
the only module that touches persistence, so swapping it for API calls is the single change
needed to move to a real backend.

**The seeded venues are fictional.** Names, booking contacts and addresses are invented and
all email addresses use the reserved `example.com` domain. Alex's proprietary spreadsheet
replaces them via **Admin → Import Spreadsheet**, which reads a CSV, guesses the column
mapping from the headers, previews the rows, and de-duplicates on *name + city* so re-imports
update rather than duplicate.

Sample pipeline data is available from Settings → Data, or the empty state of the tracker.

## Design system

Dark theme, blue and grey. The full token set is in `assets/css/tokens.css` — change the
palette there and the whole app follows.

- **Surfaces**: cool slate greys, deepest at the app frame — `#0D131E` background,
  `#151C2A` cards, `#1A2231` sidebar and inset areas
- **Primary action**: `#2F6BD8` (white label, ~5:1 contrast); `#7FB0FF` for links and
  active nav on dark surfaces
- Arial, **two weights only** (400 and 700) — nothing uses 500/600
- Flat UI: no gradients anywhere, hairline borders instead of shadows
- **Pipeline colours** (dark-tuned, used identically on the board, venue list and map):
  sent amber, opened cyan, replied violet, booked green, declined red
- **Initials tiles** hash a venue's name to one of six muted swatches, so a venue keeps the
  same colour everywhere it appears

## Known prototype boundaries

- **Sending is simulated.** A send records the outreach and its exact email copy; it does not
  hand off to an email provider. That integration is a Bubble-side concern.
- **The map is drawn from scratch** as an SVG plot (equirectangular projection, pan/zoom,
  co-located pins fanned apart) rather than a tile map, so the prototype works offline. In
  Bubble this pane becomes the native map element; the pins, colours and side panel stay.
- **Payments are not processed.** Choosing a plan switches the feature set only.
- Auth is by email only, on-device, with no password — enough to demo multi-user and admin.
