// Pure helpers for the Stats screen. No React, no DB — just math on arrays.

export const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

// Average of a numeric field, ignoring null/undefined.
export function avgField(entries, field) {
  const vals = entries.map(e => e[field]).filter(v => v != null);
  return avg(vals);
}

// Trend arrow vs previous period: compares this period's average to the
// previous same-length window. Returns 'up' | 'down' | 'flat' | null.
export function trend(curr, prev) {
  if (curr == null || prev == null) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.05) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

// Format hours (e.g. 7.5) as "7h 30m".
export function fmtHours(h) {
  if (h == null) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

// Weight change across the period: last logged minus first logged.
export function weightChange(entries) {
  const weights = entries.filter(e => e.weight_kg != null);
  if (weights.length < 2) return { current: weights[0]?.weight_kg ?? null, delta: null };
  const first = weights[0].weight_kg;
  const last = weights[weights.length - 1].weight_kg;
  return { current: last, delta: Math.round((last - first) * 10) / 10 };
}

// Longest run of consecutive days completing the user's most-done habit.
export function bestStreak(entries) {
  // tally completions per boolean habit
  const tally = {};
  entries.forEach(e => {
    Object.entries(e.habits || {}).forEach(([k, v]) => {
      if (v === true) tally[k] = (tally[k] || 0) + 1;
    });
  });
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  if (!top) return { habit: null, streak: 0 };
  const habitKey = top[0];

  // walk entries in date order, counting consecutive calendar days
  let best = 0, run = 0, prevDate = null;
  entries.forEach(e => {
    const done = e.habits?.[habitKey] === true;
    if (done) {
      if (prevDate) {
        const gap = (new Date(e.date) - new Date(prevDate)) / 86400000;
        run = gap === 1 ? run + 1 : 1;
      } else run = 1;
      best = Math.max(best, run);
      prevDate = e.date;
    } else {
      run = 0; prevDate = null;
    }
  });
  return { habit: habitKey, streak: best };
}
