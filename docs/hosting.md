# Hosting GigBook privately

The beta runs on **Cloudflare Pages** with **Cloudflare Access** in front of it, on
**gigbook.com.au**. Access checks each tester's email at the edge before any of the app is
served, so the bundle and the venue database are behind the login too — not just the UI.

This replaces GitHub Pages, which could not do it: static file hosts have no server in the
request path, so there is nowhere to check a password.

## Why not a password inside the app

A static site ships its code to the browser. A password checked in that code is a password
published next to the lock — devtools walks past it, and so does reading the repo. It stops a
casual visitor and nobody else. If the venue database is worth protecting, it needs an actual
gate; if it isn't, it doesn't need a login at all.

## Setup, once

1. **Make the GitHub repo private.** Settings → General → Danger Zone → Change visibility.
   Do this first: locking the site is pointless while `src/data/venues.js` is public. GitHub
   Pages stops working on a private repo without a paid plan, which is fine — it's being
   retired anyway.

2. **Add the domain to Cloudflare.** Create an account, add `gigbook.com.au`, and follow the
   nameserver instructions. Then change the nameservers at your registrar. This is the slow
   step — usually a few hours, occasionally longer. Everything else waits on it.

3. **Create the Pages project.** Cloudflare dashboard → Workers & Pages → Create → Pages →
   Connect to Git → pick the repo and the branch.

   | Setting | Value |
   | --- | --- |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | 18 or newer (set `NODE_VERSION` if the default is older) |

   `vite.config.mjs` builds with `base: './'`, so it works at a domain root or any subpath —
   nothing to change per host.

4. **Attach the domain.** Pages project → Custom domains → add `gigbook.com.au`. HTTPS is
   issued automatically. Add `www` too if you want it to resolve.

5. **Turn on Access.** Zero Trust → Access → Applications → Add a self-hosted application for
   `gigbook.com.au`. Add a policy: action **Allow**, rule **Emails**, listing each tester plus
   yourself. Leave the one-time PIN login method enabled — that's what sends the code, and it
   means testers need no account anywhere.

6. **Set `ACCESS_SSO = true`** in `src/config.js` and push. This is what lets the app read
   the verified email and skip its own sign-in form. It's off by default because probing for
   Access where Access isn't in front logs a 404 on every load.

7. **Turn GitHub Pages off**, so the old public address stops serving a copy.

8. **Check it from a browser you're not logged into.** You should get Cloudflare's email
   prompt, not the app. That's the only test that proves the gate is on.

## What testers experience

They open gigbook.com.au, type their email, get a PIN, paste it in. Then the app loads —
already signed in.

That last part is `src/lib/access.js`. Access publishes the identity it verified at
`/cdn-cgi/access/get-identity` on the same origin; the app reads it and signs the matching
account in, or pre-fills the email on the sign-up form for a first visit. Without Access in
front — local dev, any other host — the lookup quietly fails and the normal landing page
takes over. It is a convenience over Cloudflare's enforcement, never a replacement for it.

## Adding or removing a tester

Zero Trust → Access → Applications → your app → the policy → edit the email list. Takes
effect immediately; no deploy, no code change. Removing someone locks them out of the site,
though anything already in their browser stays in their browser.

## What this does not do

Access controls **who reaches the site**. It does not give the app accounts.

- Data still lives in each browser's `localStorage`. The same tester on a laptop and a phone
  gets two separate, empty-to-each-other apps.
- Nothing is shared between testers — each has a private copy of the venue database and their
  own admin queue.
- Clearing site data still wipes a round. Hence Settings → Data → Download my test data.

Real accounts — one identity across devices, a shared venue database, submissions everyone
sees — need a backend. That's the next significant build, and it isn't worth doing for five
testers.

## Notes

- **`public/_headers`** carries the security headers; Cloudflare Pages applies them at the
  edge. It's ignored by other hosts, so it's harmless if you move again.
- **The old storage key.** The app was briefly called GigFinder and stored under
  `gigfinder:v1`. `adoptLegacyStore()` in `src/store/store.js` moves that across on first
  load, so anyone who used the earlier build keeps their work. `npm test` asserts it.
  Safe to delete once no tester has an old browser profile — no rush.
- **Preview deployments.** Pages builds every branch by default and gives each a
  `*.pages.dev` URL that your Access policy does *not* cover. Either restrict builds to the
  production branch, or add an Access application for `*.pages.dev` too.
