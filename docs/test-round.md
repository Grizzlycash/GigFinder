# Running a test round

Everything needed to put GigFinder in front of a handful of people, and the reasons behind
the awkward bits.

## Before you send the link

1. **Import the real venues, then clear the samples.** The seeded rooms are invented and
   every address is `example.com`. Admin → Import spreadsheet, then Admin → Venue database →
   **Remove sample venues**. That purge is permanent and the rows do not come back on
   reload — which is the point, but it means doing it in the wrong order loses nothing
   except your patience.

   Sample venues live in `src/data/venues.js` and ship with the build, so **clearing them in
   your browser does not clear them for your testers.** To hand testers the real list, export
   it (Admin → Venue database → Export) and replace `src/data/venues.js` with it, or send the
   CSV to whoever maintains the repo.

2. **Decide where feedback goes.** `src/config.js` → `FEEDBACK_EMAIL`. Left empty, the
   feedback button copies the report to the clipboard and tells the tester to paste it to
   you. Set it and the button opens a prefilled email instead. It's empty by default because
   this repo is public and an address in the source gets scraped — use an alias you can
   throw away.

3. **Label the round.** `BUILD_LABEL` in the same file rides along on every feedback report,
   so you can tell round 1 from round 3.

4. **Check `PROTOTYPE` is still `true`.** It drives the first-run notice, the sidebar stamp
   and the line next to the send button. Turn it off the day sending, payments and the venue
   data are real — not before.

## What testers get

- **A first-run notice** stating that no email is ever sent, the venues may be invented, and
  everything lives in that browser. Acknowledged once per browser.
- **A standing "Prototype" stamp** in the sidebar, and a line by the send button naming the
  venue that will *not* hear from them. Sending is convincing enough to be believed, which
  is exactly why it has to say so where the click happens.
- **A feedback button** carrying the screen, plan, viewport and browser.
- **Settings → Data → Download my test data**, which dumps their whole world as JSON.

## Getting the results back

There is no backend, so a tester's round exists only in their browser. Ask for the JSON
export, then load it with Settings → Data → **Load a test file** to see exactly what they
built — their pipeline, their EPK, their press kit. It replaces everything in *your* browser,
so export your own round first, or use a separate browser profile.

## Briefing them

Tasks beat "have a play": open-ended testing produces opinions about colours, task-based
testing produces the workflow problems worth fixing. Something like:

> 1. Set yourself up as your act, and get to the point where you'd be happy for a booker to
>    see your press kit.
> 2. Find two rooms you'd genuinely pitch to, and tell me why you'd pick them.
> 3. Send a pitch to one of them, start to finish.
> 4. Come back the next day and update where it got to.
>
> Use one browser on one device the whole time. Hit Feedback the moment anything annoys you.
> When you're done: Settings → Data → Download my test data, and send me the file.

Known rough edges worth warning them about: PDF downloads are awkward in iOS Safari, and the
press kit needs Pro, which they switch on themselves in Plan & billing (no payment).

## What this setup can't do

- **No shared database.** Every tester has a private copy of the venues. Nobody sees anyone
  else's submissions, and the admin queue is their own.
- **No telemetry.** You learn what they tell you and what's in the export. Nothing else.
- **No access control.** `noindex` keeps it out of search results; anyone with the link can
  still open it, and a client-side passphrase wouldn't change that — the bundle is public.

All three want a backend, and none of them are worth building for five testers.
