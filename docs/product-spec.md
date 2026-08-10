# GigFinder — product specification (v2.0, condensed)

Reference version of the v2.0 spec, kept next to the implementation so the two stay honest.
The Word document remains the formal artifact; this file records what the app actually builds.

**Visual design is governed by `design-brief.md`**, not this document — gig poster meets
tattoo flash sheet, dark ink ground with flash-paper surfaces. This spec covers behaviour.

## 1. Product

A SaaS web app for independent musicians to manage venue outreach and live-show booking.
Three jobs, in order of use:

1. **Find venues** worth contacting, from a shared curated database.
2. **Send an EPK** to the booking contact without rewriting the pitch each time.
3. **Track the pipeline** so nothing is dropped between "sent" and "booked".

The venue database is shared across all subscribers and maintained by GigFinder staff, seeded
from a proprietary spreadsheet. Subscribers can suggest additions, which enter a review queue.

## 2. Information architecture

Sidebar navigation, two groups:

**Main** — Dashboard · Venues · Map · Outreach (badged with follow-ups due)
**My profile** — My EPK · Saved Lists (Pro) · Settings

Plan & billing and sign-out live in the account block at the foot of the sidebar.

Venues and Map are **distinct navigation items**. A combined list/map view compromised both:
the list wants density and filters, the map wants space and a single selection.

The admin panel keeps the same chrome but swaps the accent from flash red to the ochre
"emailed" ink and stamps ADMIN under the wordmark, so it is never mistaken for the
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
Greeting in the top bar ("Good morning, Alex") with today's date and follow-ups due. Below: an
EPK nudge when the press kit is unfinished, four metric tiles (EPKs sent, sends remaining,
venues contacted, shows booked), recent outreach as tiled rows with pipeline badges, and a
right-hand column of follow-up reminders (Pro; upsell on Basic), database coverage and a
pipeline summary.

### 3.4 Venues
A three-pane browser. Across the top: search, sort, CSV export (Pro) and "Add venue", then a
chip bar filtering by pipeline status, genre and room size. Left: the venue list, each row an
initials tile, name, city, capacity and the artist's own pipeline stage. Right: the detail
pane for the selected venue.

Adding a venue offers two destinations — keep it **private** to the account (live
immediately, marked in the list and counted in a "Private: n" badge) or **submit it to the
shared database**, where it waits at status `pending` for admin review.

### 3.5 Venue detail (the right-hand pane)
Header with initials tile, name, location, pipeline badge and genre chips, plus Send EPK and
Save to list (Pro). Below: venue details (capacity, type, pay structure, submission method,
website), booking contact, and the artist's own outreach with that venue — editable stage,
private notes and a full event history.

### 3.6 Map
Teardrop pins carrying the venue's initials, coloured by pipeline stage against a legend in the
top-left corner; a chip bar filters by status and genre, and zoom controls sit bottom-right.
Pan by dragging, zoom by wheel or button. Selecting a pin opens a side panel with the venue
summary, booking contact, the four nearest venues by distance, and a send action; with nothing
selected the panel prompts for a selection. Co-located venues are fanned apart so each stays
clickable.

### 3.7 EPK generator
List of press kits (one on Basic, unlimited on Pro) with a default marker and a completion
bar. The editor is a section rail plus a form: **Biography, Photos, Music links, Social
media, Tech rider**, each showing a completion tick, over a progress bar reading "n of 5
sections complete". A bottom bar carries Previous / Next: <section> and Preview EPK opens the
assembled kit.

The generator is a Pro feature, with one deliberate exception: **Biography stays on Basic**,
because the outreach email is written from its short bio and locking it would break the core
flow for a paying Basic user. Basic sees the other four sections locked behind an upgrade
panel and can attach a press kit built elsewhere instead.

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
Five-stage pipeline: **Emailed → Opened → Replied → Booked / Passed**. Two views over the same
data — a drag-and-drop board and a table with inline stage selects. Search plus filters for
"awaiting reply" and "follow-ups due". Opening a record shows the exact email sent, stage,
follow-up date (Pro), notes and history. Pro adds a four-tile analytics strip and CSV export.

### 3.10 Plan & billing
Basic and Pro side by side with a monthly/annual toggle; annual shows the yearly total and
the cash saved. Pro is visually featured. Downgrading warns which features switch off.

### 3.11 Settings
Profile, outreach defaults (subject template, signature, reminder interval — Pro), admin
access, and data controls (load sample pipeline, reset).

### 3.12 Admin panel (steel sidebar)
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
  visibility (shared / private), owner, source
- **EPK** — title, tagline, short bio, long bio, notable performances, genres, base city, set
  length, audience size, music links, social links, tech rider, photos, tracks, press quotes,
  uploaded file, default flag
- **Outreach** — venue, EPK, recipient, subject, body copy, stage, sent date, follow-up date,
  notes, history entries
- **List** (Pro) — name, venue ids

## 5. Tiers

| | Basic | Pro |
| --- | --- | --- |
| Monthly | $9.99 AUD | $19.99 AUD |
| Annual | $7.99/mo ($95.88/yr) | $15.99/mo ($191.88/yr) |
| Sends | 15/month | Unlimited |
| Venue database, outreach tracking, upload your own EPK, private venues | ✓ | ✓ |
| EPK generator | Biography only | Full |
| EPKs | 1 | Unlimited |
| Follow-up reminders, saved lists, CSV export, analytics | — | ✓ |

All prices are in Australian dollars. Annual is a flat 20% discount on both tiers. A "send" is one EPK email to one booking contact,
follow-ups included; the Basic counter resets on the billing date.

The pricing page lists the headline features above. Saved lists, CSV export and outreach
analytics also ship as Pro capabilities but are not advertised on the cards — worth deciding
whether to surface them there.

## 6. Design system

See `design-brief.md` — it is the source of truth. In short: ink ground `#12151C`, flash-paper
surfaces `#F6F1E3`, flash red `#B23A2E` for primary actions, flash green `#3C6E52` for success.
Anton for display type, Inter for body. Contact status prints as a **stamped ink badge**, not a
coloured pill, in one ink per status: grey not contacted, ochre emailed, blue opened, red
replied, green booked, dead grey passed.

Built with Tailwind + shadcn/ui components (`src/components/ui/`) for consistent spacing,
focus states and keyboard behaviour.
