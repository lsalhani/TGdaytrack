// Insights engine — pure functions. Each takes the entries array (and the
// habits_config list where it needs habit names) and returns an insight
// object { type, icon, color, headline, body } or null when there isn't
// enough signal. The screen collects the non-null ones and renders them.
//
// "Lenient" mode: insights show whenever they're computable, rather than
// requiring a hard 14-day minimum. Each insight sets its own small minimum
// (e.g. needs at least a few of each kind of day) so the output stays honest.

import { avg } from './stats.js';

// ---- small local helpers ----

const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// Average a numeric field over entries where a predicate holds, ignoring nulls.
function avgWhere(entries, field, pred = () => true) {
  const vals = entries.filter(pred).map(e => e[field]).filter(v => v != null);
  return vals.length ? avg(vals) : null;
}

// Completion % for a boolean habit key over a set of entries (0..1).
function completion(entries, key) {
  if (!entries.length) return 0;
  const done = entries.filter(e => e.habits?.[key] === true).length;
  return done / entries.length;
}

// Month helpers, working off the YYYY-MM-DD date string.
const monthKey = (dateStr) => dateStr.slice(0, 7); // "2026-05"
function inThisMonth(dateStr, now = new Date()) {
  return monthKey(dateStr) === monthKey(isoOf(now));
}
function inLastMonth(dateStr, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthKey(dateStr) === monthKey(isoOf(d));
}
function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const monthLabel = (dateStr) => MONTH_NAMES[Number(dateStr.slice(5, 7)) - 1];

// Lookup display name for a habit key, falling back to the key itself.
function habitName(habitsConfig, key) {
  const h = habitsConfig.find(x => x.key === key);
  return h ? h.name : key;
}

// =====================================================================
// 1. Correlation — does a habit go with better sleep score?
//    Generalised version of the spec's gymVsSleep: runs for every boolean
//    habit and surfaces the strongest sleep-score difference.
// =====================================================================
export function sleepCorrelation(entries, habitsConfig) {
  let best = null;
  for (const h of habitsConfig) {
    if (h.type !== 'boolean') continue;
    const onDays  = entries.filter(e => e.habits?.[h.key] === true);
    const offDays = entries.filter(e => !e.habits?.[h.key]);
    if (onDays.length < 3 || offDays.length < 3) continue;

    const aOn  = avgWhere(onDays,  'sleep_score');
    const aOff = avgWhere(offDays, 'sleep_score');
    if (aOn == null || aOff == null) continue;

    const diff = aOn - aOff;
    if (Math.abs(diff) < 4) continue; // not meaningful
    if (!best || Math.abs(diff) > Math.abs(best.diff)) {
      best = { key: h.key, name: h.name, aOn, aOff, diff };
    }
  }
  if (!best) return null;
  const better = best.diff > 0;
  return {
    type: 'correlation',
    icon: better ? '😴' : '⚠️',
    color: better ? 'purple' : 'coral',
    headline: better ? `${best.name} days = better sleep` : `${best.name} days = worse sleep`,
    body: `On ${best.name.toLowerCase()} days your avg sleep score is ${round(best.aOn)} vs ${round(best.aOff)} on other days (${best.diff > 0 ? '+' : ''}${round(best.diff)} pts).`
  };
}

// =====================================================================
// 2. Mood pattern — does a habit go with higher mood?
// =====================================================================
export function moodPattern(entries, habitsConfig) {
  let best = null;
  for (const h of habitsConfig) {
    if (h.type !== 'boolean') continue;
    const onDays  = entries.filter(e => e.habits?.[h.key] === true);
    const offDays = entries.filter(e => !e.habits?.[h.key]);
    if (onDays.length < 3 || offDays.length < 3) continue;

    const aOn  = avgWhere(onDays,  'mood');
    const aOff = avgWhere(offDays, 'mood');
    if (aOn == null || aOff == null) continue;

    const diff = aOn - aOff;
    if (Math.abs(diff) < 0.4) continue;
    if (!best || Math.abs(diff) > Math.abs(best.diff)) {
      best = { name: h.name, aOn, aOff, diff };
    }
  }
  if (!best) return null;
  const better = best.diff > 0;
  return {
    type: 'mood',
    icon: better ? '🙂' : '🌧️',
    color: better ? 'teal' : 'coral',
    headline: better
      ? `Your mood is higher on ${best.name.toLowerCase()} days`
      : `Your mood dips on ${best.name.toLowerCase()} days`,
    body: `Avg ${round(best.aOn, 1)} vs ${round(best.aOff, 1)} on other days.`
  };
}

// =====================================================================
// 3. Sleep streak — longest run of consecutive days at/above target.
// =====================================================================
export function sleepStreak(entries, target = 7.5) {
  // entries assumed sorted ascending by date (the hook returns them so)
  let best = 0, run = 0, prev = null, bestEnd = null, curEnd = null;
  for (const e of entries) {
    if (e.sleep_hours == null) { run = 0; prev = null; continue; }
    const ok = e.sleep_hours >= target;
    if (ok) {
      const gap = prev ? (new Date(e.date) - new Date(prev)) / 86400000 : null;
      run = gap === 1 ? run + 1 : 1;
      prev = e.date;
      curEnd = e.date;
      if (run > best) { best = run; bestEnd = curEnd; }
    } else {
      run = 0; prev = null;
    }
  }
  if (best < 3) return null;
  return {
    type: 'streak',
    icon: '🌙',
    color: 'purple',
    headline: `${best} days hitting your sleep target`,
    body: `You've slept ${target}h or more for ${best} consecutive days — keep it going.`
  };
}

// =====================================================================
// 4. Habit slip — completion dropped vs last month.
// =====================================================================
export function habitSlip(entries, habitsConfig) {
  const thisMonth = entries.filter(e => inThisMonth(e.date));
  const lastMonth = entries.filter(e => inLastMonth(e.date));
  if (thisMonth.length < 5 || lastMonth.length < 5) return null;

  let worst = null;
  for (const h of habitsConfig) {
    if (h.type !== 'boolean') continue;
    const cur  = completion(thisMonth, h.key);
    const prev = completion(lastMonth, h.key);
    const drop = prev - cur;
    if (drop < 0.2) continue; // less than 20-point drop, not notable
    if (!worst || drop > worst.drop) {
      worst = { name: h.name, cur, prev, drop };
    }
  }
  if (!worst) return null;
  return {
    type: 'slip',
    icon: '🔥',
    color: 'coral',
    headline: `${worst.name} is slipping`,
    body: `Only ${round(worst.cur * 100)}% this month vs ${round(worst.prev * 100)}% last month.`
  };
}

// =====================================================================
// 5. Weight trend — net change across the data, with recent pace note.
// =====================================================================
export function weightTrend(entries) {
  const w = entries.filter(e => e.weight_kg != null);
  if (w.length < 5) return null;
  const first = w[0];
  const last  = w[w.length - 1];
  const delta = round(last.weight_kg - first.weight_kg, 1);
  if (Math.abs(delta) < 0.5) return null;

  const since = monthLabel(first.date);
  const down = delta < 0;
  return {
    type: 'weight',
    icon: down ? '📉' : '📈',
    color: 'teal',
    headline: `${down ? 'Down' : 'Up'} ${Math.abs(delta)} kg since ${since}`,
    body: `From ${round(first.weight_kg, 1)} kg to ${round(last.weight_kg, 1)} kg over ${w.length} logged days.`
  };
}

// =====================================================================
// 6. Best day of week — which weekday has the most focused hours.
// =====================================================================
export function bestDayOfWeek(entries) {
  const buckets = Array.from({ length: 7 }, () => []);
  for (const e of entries) {
    if (e.focused_hours == null) continue;
    const dow = new Date(e.date).getDay(); // 0 = Sun
    buckets[dow].push(e.focused_hours);
  }
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let best = null;
  buckets.forEach((vals, i) => {
    if (vals.length < 2) return;
    const a = avg(vals);
    if (!best || a > best.avg) best = { day: days[i], avg: a };
  });
  if (!best || best.avg < 0.5) return null;
  return {
    type: 'bestday',
    icon: '⭐',
    color: 'amber',
    headline: `${best.day}s are your most productive day`,
    body: `Avg ${round(best.avg, 1)} focused hours on ${best.day}s.`
  };
}

// =====================================================================
// Aggregator — runs everything, drops nulls, returns the insight array.
// =====================================================================
export function generateInsights(entries, habitsConfig, opts = {}) {
  const { sleepTarget = 7.5 } = opts;
  // entries should be ascending by date; sort defensively.
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out = [
    sleepCorrelation(sorted, habitsConfig),
    moodPattern(sorted, habitsConfig),
    sleepStreak(sorted, sleepTarget),
    habitSlip(sorted, habitsConfig),
    weightTrend(sorted),
    bestDayOfWeek(sorted)
  ];
  return out.filter(Boolean);
}
