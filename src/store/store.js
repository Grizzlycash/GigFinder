// Application state: single store, localStorage-backed, with a tiny subscribe/emit loop.
// Swapping this file for API calls is the only change needed to move off local persistence.

import { seedVenues } from '@/data/venues';
import { uid } from '@/lib/format';

const KEY = 'gigfinder:v1';

/* ---------- Plans ---------- */
export const PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    monthly: 9.99,
    annualMonthly: 7.99, // 20% off
    blurb: 'For musicians starting to build their booking pipeline.',
    features: [
      { label: '15 EPK sends per month', note: 'Resets on your billing date' },
      { label: 'Full venue database access' },
      { label: 'Outreach tracking & history' },
      { label: 'Upload your own EPK' },
      { label: 'Add private venues' },
    ],
    limits: {
      epks: 1,
      sendsPerMonth: 15,
      epkGenerator: false,
      aiRewrite: false,
      privateVenues: true,
      savedLists: 0,
      followUps: false,
      csvExport: false,
      analytics: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthly: 19.99,
    annualMonthly: 15.99, // 20% off
    blurb: 'For working musicians who are actively pitching shows every week.',
    features: [
      { label: 'Unlimited EPK sends' },
      { label: 'Full venue database access' },
      { label: 'Outreach tracking & history' },
      { label: 'Upload your own EPK' },
      { label: 'EPK generator' },
      { label: 'Follow-up reminders' },
      { label: 'Add private venues' },
    ],
    limits: {
      epks: Infinity,
      sendsPerMonth: Infinity,
      epkGenerator: true,
      aiRewrite: true,
      privateVenues: true,
      savedLists: Infinity,
      followUps: true,
      csvExport: true,
      analytics: true,
    },
  },
};

export const ANNUAL_DISCOUNT = 0.2;

export function planPrice(planId, cycle) {
  const plan = PLANS[planId];
  if (!plan) return 0;
  return cycle === 'annual' ? plan.annualMonthly : plan.monthly;
}

export function annualTotal(planId) {
  return +(PLANS[planId].annualMonthly * 12).toFixed(2);
}

/* ---------- Pipeline ---------- */
export const STATUSES = [
  { id: 'emailed', label: 'Emailed', colour: 'var(--color-stamp-emailed)' },
  { id: 'opened', label: 'Opened', colour: 'var(--color-stamp-opened)' },
  { id: 'replied', label: 'Replied', colour: 'var(--color-stamp-replied)' },
  { id: 'booked', label: 'Booked', colour: 'var(--color-stamp-booked)' },
  { id: 'declined', label: 'Passed', colour: 'var(--color-stamp-declined)' },
];

export function statusMeta(id) {
  return STATUSES.find((s) => s.id === id) || { id: 'none', label: 'Not contacted', colour: 'var(--color-stamp-none)' };
}

/* ---------- Defaults ---------- */
function emptyUser() {
  return {
    id: uid('usr'),
    email: '',
    artistName: '',
    realName: '',
    genres: [],
    homeCity: '',
    homeState: '',
    drawSize: '',
    links: { spotify: '', bandcamp: '', youtube: '', instagram: '', website: '' },
    photo: '',
    plan: 'basic',
    cycle: 'monthly',
    isAdmin: false,
    onboarded: false,
    onboardingStep: 1,
    createdAt: new Date().toISOString(),
  };
}

function defaultState() {
  return {
    version: 1,
    session: null, // user id once "signed in"
    users: [],
    venues: seedVenues(),
    epks: [],
    outreach: [],
    lists: [],
    settings: {
      signature: '',
      defaultSubject: '{artist} — booking enquiry for {venue}',
      remindAfterDays: 10,
    },
  };
}

/* ---------- Persistence ---------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    const merged = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
    // Venues ship with the app: top up any newly-seeded rows without clobbering admin edits.
    const byId = new Map((merged.venues || []).map((v) => [v.id, v]));
    for (const v of base.venues) if (!byId.has(v.id)) merged.venues.push(v);
    return merged;
  } catch {
    return defaultState();
  }
}

export const state = load();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function save(notify = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('GigBook: could not persist state', err);
  }
  if (notify) listeners.forEach((fn) => fn(state));
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.hash = '#/';
  location.reload();
}

/* ---------- Session / users ---------- */
export function currentUser() {
  return state.users.find((u) => u.id === state.session) || null;
}

export function signUp(email, artistName = '') {
  const user = { ...emptyUser(), email, artistName };
  state.users.push(user);
  state.session = user.id;
  save();
  return user;
}

export function signIn(email) {
  const user = state.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return null;
  state.session = user.id;
  save();
  return user;
}

export function signOut() {
  state.session = null;
  save();
}

export function updateUser(patch) {
  const user = currentUser();
  if (!user) return null;
  Object.assign(user, patch);
  save();
  return user;
}

/* ---------- Plan helpers ---------- */
export function plan() {
  return PLANS[currentUser()?.plan || 'basic'];
}

export function can(feature) {
  const limit = plan().limits[feature];
  return limit === true || limit === Infinity || (typeof limit === 'number' && limit > 0);
}

export function isPro() {
  return currentUser()?.plan === 'pro';
}

export function sendsThisMonth() {
  const now = new Date();
  return myOutreach().filter((o) => {
    const d = new Date(o.sentAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

export function sendsRemaining() {
  const cap = plan().limits.sendsPerMonth;
  if (cap === Infinity) return Infinity;
  return Math.max(0, cap - sendsThisMonth());
}

/* ---------- Venues ----------
   The shared database plus this artist's own private venues. Private venues never
   leak between accounts; venues submitted to the shared database sit at status
   'pending' until an admin approves them. */
export function activeVenues() {
  const me = currentUser()?.id;
  return state.venues.filter((v) => {
    if (v.status !== 'active') return false;
    if (v.visibility === 'private') return v.ownerId === me;
    return true;
  });
}

export function myPrivateVenues() {
  const me = currentUser()?.id;
  return state.venues.filter((v) => v.visibility === 'private' && v.ownerId === me);
}

export function venueById(id) {
  return state.venues.find((v) => v.id === id) || null;
}

export function upsertVenue(venue) {
  const idx = state.venues.findIndex((v) => v.id === venue.id);
  if (idx >= 0) state.venues[idx] = { ...state.venues[idx], ...venue };
  else state.venues.push({ status: 'active', source: 'manual', addedAt: new Date().toISOString(), ...venue, id: venue.id || uid('ven') });
  save();
}

// visibility: 'private' keeps the venue to this account (live immediately);
// 'shared' submits it to the master database, where it waits for admin review.
export function addVenue(data, visibility = 'private') {
  const user = currentUser();
  const shared = visibility === 'shared';
  const venue = {
    id: uid('ven'),
    name: '', city: '', state: 'VIC', country: 'Australia',
    lat: 0, lng: 0, capacity: 0, type: 'Pub', genres: [],
    contactName: '', contactEmail: '', phone: '', website: '',
    submissionMethod: 'Email', payType: '', notes: '',
    ...data,
    visibility: shared ? 'shared' : 'private',
    ownerId: shared ? null : user?.id || null,
    status: shared ? 'pending' : 'active',
    // Who sent it in, so they can be told what happened to it.
    submittedBy: shared ? user?.id || null : null,
    submittedByEmail: shared ? user?.email || '' : '',
    review: shared ? { state: 'pending', reason: '', at: null, by: '' } : null,
    source: shared ? `submitted by ${user?.email || 'a subscriber'}` : `private · ${user?.email || ''}`,
    addedAt: new Date().toISOString(),
  };
  state.venues.push(venue);
  save();
  return venue;
}

/** The current artist's own submissions, whatever state they're in. */
export function mySubmissions() {
  const me = currentUser()?.id;
  if (!me) return [];
  return state.venues
    .filter((v) => v.submittedBy === me && ['pending', 'rejected'].includes(v.status))
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
}

/** The admin review queue. */
export function pendingSubmissions() {
  return state.venues
    .filter((v) => v.status === 'pending')
    .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
}

/**
 * Is this venue already in the database? Checked when a subscriber submits and again
 * in the review queue, so an admin isn't relying on recognising the name by eye.
 *
 * Searches what the current account can actually see, not every row — otherwise typing
 * a name would quietly confirm the existence of someone else's private venue.
 */
export function findDuplicateVenue({ name, city }, excludeId = null) {
  const n = String(name || '').trim().toLowerCase();
  const c = String(city || '').trim().toLowerCase();
  if (!n) return null;
  return activeVenues().find((v) => (
    v.id !== excludeId
    && v.name.trim().toLowerCase() === n
    && (!c || v.city.trim().toLowerCase() === c)
  )) || null;
}

/** Publish a submission to everyone, optionally with the admin's corrections. */
export function approveVenue(id, patch = {}) {
  const venue = venueById(id);
  if (!venue) return null;
  Object.assign(venue, patch, {
    status: 'active',
    visibility: 'shared',
    review: { state: 'approved', reason: '', at: new Date().toISOString(), by: currentUser()?.email || 'admin' },
  });
  save();
  return venue;
}

/**
 * Decline a submission. The row is kept rather than deleted so the submitter can see
 * what happened and why, and so the same venue isn't submitted again next week.
 */
export function rejectVenue(id, reason = '') {
  const venue = venueById(id);
  if (!venue) return null;
  Object.assign(venue, {
    status: 'rejected',
    review: { state: 'rejected', reason: String(reason || '').trim(), at: new Date().toISOString(), by: currentUser()?.email || 'admin' },
  });
  save();
  return venue;
}

/** The submitter clearing a declined submission from their own list. */
export function dismissSubmission(id) {
  const venue = venueById(id);
  if (!venue || venue.status !== 'rejected' || venue.submittedBy !== currentUser()?.id) return;
  state.venues = state.venues.filter((v) => v.id !== id);
  save();
}

export function deleteVenue(id) {
  state.venues = state.venues.filter((v) => v.id !== id);
  state.outreach = state.outreach.filter((o) => o.venueId !== id);
  save();
}

/* ---------- EPKs ---------- */
export function myEpks() {
  const user = currentUser();
  return state.epks.filter((e) => e.userId === user?.id);
}

export function epkById(id) {
  return state.epks.find((e) => e.id === id) || null;
}

export const EPK_SECTIONS = ['bio', 'photos', 'music', 'socials', 'rider'];

export function createEpk(data = {}) {
  const user = currentUser();
  const links = user.links || {};
  const epk = {
    id: uid('epk'),
    userId: user.id,
    title: data.title || `${user.artistName || 'Untitled'} — EPK`,
    tagline: '',
    shortBio: '',
    longBio: '',
    notable: '',
    genres: user.genres || [],
    homeCity: [user.homeCity, user.homeState].filter(Boolean).join(', '),
    setLength: '60 minutes',
    audienceSize: user.drawSize || '50–150',
    music: { spotify: links.spotify || '', soundcloud: '', appleMusic: '', youtube: links.youtube || '', bandcamp: links.bandcamp || '' },
    socials: { instagram: links.instagram || '', facebook: '', tiktok: '', x: '', website: links.website || '' },
    rider: { format: 'Solo acoustic', pa: 'Yes — venue to provide', mics: '', di: '', monitors: '', setupTime: '30 minutes', notes: '', hospitality: '' },
    photos: user.photo ? [{ id: uid('img'), src: user.photo, label: 'Cover photo' }] : [],
    tracks: [],
    pressQuotes: [],
    uploadedFile: null, // Basic tier: attach a press kit made elsewhere
    isDefault: state.epks.filter((e) => e.userId === user.id).length === 0,
    updatedAt: new Date().toISOString(),
    ...data,
  };
  state.epks.push(epk);
  save();
  return epk;
}

// Older EPKs (and imported ones) may predate the sectioned model.
export function normaliseEpk(epk) {
  if (!epk) return epk;
  const legacy = epk.links || {};
  epk.music = { spotify: '', soundcloud: '', appleMusic: '', youtube: '', bandcamp: '', ...legacy, ...(epk.music || {}) };
  epk.socials = { instagram: '', facebook: '', tiktok: '', x: '', website: '', ...(epk.socials || {}) };
  epk.rider = { format: '', pa: '', mics: '', di: '', monitors: '', setupTime: '', notes: '', hospitality: '', ...(epk.rider || {}) };
  epk.photos = epk.photos || (epk.photo ? [{ id: uid('img'), src: epk.photo, label: 'Cover photo' }] : []);
  epk.tracks = epk.tracks || [];
  epk.pressQuotes = epk.pressQuotes || [];
  epk.notable = epk.notable || '';
  return epk;
}

// Which of the five generator sections have real content in them.
export function epkProgress(epk) {
  if (!epk) return { done: [], count: 0, total: EPK_SECTIONS.length };
  const e = normaliseEpk(epk);
  const done = {
    bio: Boolean(e.shortBio && e.shortBio.trim().length > 20),
    photos: (e.photos || []).length > 0,
    music: Object.values(e.music).some(Boolean) || (e.tracks || []).some((t) => t.url),
    socials: Object.values(e.socials).some(Boolean),
    // format/pa ship with defaults, so they alone don't count as filled in.
    rider: Boolean(e.rider.format && e.rider.pa
      && (e.rider.mics || e.rider.di || e.rider.monitors || e.rider.notes || e.rider.hospitality)),
  };
  return { done, count: Object.values(done).filter(Boolean).length, total: EPK_SECTIONS.length };
}

export function updateEpk(id, patch) {
  const epk = epkById(id);
  if (!epk) return null;
  Object.assign(epk, patch, { updatedAt: new Date().toISOString() });
  save();
  return epk;
}

export function deleteEpk(id) {
  state.epks = state.epks.filter((e) => e.id !== id);
  save();
}

export function defaultEpk() {
  const mine = myEpks();
  return mine.find((e) => e.isDefault) || mine[0] || null;
}

/* ---------- Outreach ---------- */
export function myOutreach() {
  const user = currentUser();
  return state.outreach.filter((o) => o.userId === user?.id);
}

export function outreachById(id) {
  return state.outreach.find((o) => o.id === id) || null;
}

export function outreachForVenue(venueId) {
  return myOutreach().filter((o) => o.venueId === venueId).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] || null;
}

export function recordSend({ venueId, epkId, to, subject, body }) {
  const user = currentUser();
  const now = new Date().toISOString();
  const followUpAt = plan().limits.followUps
    ? new Date(Date.now() + state.settings.remindAfterDays * 86400000).toISOString()
    : null;
  const record = {
    id: uid('out'),
    userId: user.id,
    venueId,
    epkId,
    to,
    subject,
    body,
    status: 'emailed',
    sentAt: now,
    updatedAt: now,
    followUpAt,
    notes: '',
    history: [{ at: now, label: 'Email sent', detail: to }],
  };
  state.outreach.push(record);
  save();
  return record;
}

export function setOutreachStatus(id, status) {
  const record = outreachById(id);
  if (!record || record.status === status) return record;
  const now = new Date().toISOString();
  record.status = status;
  record.updatedAt = now;
  record.history.push({ at: now, label: `Marked ${statusMeta(status).label.toLowerCase()}` });
  if (status === 'booked' || status === 'declined') record.followUpAt = null;
  save();
  return record;
}

export function updateOutreach(id, patch) {
  const record = outreachById(id);
  if (!record) return null;
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  save();
  return record;
}

export function deleteOutreach(id) {
  state.outreach = state.outreach.filter((o) => o.id !== id);
  save();
}

export function dueFollowUps() {
  const now = Date.now();
  return myOutreach().filter(
    (o) => o.followUpAt && new Date(o.followUpAt).getTime() <= now && ['emailed', 'opened'].includes(o.status),
  );
}

/* ---------- Saved lists (Pro) ---------- */
export function myLists() {
  const user = currentUser();
  return state.lists.filter((l) => l.userId === user?.id);
}

export function createList(name) {
  const list = { id: uid('lst'), userId: currentUser().id, name, venueIds: [], createdAt: new Date().toISOString() };
  state.lists.push(list);
  save();
  return list;
}

export function toggleListVenue(listId, venueId) {
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return;
  list.venueIds = list.venueIds.includes(venueId)
    ? list.venueIds.filter((v) => v !== venueId)
    : [...list.venueIds, venueId];
  save();
}

export function deleteList(id) {
  state.lists = state.lists.filter((l) => l.id !== id);
  save();
}

/* ---------- Stats ---------- */
export function outreachStats() {
  const mine = myOutreach();
  const by = (id) => mine.filter((o) => o.status === id).length;
  const sent = mine.length;
  const replied = by('replied') + by('booked') + by('declined');
  return {
    sent,
    opened: by('opened') + replied,
    replied,
    booked: by('booked'),
    declined: by('declined'),
    replyRate: sent ? Math.round((replied / sent) * 100) : 0,
    bookRate: sent ? Math.round((by('booked') / sent) * 100) : 0,
  };
}

/* ---------- Demo data ---------- */
export function loadDemoOutreach() {
  const user = currentUser();
  const epk = defaultEpk() || createEpk();
  const picks = activeVenues().slice(0, 12);
  const script = ['emailed', 'emailed', 'opened', 'opened', 'replied', 'replied', 'booked', 'booked', 'declined', 'emailed', 'opened', 'replied'];
  picks.forEach((venue, i) => {
    if (myOutreach().some((o) => o.venueId === venue.id)) return;
    const sentAt = new Date(Date.now() - (i * 3 + 2) * 86400000).toISOString();
    const status = script[i % script.length];
    state.outreach.push({
      id: uid('out'),
      userId: user.id,
      venueId: venue.id,
      epkId: epk.id,
      to: venue.contactEmail,
      subject: `${user.artistName || 'Artist'} — booking enquiry for ${venue.name}`,
      body: epk.shortBio || 'Sample outreach email body.',
      status,
      sentAt,
      updatedAt: sentAt,
      followUpAt: ['emailed', 'opened'].includes(status) && plan().limits.followUps
        ? new Date(Date.now() + (5 - (i % 8)) * 86400000).toISOString()
        : null,
      notes: status === 'booked' ? 'Confirmed for a Thursday support slot.' : '',
      history: [{ at: sentAt, label: 'Email sent', detail: venue.contactEmail }],
    });
  });
  save();
}
