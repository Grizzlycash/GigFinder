/**
 * Cloudflare Access, joined up with the app's own sign-in.
 *
 * When the site sits behind Access, a tester has already proved who they are before the app
 * loads — Cloudflare mailed them a one-time PIN and checked it at the edge. Making them then
 * type the same address into a "create your account" form is one login too many, and it reads
 * as if the first one didn't work.
 *
 * Cloudflare exposes the identity it verified at a fixed path on the same origin. If it
 * answers, we trust it: the request never reached us without passing the Access policy. If it
 * doesn't answer — local dev, a plain static host, Access switched off — nothing happens and
 * the ordinary landing page does its job.
 *
 * This is a convenience over enforcement, never a substitute for it. The gate is Cloudflare's;
 * this only saves the second form.
 */

import { ACCESS_SSO } from '@/config';

const IDENTITY_URL = '/cdn-cgi/access/get-identity';

let cached;

/**
 * The email Cloudflare Access verified for this visitor, or null.
 * Never throws: every failure mode here means "not behind Access", which is not an error.
 */
export async function accessIdentity() {
  if (cached !== undefined) return cached;
  cached = null;
  // Off by default: probing this path where Access isn't in front is a guaranteed 404, and
  // a 404 on every page load is a console error every visitor and every test run sees.
  if (!ACCESS_SSO) return cached;

  try {
    const res = await fetch(IDENTITY_URL, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!res.ok) return cached;

    // A static host with a catch-all route will happily serve index.html here; only trust
    // something that actually parses as JSON and carries an email.
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) return cached;

    const data = await res.json();
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) return cached;

    cached = { email, name: String(data?.name || '').trim() };
  } catch {
    /* offline, blocked, or no Access in front — the landing page handles it */
  }
  return cached;
}

/** Test seam: clears the memoised lookup. */
export function resetAccessIdentity() {
  cached = undefined;
}
