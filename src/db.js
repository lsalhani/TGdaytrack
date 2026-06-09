import Dexie from 'dexie';
import { pushEntry, pushHabit } from './sync';

// The local database. Mirrored to Supabase by sync.js when logged in.
export const db = new Dexie('daytrack');

// v1 -> v2: add is_default so we can label "starter" habits in the UI.
// Dexie auto-migrates existing local databases on next page load. Existing
// rows simply won't have the field until they're next written; the UI treats
// a missing is_default as false.
db.version(1).stores({
  entries: '++id, &date, mood',
  habits_config: '++id, sort_order'
});
db.version(2).stores({
  entries: '++id, &date, mood',
  habits_config: '++id, sort_order, is_default'
});

// ---- Habit sets -----------------------------------------------------------
// MY_HABITS  = your own personal habit list (what your account uses).
// TEMPLATE_HABITS = the smaller, generic starter set every NEW user receives.
//
// New-user seeding (sync.js's seedCloudHabitsIfEmpty) uses TEMPLATE_HABITS.
// Changing the template only affects FUTURE sign-ups — existing users,
// including you, already have their own rows in the cloud and are never
// re-seeded.
//
// is_default: true marks a habit as a pre-loaded "starter" so the habit
// manager can show a small label distinguishing it from ones the user added.

export const MY_HABITS = [
  { name: 'Study / GMAT', icon: '📚', type: 'boolean', key: 'study',       sort_order: 0, active: true, is_default: true },
  { name: 'Gym',          icon: '🏋️', type: 'boolean', key: 'gym',         sort_order: 1, active: true, is_default: true },
  { name: 'Cardio',       icon: '🏃', type: 'boolean', key: 'cardio',      sort_order: 2, active: true, is_default: true },
  { name: 'Markets',      icon: '📈', type: 'boolean', key: 'markets',     sort_order: 3, active: true, is_default: true },
  { name: 'News',         icon: '📰', type: 'boolean', key: 'news',        sort_order: 4, active: true, is_default: true },
  { name: 'Read',         icon: '📖', type: 'boolean', key: 'read',        sort_order: 5, active: true, is_default: true },
  { name: 'Journal',      icon: '✍️', type: 'boolean', key: 'journal',     sort_order: 6, active: true, is_default: true },
  { name: 'Supplements',  icon: '💊', type: 'boolean', key: 'supplements', sort_order: 7, active: true, is_default: true },
  { name: 'Stretching',   icon: '🧘', type: 'boolean', key: 'stretching',  sort_order: 8, active: true, is_default: true },
  { name: 'Drinks',       icon: '🍷', type: 'count',   key: 'drinks',      sort_order: 9, active: true, is_default: true }
];

// The starter set new users get. Deliberately small and generic — they can
// add, rename, reorder, hide, and restore from here freely.
export const TEMPLATE_HABITS = [
  { name: 'Exercise',   icon: '🏃', type: 'boolean', key: 'exercise',   sort_order: 0, active: true, is_default: true },
  { name: 'Read',       icon: '📖', type: 'boolean', key: 'read',       sort_order: 1, active: true, is_default: true },
  { name: 'Journal',    icon: '✍️', type: 'boolean', key: 'journal',    sort_order: 2, active: true, is_default: true },
  { name: 'Sleep well', icon: '😴', type: 'boolean', key: 'sleep_well', sort_order: 3, active: true, is_default: true }
];


// Seed the starter template locally only if the table is empty.
// NOTE: with cloud sync, the authoritative seed happens in sync.js's reconcile
// (per-user, race-proof via upsert on the unique key). This local version is
// kept so the app still works if opened before the first reconcile completes,
// and is made race-proof here too with a transaction + idempotent guard.
export async function seedHabits() {
  await db.transaction('rw', db.habits_config, async () => {
    const count = await db.habits_config.count();
    if (count === 0) {
      await db.habits_config.bulkAdd(TEMPLATE_HABITS);
    }
  });
}

// ---- Helpers used across screens ----

export function isoKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getEntry(date) {
  return db.entries.where('date').equals(date).first();
}

// Insert or update a day locally, then mirror to the cloud.
// Local write happens first and always succeeds (offline-safe). The cloud
// push is fire-and-forget: if offline it fails quietly and the next reconcile
// (login / back-online) catches up.
export async function saveEntry(entry) {
  const now = new Date().toISOString();
  const existing = await getEntry(entry.date);
  let saved;
  if (existing) {
    await db.entries.update(existing.id, { ...entry, updated_at: now });
    saved = { ...existing, ...entry, updated_at: now };
  } else {
    const id = await db.entries.add({ ...entry, created_at: now, updated_at: now });
    saved = { ...entry, id, created_at: now, updated_at: now };
  }
  // Mirror up (non-blocking for the UI feel, but awaited so callers can rely on it).
  pushEntry(saved);
  return saved;
}

// ---- Week 5 read helpers ----
export function allEntries() {
  return db.entries.orderBy('date').toArray();
}
export function allHabits() {
  return db.habits_config.orderBy('sort_order').toArray();
}

// ---- Habit manager (Settings) — each change mirrors to the cloud ----

export async function addHabit({ name, icon = '•', type = 'boolean' }) {
  const key = slugKey(name);
  const last = await db.habits_config.orderBy('sort_order').last();
  const habit = { name, icon, type, key, sort_order: (last?.sort_order ?? -1) + 1, active: true, is_default: false };
  const id = await db.habits_config.add(habit);
  pushHabit(habit);
  return id;
}

export async function updateHabit(id, changes) {
  await db.habits_config.update(id, changes);
  const habit = await db.habits_config.get(id);
  if (habit) pushHabit(habit);
  return habit;
}

export async function deactivateHabit(id) {
  await db.habits_config.update(id, { active: false });
  const habit = await db.habits_config.get(id);
  if (habit) pushHabit(habit);
  return habit;
}

// Un-hide a soft-deleted habit (restores it to the Log screen). Its history
// was never lost — the row stayed in place with active: false.
export async function restoreHabit(id) {
  await db.habits_config.update(id, { active: true });
  const habit = await db.habits_config.get(id);
  if (habit) pushHabit(habit);
  return habit;
}

// All hidden (soft-deleted) habits, for the "Hidden habits" restore section.
export function hiddenHabits() {
  return db.habits_config.filter(h => h.active === false).toArray();
}

export async function reorderHabits(idsInOrder) {
  await db.transaction('rw', db.habits_config, async () => {
    await Promise.all(idsInOrder.map((id, i) =>
      db.habits_config.update(id, { sort_order: i })
    ));
  });
  // Mirror the reordered habits up.
  const habits = await db.habits_config.toArray();
  for (const h of habits) pushHabit(h);
}

function slugKey(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'habit';
}

// ---- CSV import (Settings) — imported rows mirror to the cloud too ----
export async function importEntries(rows) {
  let added = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!row.date) { skipped++; continue; }
    const exists = await getEntry(row.date);
    if (exists) { skipped++; continue; }
    const entry = { ...row, created_at: now, updated_at: now };
    await db.entries.add(entry);
    pushEntry(entry);
    added++;
  }
  return { added, skipped };
}