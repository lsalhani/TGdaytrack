import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateInsights } from '../insights';
import InsightCard from '../components/InsightCard';
import MoodHeatmap from '../components/MoodHeatmap';

// InsightsScreen — no user input. Reads all entries + active habits live,
// runs the insights engine, and shows the resulting cards plus a 3-month mood
// heatmap. Lenient mode: each insight sets its own small minimum, so we show
// whatever is computable and only nudge when nothing at all is.
export default function InsightsScreen() {
  const entries = useLiveQuery(() => db.entries.orderBy('date').toArray(), [], undefined);
  const habits = useLiveQuery(
    () => db.habits_config.orderBy('sort_order').filter(h => h.active).toArray(),
    [], undefined
  );

  const loading = entries === undefined || habits === undefined;

  const target = Number(localStorage.getItem('daytrack.sleepTarget')) || 7.5;
  const insights = loading ? [] : generateInsights(entries, habits, { sleepTarget: target });
  const heatmap = loading ? [] : entries.map(e => ({ date: e.date, mood: e.mood }));

  return (
    <>
      <header>
        <Link to="/log" className="gear" aria-label="Back">‹</Link>
        <span className="brand">Insights</span>
        <div style={{ width: 38 }} />
      </header>
      <main>
        {loading ? (
          <div className="placeholder"><p>Crunching your data…</p></div>
        ) : (
          <>
            {insights.length === 0 ? (
              <section className="card">
                <h2>Insights</h2>
                <p style={{ fontSize: 14 }}>Keep logging — patterns show up as the data grows.</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
                  Observations appear automatically once there's enough to compare.
                </p>
              </section>
            ) : (
              <div className="insight-list">
                {insights.map((ins, i) => (
                  <InsightCard key={`${ins.type}-${i}`} {...ins} />
                ))}
              </div>
            )}

            <section className="card">
              <h2>Mood — last 3 months</h2>
              {entries.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>No entries yet.</p>
                : <MoodHeatmap entries={heatmap} months={3} />}
            </section>
          </>
        )}
      </main>
    </>
  );
}
