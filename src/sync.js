import { supabase } from './supabase';
import { db } from './db';

// ===========================================================================
// sync.js — the cloud mirror.
//
// Model: local-first. The app always reads/writes Dexie (instant, offline-safe).
// This module mirrors that local data to Supabase and pulls remote changes in.
//
// Matching: local rows use Dexie's auto-increment id, the cloud uses UUIDs, so
// we never match on id. The real identity of a row is:
//   - entries:       (user_id, date)   — one entry per day per user
//   - habits_config: (user_id, key)    — one habit per key per user
// Both have UNIQUE constraints in Postgres, so we upsert on those.
//
// Conflict rule (spec): if the same date exists locally and remotely with
// different content, the more recently updated (updated_at) version wins.
// ===========================================================================

// Columns that exist in the cloud `entries` table. We strip anything else
// (like Dexie's local `id`) before sending.
const ENTRY_COLS = [
  'date', 'mood', 'sleep_hours', 'sleep_score', 'weight_kg', 'calories',
  'focused_hours', 'pushups', 'screen_time_hours', 'drink_score',
  'note', 'habits', 'created_at', 'updated_at'
];
const HABIT_COLS = ['name', 'icon', 'key', 'type', 'sort_order', 'active'];

const pick = (obj, cols) => {
  const out = {};
  for (const c of cols) if (obj[c] !== undefined) out[c] = obj[c];
  return out;
};

// Get the current user's id, or null if not logged in.
async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// PUSH — send one local entry up to the cloud. Called after every save.
// Upserts on (user_id, date) so re-saving a day overwrites the cloud row.
// Returns true on success, false if offline/failed (caller can ignore).
// ---------------------------------------------------------------------------
export async function pushEntry(entry) {
  const userId = await currentUserId();
  if (!userId) return false;
  try {
    const row = { ...pick(entry, ENTRY_COLS), user_id: userId };
    const { error } = await supabase
      .from('entries')
      .upsert(row, { onConflict: 'user_id,date' });
    if (error) { console.warn('pushEntry failed:', error.message); return false; }
    return true;
  } catch (e) {
    // Offline or network error — the local save already succeeded, so this is
    // non-fatal. A later reconcile (next login / back-online) will catch up.
    console.warn('pushEntry offline:', e.message);
    return false;
  }
}

// Push one habit_config row (used by the habit manager and seeding).
export async function pushHabit(habit) {
  const userId = await currentUserId();
  if (!userId) return false;
  try {
    const row = { ...pick(habit, HABIT_COLS), user_id: userId };
    const { error } = await supabase
      .from('habits_config')
      .upsert(row, { onConflict: 'user_id,key' });
    if (error) { console.warn('pushHabit failed:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('pushHabit offline:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// PULL — fetch all the user's cloud rows.
// ---------------------------------------------------------------------------
async function pullEntries() {
  const { data, error } = await supabase.from('entries').select('*');
  if (error) throw error;
  return data || [];
}
async function pullHabits() {
  const { data, error } = await supabase
    .from('habits_config').select('*').order('sort_order');
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// SEED — ensure this user has the default habits in the cloud. Replaces the old
// local-only seedHabits and is race-proof: upsert on (user_id, key) means even
// if it runs twice, the same key just overwrites itself — never duplicates.
// ---------------------------------------------------------------------------
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

async function seedCloudHabitsIfEmpty(userId) {
  const { data, error } = await supabase
    .from('habits_config').select('key').limit(1);
  if (error) throw error;
  if (data && data.length > 0) return; // user already has habits
  const rows = DEFAULT_HABITS.map(h => ({ ...h, user_id: userId }));
  const { error: insErr } = await supabase
    .from('habits_config').upsert(rows, { onConflict: 'user_id,key' });
  if (insErr) throw insErr;
}

// ---------------------------------------------------------------------------
// RECONCILE — the main two-way sync. Run on login and when coming back online.
//
// Habits: cloud is the source of truth for the list. We seed defaults for new
// users, then mirror the cloud habit list into the local table (replace), so
// every device shows the same habits. (Habit edits still push up immediately
// via pushHabit; this just makes a fresh device match.)
//
// Entries: merge by date using updated_at as the tiebreaker.
//   - cloud-only date  -> insert locally
//   - local-only date  -> push to cloud
//   - both, cloud newer -> overwrite local
//   - both, local newer -> push local to cloud
// ---------------------------------------------------------------------------
export async function reconcile() {
  const userId = await currentUserId();
  if (!userId) return { ok: false, reason: 'not-logged-in' };

  try {
    // ---- Habits ----
    await seedCloudHabitsIfEmpty(userId);
    const cloudHabits = await pullHabits();
    // Mirror cloud habits into local table (replace wholesale — cloud wins for
    // the list itself). Preserve nothing local-only here, because a brand-new
    // device's local table may be empty or stale.
    await db.transaction('rw', db.habits_config, async () => {
      await db.habits_config.clear();
      // strip cloud-only fields (id, user_id) before storing locally
      await db.habits_config.bulkAdd(
        cloudHabits.map(h => ({
          name: h.name, icon: h.icon, key: h.key,
          type: h.type, sort_order: h.sort_order, active: h.active
        }))
      );
    });

    // ---- Entries ----
    const cloudEntries = await pullEntries();
    const localEntries = await db.entries.toArray();

    const cloudByDate = new Map(cloudEntries.map(e => [e.date, e]));
    const localByDate = new Map(localEntries.map(e => [e.date, e]));

    const toPush = [];     // local entries newer/only -> cloud
    const toLocalPut = []; // cloud entries newer/only -> local

    // Walk every date seen in either place.
    const allDates = new Set([...cloudByDate.keys(), ...localByDate.keys()]);
    for (const date of allDates) {
      const c = cloudByDate.get(date);
      const l = localByDate.get(date);
      if (c && !l) {
        toLocalPut.push(c);
      } else if (l && !c) {
        toPush.push(l);
      } else {
        // both exist — newer updated_at wins
        const cT = new Date(c.updated_at || c.created_at || 0).getTime();
        const lT = new Date(l.updated_at || l.created_at || 0).getTime();
        if (cT > lT) toLocalPut.push(c);
        else if (lT > cT) toPush.push(l);
        // equal -> already in sync, skip
      }
    }

    // Apply cloud->local
    if (toLocalPut.length) {
      await db.transaction('rw', db.entries, async () => {
        for (const c of toLocalPut) {
          const existing = await db.entries.where('date').equals(c.date).first();
          const localRow = {
            date: c.date, mood: c.mood,
            sleep_hours: c.sleep_hours, sleep_score: c.sleep_score,
            weight_kg: c.weight_kg, calories: c.calories,
            focused_hours: c.focused_hours, pushups: c.pushups,
            screen_time_hours: c.screen_time_hours, drink_score: c.drink_score,
            note: c.note, habits: c.habits,
            created_at: c.created_at, updated_at: c.updated_at
          };
          if (existing) await db.entries.update(existing.id, localRow);
          else await db.entries.add(localRow);
        }
      });
    }

    // Apply local->cloud
    for (const l of toPush) {
      await pushEntry(l);
    }

    return { ok: true, pulled: toLocalPut.length, pushed: toPush.length };
  } catch (e) {
    console.warn('reconcile failed:', e.message);
    return { ok: false, reason: e.message };
  }
}
