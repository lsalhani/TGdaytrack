import { useLiveQuery } from 'dexie-react-hooks';
import { db, isoKey } from '../db';

// Returns the inclusive [start, end] ISO date strings for a named period,
// counting back from today. 'all' returns a null start (no lower bound).
export function periodBounds(period) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = isoKey(today);
  const start = new Date(today);

  switch (period) {
    case 'week':    start.setDate(start.getDate() - 6);  break;  // last 7 days incl today
    case 'month':   start.setDate(start.getDate() - 29); break;  // last 30 days
    case 'quarter': start.setDate(start.getDate() - 89); break;  // last 90 days
    case 'all':     return { start: null, end, days: null };
    default:        start.setDate(start.getDate() - 6);
  }
  const days = Math.round((today - start) / 86400000) + 1;
  return { start: isoKey(start), end, days };
}

// Live-reads all entries in the period, sorted by date ascending.
// Re-runs automatically whenever the DB changes or the period changes.
export function useDateRange(period) {
  return useLiveQuery(async () => {
    const { start, end } = periodBounds(period);
    const coll = start == null
      ? db.entries.where('date').belowOrEqual(end)
      : db.entries.where('date').between(start, end, true, true);
    const rows = await coll.toArray();
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }, [period], undefined);   // undefined = "still loading" sentinel
}
