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
| Dashboard | `#/dashboard` | Pipeline snapshot, follow-ups, suggested venues |
| Venues | `#/venues` | Search, filters, sort, CSV export, "suggest a venue" |
| Venue detail | `#/venues/:id` | Booking contact, notes, your outreach history |
| Map | `#/map` | Separate nav item from Venues; pins coloured by pipeline stage |
| EPK | `#/epk`, `#/epk/:id` | Generator with live press-kit preview |
| Send EPK | `#/send` | Linear six-step flow, body auto-filled from the EPK short bio |
| Outreach tracker | `#/outreach` | Drag-and-drop board or table, notes, history |
| Saved lists | `#/lists` | Pro — route a run of dates |
| Plan & billing | `#/pricing` | Basic / Pro, monthly / annual |
| Settings | `#/settings` | Profile, outreach defaults, data controls |
| Admin panel | `#/admin/*` | Dark sidebar — venue DB, spreadsheet import, submissions, users |

### Three design decisions the build follows

- **The send flow is linear, top to bottom.** One column, six numbered steps, no tabs or
  modals. The email body is generated from the selected EPK's short bio on load, so every
  pitch reads consistently and the artist only edits when they want to.
- **The admin panel uses a dark sidebar.** It should never be mistaken for the artist app.
- **Map and Venues are separate nav items.** A combined view made both jobs worse.

## Subscription tiers

|  | Basic | Pro |
| --- | --- | --- |
| Monthly | $9.99 | $19.99 |
| Annual (20% off) | $7.99/mo — $95.88/yr | $15.99/mo — $191.88/yr |
| Venue database + map | ✓ | ✓ |
| EPKs | 1 | Unlimited |
| EPK sends | 25 / month | Unlimited |
| Outreach tracker | ✓ | ✓ |
| Follow-up reminders | — | ✓ |
| Saved venue lists | — | ✓ |
| CSV export | — | ✓ |
| Outreach analytics | — | ✓ |

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

- Brand `#1D9E75`; full token set in `assets/css/tokens.css`
- Arial, **two weights only** (400 and 700) — nothing uses 500/600
- Flat UI: no gradients anywhere, borders instead of shadows
- Pipeline colours: sent (blue), opened (amber), replied (purple), booked (brand green),
  declined (red) — used identically on the board, the venue list and the map

## Known prototype boundaries

- **Sending is simulated.** A send records the outreach and its exact email copy; it does not
  hand off to an email provider. That integration is a Bubble-side concern.
- **The map is drawn from scratch** as an SVG plot (equirectangular projection, pan/zoom,
  co-located pins fanned apart) rather than a tile map, so the prototype works offline. In
  Bubble this pane becomes the native map element; the pins, colours and side panel stay.
- **Payments are not processed.** Choosing a plan switches the feature set only.
- Auth is by email only, on-device, with no password — enough to demo multi-user and admin.
