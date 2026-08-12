# GigFinder — Design Brief (reusable prompt template)

Paste this at the start of any Claude Code session where you're building or restyling GigFinder UI.

---

## 1. Context (what this is)

GigFinder is a tool for local musicians to discover and contact live music venues — currently working from a database of 222 Melbourne venues. Users are gigging musicians, not developers: the interface needs to feel fast, practical, and a little bit "of the music scene" — not like generic B2B SaaS.

## 2. Design tokens

**Direction:** Gig poster meets tattoo flash sheet — the visual language of vintage punk show bills and traditional flash art, cleaned up for a working tool. Dark "ink" background with warm "flash paper" surfaces for content, bold condensed display type for headings, restrained everywhere else.

**Color**
- Background (ink): `#12151C` — near-black charcoal, not pure black
- Surface/card (flash paper): `#F6F1E3` — aged cream paper, used for venue cards and panels
- Primary accent (flash red): `#B23A2E` — muted traditional tattoo red, for primary actions
- Secondary accent (flash green): `#3C6E52` — traditional tattoo green, for secondary status/success states
- Text (primary, on dark): `#F1EDE1`
- Text (muted): `#9B9686` — aged paper grey, for secondary text/timestamps

**Type**
- Display face (headings, venue names): a bold condensed poster/slab face — e.g. Anton, Bebas Neue, or similar gig-bill lettering. Used for headings only, not body copy.
- Body face (lists, forms, data): a clean humanist sans — e.g. Inter or Public Sans — needs to stay very readable across dense venue lists and forms.

**Layout concept**
Venue cards read like ticket stubs or flash-sheet entries stacked in a scannable list — dense and quick to skim, not spacious dashboard tiles with lots of whitespace.

**Signature element**
Contact status (not contacted / emailed / replied / booked) shown as a stamped ink-badge — like a rubber stamp on a flash sheet or gig poster — rather than a generic colored status pill.

## 3. Build standards (non-negotiable)

- Use Tailwind + shadcn/ui components rather than raw hand-rolled CSS, for consistent spacing/shadows/focus states.
- Responsive down to mobile.
- Visible keyboard focus states.
- Respect reduced-motion preferences; keep animation purposeful, not decorative.
- Screenshot the result and self-critique against this brief before presenting it — check spacing, alignment, and type scale.

## 4. Screens/components in scope

Initial v1 target — trim per session to just what you're working on:

- Venue list/browse (the flash-sheet card list)
- Venue detail panel + AI booking email generator
- CRM/tracking table (contact status across all venues)
- EPK generation screen

## 5. Reference point

No specific site reference — the direction itself (vintage gig posters + tattoo flash sheets) is the reference. If a specific site or screenshot becomes useful later, drop it here.

---

### Notes for future sessions

*(intentionally blank — log what worked/didn't after each build round so the next session doesn't repeat mistakes)*

-

## Notes from build round 1 (10 Aug 2026)

What worked:

- **The stamp is the strongest idea in the brief.** It carries the whole aesthetic and it's
  genuinely more scannable than a pill, especially in the CRM table where six different
  stamp inks make the column readable at a glance. Worth protecting in future rounds.
- Ticket-stub cards with a perforated left edge + dashed internal rule read as "flash sheet"
  without any texture images.
- Anton for headings / Inter for body holds up in dense lists. Both are self-hosted
  (`src/assets/fonts`) rather than loaded from Google, so the app works offline and doesn't
  depend on a CDN.

What needed correcting after the first screenshot pass:

- **Stamping "Not contacted" at full strength on every card was visual noise** — with most
  of the list uncontacted, the stamps stopped meaning anything. Now the default state prints
  lighter (60% opacity, hairline border) so contacted rooms pop.
- The genre filter ran to three chip rows before any content. Collapsed to 8 + "more".
- A long venue name and a large stamp fought over the same line in the detail panel; the
  stamp moved to its own line.
- **Melbourne's density broke the map.** Inner-suburb pins covered each other and could not
  be clicked. Pins now collapse into a numbered cluster that splits as you zoom.

Build-standards note: `npx shadcn add` could not reach `ui.shadcn.com` from this sandbox
(the proxy returns 403 on that host), so the components in `src/components/ui/` were
hand-vendored in the same style, on the same Radix + CVA primitives. They match the shadcn
API, so `npx shadcn add <component>` will work normally on a machine with network access.


## Notes from build round 3 (12 Aug 2026) — the background

The brief specifies the ink ground as a colour and stops there, which left it a single flat
field. Measured, the dashboard ground was exactly `#12151C` edge to edge: the two washes in
`index.css` were at 5% and contributing nothing visible.

The cause turned out not to be the treatment at all. `AppShell`'s root div painted an opaque
`bg-background` across the viewport, sitting on top of the body and html grounds — anything
behind it was invisible no matter how it was set. Worth remembering before tuning any value
on the ground: **check nothing is painting over it.** Pixel variance across an empty region
is the quick test — flat means covered.

What the ground is now, in layers:

1. **Ink in four levels, not one.** `ink-deep` #0D1015 (sidebar spine), `ink` #12151C (top
   bar, and still the deep stock the press kit cover, map and stamp badges print on),
   `ink-ground` #171B24 (the app ground), `ink-raised` #1F2530 (panels). Near-black also
   crushes texture — the ground had to come up before grain could read at all.
2. **A light source.** Two very wide radial washes on `html`, warm from above the fold and
   cool pooling bottom-right, fixed. Flat fields feel dead mostly because nothing is
   lighting them.
3. **The paste-up wall** (`src/assets/paste-up.svg`) — torn bills at slight angles, 1.6–4.5%.
4. **Grain** — fractal noise at 5.5% over everything.
5. **Misregistration** — the red plate a pixel proud of the sidebar edge, green a pixel
   behind. Colour on the ground without a gradient.

Two things learned drawing the wall:

- **Sheets, not bands.** The first pass used edge-to-edge diagonal gradients and read as a
  rendering glitch, because nothing real is a stripe running off both sides of the page.
  Bounded rectangles at slight angles read as paper immediately.
- **Tears have to be shallow and irregular.** At ~40 units against a 1600-unit width, evenly
  spaced, a torn edge reads as a mountain range or a chart. At ~12 units with irregular
  spacing it reads as paper.

The wall is deliberately loudest where the app is emptiest — it fills the void on Outreach
and Dashboard, and on a dense screen like Venues you only catch it in the gutters.
