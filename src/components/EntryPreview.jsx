// EntryPreview — one tappable row in the History list. Mood badge, date +
// day name, completed-habit icons, and a 60-char note preview.
//
// Props: entry, habitsConfig (for resolving completed habits), onOpen(entry).
const MOOD_BG = { 1: '#ede9fe', 2: '#cdbdf6', 3: '#a78bfa', 4: '#854dde', 5: '#6d28d9' };
const MOOD_FG = { 1: '#6d28d9', 2: '#6d28d9', 3: '#fff', 4: '#fff', 5: '#fff' };

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function EntryPreview({ entry, habitsConfig = [], onOpen }) {
  const done = habitsConfig.filter(h => {
    const v = entry.habits?.[h.key];
    return h.type === 'count' ? v > 0 : v === true;
  });
  const full = entry.note || '';
  const note = full.slice(0, 60);

  return (
    <button className="entry-preview" onClick={() => onOpen?.(entry)}>
      <span
        className="entry-badge"
        style={{ background: MOOD_BG[entry.mood] || 'var(--line)', color: MOOD_FG[entry.mood] || 'var(--muted)' }}
      >
        {entry.mood ?? '–'}
      </span>
      <span className="entry-main">
        <span className="entry-date">{dayLabel(entry.date)}</span>
        {note && <span className="entry-note">{note}{full.length > 60 ? '…' : ''}</span>}
      </span>
      <span className="entry-icons">
        {done.slice(0, 6).map(h => <span key={h.key} title={h.name}>{h.icon}</span>)}
      </span>
    </button>
  );
}
