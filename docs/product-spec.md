# GigBook — product specification (v2.0, condensed)

Reference version of the v2.0 spec, kept next to the implementation so the two stay honest.
The Word document remains the formal artifact; this file records what the prototype actually
builds.

## 1. Product

A SaaS web app for independent musicians to manage venue outreach and live-show booking.
Three jobs, in order of use:

1. **Find venues** worth contacting, from a shared curated database.
2. **Send an EPK** to the booking contact without rewriting the pitch each time.
3. **Track the pipeline** so nothing is dropped between "sent" and "booked".

The venue database is shared across all subscribers and maintained by GigBook staff, seeded
from a proprietary spreadsheet. Subscribers can suggest additions, which enter a review queue.

## 2. Information architecture

Sidebar navigation, two groups:

**Booking** — Dashboard · Venues · Map · EPK · Outreach · Saved Lists (Pro)
**Account** — Plan & Billing · Settings · (Admin panel, staff only)

Venues and Map are **distinct navigation items**. A combined list/map view compromised both:
the list wants density and filters, the map wants space and a single selection.

The admin panel is a separate chrome with a **dark sidebar**, so it is never mistaken for the
artist-facing app.

## 3. Screens

### 3.1 Landing / sign in
Split layout: brand hero with the three-job value proposition and price anchors on one side,
create-account / sign-in on the other. Account creation takes artist name and email only —
everything else is collected in onboarding.

### 3.2 Onboarding (four steps)
1. **Artist profile** — artist name, contact name, home city/state, typical local draw, up to
   three genres (used to rank suggested venues).
2. **Links & photo** — primary streaming link, Bandcamp, live video, Instagram, website, press
   photo. Copy makes it clear that one strong link beats five weak ones.
3. **EPK bio** — tagline, short bio (≤700 chars), optional long bio. The screen states plainly
   that the short bio becomes the body of every outreach email.
4. **Plan** — Basic / Pro with a monthly-annual toggle; finishing creates the first EPK
   pre-filled from steps 1–3.

Progress is a four-segment bar. Steps persist, so a dropped session resumes where it left off.

### 3.3 Dashboard
Four stat tiles (sent, replies + rate, booked + rate, awaiting reply), monthly send quota with
progress bar, follow-ups due (Pro; upsell on Basic), EPK status, suggested venues ranked by
genre and geography, and a recent-activity timeline.

### 3.4 Venues
Left filter rail: search, state, venue type, capacity range, genres booked, "hide venues I've
contacted", clear-all. Right: sortable result cards showing capacity, type, pay structure,
genres, and the artist's own pipeline stage for that venue as a coloured badge. Per-row
actions: save to list (Pro), details, send EPK. Header carries CSV export (Pro) and
"suggest a venue", which files into the admin review queue.

### 3.5 Venue detail
Booking contact block (contact, email, submission method, pay structure, website), booking
notes, genres, coordinates with a link through to the map, and the artist's own outreach with
that venue: current stage (editable), private notes, and a full event history.

### 3.6 Map
Pins for every mapped venue, coloured by pipeline stage against a shared legend. Pan, zoom,
state filter, and a "not yet contacted" toggle. Selecting a pin opens a side panel with the
venue summary and a send action; with nothing selected the panel lists the pins in view.
Co-located venues are fanned apart so each stays clickable.

### 3.7 EPK generator
List of press kits (one on Basic, unlimited on Pro) with a default marker. The editor is a
two-column layout: form on the left — basics, short bio, long bio, tracks, press quotes,
links — and a live press-kit preview on the right that updates as you type.

### 3.8 Send EPK — the core flow
**One linear column, top to bottom, six numbered steps.** No tabs, no wizard, no modal.

1. Which venue (pre-selected when arriving from a venue, map pin or list)
2. Booking contact — pulled from the venue record, address editable
3. Which EPK — states that the body comes from this kit's short bio
4. Subject line — from a template with `{artist}`, `{venue}`, `{city}` placeholders
5. Message — **auto-populated from the EPK short bio**, greeting the booking contact by first
   name, with track and video links, a closing ask, and the artist's signature. Freely
   editable, with a "reset to EPK bio" escape hatch
6. Attached press kit — what the venue receives

Sending writes an outreach record holding its own copy of the sent email, so later EPK edits
never rewrite history. Re-contacting a venue warns first. Hitting the Basic send cap replaces
the form with an upgrade prompt.

### 3.9 Outreach tracker
Five-stage pipeline: **Sent → Opened → Replied → Booked / Declined**. Two views over the same
data — a drag-and-drop board and a table with inline stage selects. Search plus filters for
"awaiting reply" and "follow-ups due". Opening a record shows the exact email sent, stage,
follow-up date (Pro), notes and history. Pro adds a four-tile analytics strip and CSV export.

### 3.10 Plan & billing
Basic and Pro side by side with a monthly/annual toggle; annual shows the yearly total and
the cash saved. Pro is visually featured. Downgrading warns which features switch off.

### 3.11 Settings
Profile, outreach defaults (subject template, signature, reminder interval — Pro), admin
access, and data controls (load sample pipeline, reset).

### 3.12 Admin panel (dark sidebar)
- **Overview** — venue counts, pending submissions, subscribers, estimated MRR, coverage by
  state, and a database-health table (missing emails, coordinates, capacity).
- **Venue database** — searchable table over every row with full editor, add and delete.
- **Import spreadsheet** — CSV drop or paste → column mapping guessed from headers → preview →
  import, de-duplicating on *name + city*, optionally as pending review.
- **Submissions** — subscriber-suggested venues; approve publishes to everyone.
- **Users** — accounts, plan, billing cycle, admin toggle, delete.

## 4. Data model

- **User** — email, artist name, contact name, genres, home city/state, draw, links, photo,
  plan, cycle, admin flag, onboarding step
- **Venue** — name, city, state, coordinates, capacity, type, genres, booking contact, email,
  website, submission method, pay structure, notes, status (active / pending / archived),
  source
- **EPK** — title, tagline, short bio, long bio, genres, base city, links, tracks, press
  quotes, photo, default flag
- **Outreach** — venue, EPK, recipient, subject, body copy, stage, sent date, follow-up date,
  notes, history entries
- **List** (Pro) — name, venue ids

## 5. Tiers

| | Basic | Pro |
| --- | --- | --- |
| Monthly | $9.99 | $19.99 |
| Annual | $7.99/mo ($95.88/yr) | $15.99/mo ($191.88/yr) |
| EPKs | 1 | Unlimited |
| Sends | 25/month | Unlimited |
| Follow-up reminders, saved lists, CSV export, analytics | — | ✓ |

Annual is a flat 20% discount on both tiers. A "send" is one EPK email to one booking contact,
follow-ups included; the Basic counter resets on the 1st.

## 6. Design system

Brand `#1D9E75`. Arial, two weights only (400/700). Flat UI — no gradients, borders rather
than shadows. Pipeline colours are fixed across every surface: sent blue, opened amber,
replied purple, booked brand green, declined red.
