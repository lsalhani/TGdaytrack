import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, Line } from 'react-chartjs-2';
import '../chartSetup';                 // registers chart.js pieces (side-effect import)
import { db, isoKey } from '../db';
import { useDateRange, periodBounds } from '../hooks/useDateRange';
import { avgField, trend, fmtHours, weightChange, bestStreak } from '../stats';
import ChartCard from '../components/ChartCard';

const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'all', label: 'All time' }
];

const PURPLE = '#6d28d9';
const TEAL = '#0d9488';

function Arrow({ dir }) {
  if (!dir || dir === 'flat') return <span className="trend flat">→</span>;
  return <span className={'trend ' + dir}>{dir === 'up' ? '↑' : '↓'}</span>;
}

export default function StatsScreen() {
  const [period, setPeriod] = useState('week');
  const entries = useDateRange(period);

  // previous same-length window, for trend arrows
  const prevEntries = useLiveQuery(async () => {
    const { start, days } = periodBounds(period);
    if (start == null || days == null) return [];
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1));
    return db.entries.where('date').between(isoKey(prevStart), isoKey(prevEnd), true, true).toArray();
  }, [period], []);

  // active boolean habits for the matrix
  const habits = useLiveQuery(
    () => db.habits_config.orderBy('sort_order').filter(h => h.active && h.type === 'boolean').toArray(),
    [], []
  );

  if (entries === undefined) {
    return (
      <>
        <StatsHeader />
        <main><div className="placeholder"><div className="big">⏳</div><p>Loading…</p></div></main>
      </>
    );
  }

  const hasData = entries.length > 0;

  const moodAvg = avgField(entries, 'mood');
  const moodPrev = avgField(prevEntries, 'mood');
  const sleepAvg = avgField(entries, 'sleep_hours');
  const sleepPrev = avgField(prevEntries, 'sleep_hours');
  const { current: weightNow, delta: weightDelta } = weightChange(entries);
  const { habit: streakHabit, streak } = bestStreak(entries);

  const moodData = {
    labels: entries.map(e => e.date.slice(5)),
    datasets: [{
      label: 'Mood',
      data: entries.map(e => e.mood),
      backgroundColor: entries.map(e => `rgba(109,40,217,${0.35 + 0.13 * (e.mood || 0)})`),
      borderRadius: 6
    }]
  };
  const moodOpts = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: ctx => {
            const note = entries[ctx.dataIndex]?.note;
            return note ? note.slice(0, 60) : '';
          }
        }
      }
    },
    scales: { y: { min: 0, max: 5, ticks: { stepSize: 1 } } },
    maintainAspectRatio: false
  };

  const sleepData = {
    labels: entries.map(e => e.date.slice(5)),
    datasets: [
      {
        label: 'Sleep (h)',
        data: entries.map(e => e.sleep_hours ?? null),
        borderColor: PURPLE, backgroundColor: 'rgba(109,40,217,.12)',
        tension: .3, spanGaps: true, fill: true, pointRadius: 3
      },
      {
        label: 'Score /100',
        data: entries.map(e => (e.sleep_score != null ? e.sleep_score / 10 : null)),
        borderColor: TEAL, borderDash: [4, 4], tension: .3, spanGaps: true,
        pointRadius: 0, fill: false, hidden: !entries.some(e => e.sleep_score != null)
      }
    ]
  };
  const sleepOpts = {
    plugins: { legend: { display: true, labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: { y: { suggestedMin: 4, suggestedMax: 10 } },
    maintainAspectRatio: false
  };

  return (
    <>
      <StatsHeader />
      <main>
        <div className="period-tabs">
          {PERIODS.map(p => (
            <button key={p.key}
              className={'period-tab' + (period === p.key ? ' active' : '')}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="placeholder">
            <div className="big">📊</div>
            <p>No entries in this period yet. Log a few days and they'll show up here.</p>
          </div>
        ) : (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <div className="s-label">Avg mood</div>
                <div className="s-value">{moodAvg ? moodAvg.toFixed(1) : '—'}<span className="s-unit">/5</span> <Arrow dir={trend(moodAvg, moodPrev)} /></div>
              </div>
              <div className="summary-card">
                <div className="s-label">Avg sleep</div>
                <div className="s-value">{fmtHours(sleepAvg)} <Arrow dir={trend(sleepAvg, sleepPrev)} /></div>
              </div>
              <div className="summary-card">
                <div className="s-label">Weight</div>
                <div className="s-value">
                  {weightNow != null ? `${weightNow} kg` : '—'}
                  {weightDelta != null && <span className={'s-delta ' + (weightDelta <= 0 ? 'good' : 'bad')}> {weightDelta > 0 ? '+' : ''}{weightDelta} kg</span>}
                </div>
              </div>
              <div className="summary-card">
                <div className="s-label">Top streak</div>
                <div className="s-value">{streak} day{streak === 1 ? '' : 's'}{streakHabit && <span className="s-unit"> · {streakHabit}</span>}</div>
              </div>
            </div>

            <ChartCard title="Mood">
              <div style={{ height: 200 }}><Bar data={moodData} options={moodOpts} /></div>
            </ChartCard>

            <ChartCard title="Sleep">
              <div style={{ height: 200 }}><Line data={sleepData} options={sleepOpts} /></div>
            </ChartCard>

            <section className="card">
              <h2>Habit completion</h2>
              <div className="matrix">
                {(habits || []).map(h => {
                  const done = entries.filter(e => e.habits?.[h.key] === true).length;
                  const pct = Math.round((done / entries.length) * 100);
                  return (
                    <div className="matrix-row" key={h.id}>
                      <span className="m-name">{h.icon} {h.name}</span>
                      <span className="m-dots">
                        {entries.map(e => (
                          <span key={e.date}
                            className={'dot' + (e.habits?.[h.key] === true ? ' on' : '')}
                            title={e.date} />
                        ))}
                      </span>
                      <span className="m-pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function StatsHeader() {
  return (
    <header>
      <span className="brand">Stats</span>
      <div className="date-wrap" />
      <Link to="/settings" className="gear" aria-label="Settings">⚙</Link>
    </header>
  );
}
