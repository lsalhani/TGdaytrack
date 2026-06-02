import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import EntryPreview from '../components/EntryPreview';

// HistoryScreen — reverse-chronological list grouped by month, with a search
// box matching note text and #tags. Tapping an entry opens a read-mode detail;
// the Edit button jumps the Log screen to that day via router state.

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const monthHeading = (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

export default function HistoryScreen() {
  const navigate = useNavigate();
  const entries = useLiveQuery(() => db.entries.orderBy('date').toArray(), [], undefined);
  const habits = useLiveQuery(() => db.habits_config.orderBy('sort_order').toArray(), [], undefined);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const loading = entries === undefined || habits === undefined;

  const filtered = useMemo(() => {
    if (loading) return [];
    const q = query.trim().toLowerCase();
    const desc = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    return q ? desc.filter(e => (e.note || '').toLowerCase().includes(q)) : desc;
  }, [entries, query, loading]);

  const groups = useMemo(() => {
    const out = []; let cur = null;
    for (const e of filtered) {
      const m = monthHeading(e.date);
      if (!cur || cur.month !== m) { cur = { month: m, items: [] }; out.push(cur); }
      cur.items.push(e);
    }
    return out;
  }, [filtered]);

  // ---- Detail (read mode) ----
  if (selected) {
    return (
      <DayDetail
        entry={selected}
        habits={habits || []}
        onBack={() => setSelected(null)}
        onEdit={() => navigate('/log', { state: { editDate: selected.date } })}
      />
    );
  }

  // ---- List ----
  return (
    <>
      <header>
        <Link to="/log" className="gear" aria-label="Back">‹</Link>
        <span className="brand">History</span>
        <div style={{ width: 38 }} />
      </header>
      <main>
        <input
          className="search"
          type="search"
          placeholder="Search notes and #tags…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {loading && <div className="placeholder"><p>Loading…</p></div>}

        {!loading && entries.length === 0 && (
          <div className="placeholder">
            <div className="big">📅</div>
            <p>No entries yet — log your first day on the Log tab.</p>
          </div>
        )}
        {!loading && entries.length > 0 && filtered.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>
            No entries match “{query}”.
          </p>
        )}

        {groups.map(g => (
          <div key={g.month} className="history-month">
            <h3 className="month-heading">{g.month}</h3>
            <div className="entry-list">
              {g.items.map(e => (
                <EntryPreview key={e.date} entry={e} habitsConfig={habits} onOpen={setSelected} />
              ))}
            </div>
          </div>
        ))}
      </main>
    </>
  );
}

// ---- Day detail (read-only view of one entry) ----
function DayDetail({ entry, habits, onBack, onEdit }) {
  const longDate = new Date(entry.date + 'T00:00:00')
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const done = habits.filter(h => {
    const v = entry.habits?.[h.key];
    return h.type === 'count' ? v > 0 : v === true;
  });

  const Field = ({ label, value }) =>
    value == null || value === '' ? null : (
      <div className="detail-field">
        <span className="detail-label">{label}</span>
        <span className="detail-value">{value}</span>
      </div>
    );

  return (
    <>
      <header>
        <button className="gear" onClick={onBack} aria-label="Back">‹</button>
        <span className="brand">{longDate}</span>
        <button className="gear" onClick={onEdit} aria-label="Edit">✎</button>
      </header>
      <main>
        <section className="card">
          <h2>The day</h2>
          <Field label="Mood" value={entry.mood != null ? `${entry.mood} / 5` : null} />
          <Field label="Time asleep" value={entry.sleep_hours != null ? `${entry.sleep_hours} h` : null} />
          <Field label="Sleep score" value={entry.sleep_score != null ? `${entry.sleep_score} / 100` : null} />
          <Field label="Weight" value={entry.weight_kg != null ? `${entry.weight_kg} kg` : null} />
          <Field label="Focused" value={entry.focused_hours != null ? `${entry.focused_hours} h` : null} />
        </section>

        {done.length > 0 && (
          <section className="card">
            <h2>Habits</h2>
            <div className="detail-habits">
              {done.map(h => (
                <span key={h.key} className="detail-chip">
                  {h.icon} {h.name}{h.type === 'count' ? ` ×${entry.habits[h.key]}` : ''}
                </span>
              ))}
            </div>
          </section>
        )}

        {entry.note && (
          <section className="card">
            <h2>Note</h2>
            <p className="detail-note">{entry.note}</p>
          </section>
        )}
      </main>
    </>
  );
}
