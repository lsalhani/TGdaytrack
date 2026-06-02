import Dexie from 'dexie';

// The local database. In Phase 4 this same data moves to Supabase,
// but the shape stays identical so the migration is painless.
export const db = new Dexie('daytrack');

// Version 1 schema.
// The string after each table name lists the INDEXED fields — these are
// the columns you can query/sort by quickly. Other fields (mood, note,
// habits, etc.) are still stored, just not indexed.
//   '++id'  -> auto-incrementing primary key
//   '&date' -> 'date' is unique (one entry per day) and indexed
db.version(1).stores({
  entries: '++id, &date, mood',
  habits_config: '++id, sort_order'
});

// ---- Default habits, seeded on first run (mirrors the spreadsheet) ----
const DEFAULT_HABITS = [
  { name: 'Study / GMAT', icon: '📚', type: 'boolean', key: 'study',       sort_order: 0, active: true },
  { name: 'Gym',          icon: '🏋️', type: 'boolean', key: 'gym',         sort_order: 1, active: true },
  { name: 'Cardio',       icon: '🏃', type: 'boolean', key: 'cardio',      sort_order: 2, active: true },
  { name: 'Markets',      icon: '📈', type: 'boolean', key: 'markets',     sort_order: 3, active: true },
  { name: 'News',         icon: '📰', type: 'boolean', key: 'news',        sort_order: 4, active: true },
  { name: 'Read',         icon: '📖', type: 'boolean', key: 'read',        sort_order: 5, active: true },
  { name: 'Journal',      icon: '✍️', type: 'boolean', key: 'journal',     sort_order: 6, active: true },
  { name: 'Supplements',  icon: '💊', type: 'boolean', key: 'supplements', sort_order: 7, active: true },
  { name: 'Stretching',   icon: '🧘', type: 'boolean', key: 'stretching',  sort_order: 8, active: true },
  { name: 'Drinks',       icon: '🍷', type: 'count',   key: 'drinks',      sort_order: 9, active: true }
];

// Seed defaults only if the table is empty.
export async function seedHabits() {
  const count = await db.habits_config.count();
  if (count === 0) {
    await db.habits_config.bulkAdd(DEFAULT_HABITS);
  }
}

// ---- Helpers used across screens ----

// Local-time YYYY-MM-DD (NOT UTC) so "today" matches the user's calendar.
export function isoKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Read one day's entry (or null).
export function getEntry(date) {
  return db.entries.where('date').equals(date).first();
}

// Insert or update a day. One entry per date is enforced by the unique index.
export async function saveEntry(entry) {
  const now = new Date().toISOString();
  const existing = await getEntry(entry.date);
  if (existing) {
    return db.entries.update(existing.id, { ...entry, updated_at: now });
  }
  return db.entries.add({ ...entry, created_at: now, updated_at: now });
}

// ---- Helpers added in Week 5 (Insights / History / Settings) ----

// All entries, ascending by date. Used by Insights, History, and CSV export.
export function allEntries() {
  return db.entries.orderBy('date').toArray();
}

// The habit config, ordered for display. Insights and Settings both read this.
export function allHabits() {
  return db.habits_config.orderBy('sort_order').toArray();
}

// ---- Habit manager (Settings) ----

export async function addHabit({ name, icon = '•', type = 'boolean' }) {
  const key = slugKey(name);
  const last = await db.habits_config.orderBy('sort_order').last();
  return db.habits_config.add({
    name, icon, type, key,
    sort_order: (last?.sort_order ?? -1) + 1,
    active: true
  });
}

export function updateHabit(id, changes) {
  return db.habits_config.update(id, changes);
}

// Soft-delete keeps historical data intact (spec: hidden habits are retained).
export function deactivateHabit(id) {
  return db.habits_config.update(id, { active: false });
}

// Persist a reordered list: writes each habit's new sort_order.
export async function reorderHabits(idsInOrder) {
  await db.transaction('rw', db.habits_config, async () => {
    await Promise.all(idsInOrder.map((id, i) =>
      db.habits_config.update(id, { sort_order: i })
    ));
  });
}

// Turn a display name into a stable habit key, e.g. "Cold Plunge" -> "cold_plunge".
function slugKey(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'habit';
}

// ---- CSV import (Settings) ----
// Bulk insert entries from parsed CSV rows. Existing dates are skipped so a
// re-import never clobbers real logs. Returns { added, skipped }.
export async function importEntries(rows) {
  let added = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!row.date) { skipped++; continue; }
    const exists = await getEntry(row.date);
    if (exists) { skipped++; continue; }
    await db.entries.add({ ...row, created_at: now, updated_at: now });
    added++;
  }
  return { added, skipped };
}
