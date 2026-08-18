/**
 * Build-time switches for a test round.
 *
 * Deliberately a plain file rather than env vars: this is a static site with no build
 * pipeline beyond `vite build`, and whoever is running the test round should be able to
 * change these without learning the tooling.
 */

/**
 * Where the in-app feedback button sends its report.
 *
 * Left empty on purpose. This repo is public, so an address written here is scraped by
 * spambots within days — set it only if you're happy with that, and prefer an alias you
 * can throw away. While it's empty the feedback button copies the report to the
 * clipboard instead, which works just as well when you've told your testers where to
 * paste it.
 */
export const FEEDBACK_EMAIL = '';

/**
 * Marks the build as a prototype: a first-run notice, a stamp in the sidebar, and a line
 * next to the send button saying nothing is actually emailed. Set to false the day
 * sending, payments and the venue database are real — not before.
 */
export const PROTOTYPE = true;

/**
 * True only when the site is served behind Cloudflare Access.
 *
 * Access publishes the identity it verified at `/cdn-cgi/access/get-identity`; when the app
 * is served anywhere else that path is a 404, and probing for it logs a console error on
 * every load for every visitor. So it's a deliberate switch rather than a guess: turn it on
 * in the same sitting as the Access policy (see docs/hosting.md), and testers get one login
 * instead of two.
 */
export const ACCESS_SSO = false;

/** Shown in the notice and attached to feedback reports, so you can tell rounds apart. */
export const BUILD_LABEL = 'test round 1';
