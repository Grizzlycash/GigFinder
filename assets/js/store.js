// Application state: single store, localStorage-backed, with a tiny subscribe/emit loop.
// Swapping this file for API calls is the only change needed to move off local persistence.

import { seedVenues } from './seed.js';
import { uid } from './ui.js';

const KEY = 'gigbook:v1';

/* ---------- Plans ---------- */
export const PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    monthly: 9.99,
    annualMonthly: 7.99, // 20% off
    blurb: 'Everything you need to start booking shows yourself.',
    features: [
      'Full shared venue database',
      'Map view with venue pins',
      '1 Electronic Press Kit',
      '25 EPK sends per month',
      'Outreach tracker (5-stage pipeline)',
    ],
    missing: ['Unlimited EPK sends', 'Multiple EPKs', 'Follow-up reminders', 'Saved venue lists', 'CSV export', 'Outreach analytics'],
    limits: {
      epks: 1,
      sendsPerMonth: 25,
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
    blurb: 'For working artists running outreach at tour scale.',
    features: [
      'Everything in Basic',
      'Unlimited EPK sends',
      'Unlimited EPKs (one per project or single)',
      'Follow-up reminders',
      'Saved venue lists for routing tours',
      'CSV export of venues and outreach',
      'Outreach analytics (reply and booking rates)',
    ],
    missing: [],
    limits: {
      epks: Infinity,
      sendsPerMonth: Infinity,
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
  { id: 'sent', label: 'Sent', cls: 'st-sent', colour: '#2F6FE4' },
  { id: 'opened', label: 'Opened', cls: 'st-opened', colour: '#C97A05' },
  { id: 'replied', label: 'Replied', cls: 'st-replied', colour: '#7C4DBC' },
  { id: 'booked', label: 'Booked', cls: 'st-booked', colour: '#1D9E75' },
  { id: 'declined', label: 'Declined', cls: 'st-declined', colour: '#C0392B' },
];

export function statusMeta(id) {
  return STATUSES.find((s) => s.id === id) || { id: 'none', label: 'Not contacted', cls: 'st-none', colour: '#6B7A74' };
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

/* ---------- Venues ---------- */
export function activeVenues() {
  return state.venues.filter((v) => v.status === 'active');
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

export function suggestVenue(data) {
  const user = currentUser();
  const venue = {
    id: uid('ven'),
    name: '', city: '', state: '', country: 'USA',
    lat: 0, lng: 0, capacity: 0, type: 'Club', genres: [],
    contactName: '', contactEmail: '', phone: '', website: '',
    submissionMethod: 'Email', payType: '', notes: '',
    ...data,
    status: 'pending',
    source: `submitted by ${user?.email || 'a subscriber'}`,
    addedAt: new Date().toISOString(),
  };
  state.venues.push(venue);
  save();
  return venue;
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

export function createEpk(data = {}) {
  const user = currentUser();
  const epk = {
    id: uid('epk'),
    userId: user.id,
    title: data.title || `${user.artistName || 'Untitled'} — EPK`,
    tagline: '',
    shortBio: '',
    longBio: '',
    genres: user.genres || [],
    homeCity: [user.homeCity, user.homeState].filter(Boolean).join(', '),
    links: { ...user.links },
    tracks: [],
    pressQuotes: [],
    photo: user.photo || '',
    isDefault: state.epks.filter((e) => e.userId === user.id).length === 0,
    updatedAt: new Date().toISOString(),
    ...data,
  };
  state.epks.push(epk);
  save();
  return epk;
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
    status: 'sent',
    sentAt: now,
    updatedAt: now,
    followUpAt,
    notes: '',
    history: [{ at: now, label: 'EPK sent', detail: to }],
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
    (o) => o.followUpAt && new Date(o.followUpAt).getTime() <= now && ['sent', 'opened'].includes(o.status),
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
  const script = ['sent', 'sent', 'opened', 'opened', 'replied', 'replied', 'booked', 'booked', 'declined', 'sent', 'opened', 'replied'];
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
      followUpAt: ['sent', 'opened'].includes(status) && plan().limits.followUps
        ? new Date(Date.now() + (5 - (i % 8)) * 86400000).toISOString()
        : null,
      notes: status === 'booked' ? 'Confirmed for a Thursday support slot.' : '',
      history: [{ at: sentAt, label: 'EPK sent', detail: venue.contactEmail }],
    });
  });
  save();
}
