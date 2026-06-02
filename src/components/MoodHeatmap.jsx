// MoodHeatmap — spec component 4.5. GitHub-style grid: columns are weeks,
// rows are weekdays (Mon..Sun). Each square is shaded by that day's mood
// (1 = light lavender ... 5 = deep purple). No entry = neutral line colour.
//
// Props: entries (array of { date:'YYYY-MM-DD', mood:1..5 }), months (default 3).

// Mood → shade. Built on the app's purple so it sits in the palette.
const MOOD_BG = {
  1: '#ede9fe', // --purple-soft
  2: '#cdbdf6',
  3: '#a78bfa', // --purple-mid
  4: '#854dde',
  5: '#6d28d9'  // --purple
};
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const dowMon = (d) => (d.getDay() + 6) % 7; // 0 = Mon

export default function MoodHeatmap({ entries = [], months = 3 }) {
  const moodByDate = {};
  for (const e of entries) if (e.mood != null) moodByDate[e.date] = e.mood;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
  start.setDate(start.getDate() - dowMon(start)); // back up to a Monday

  const weeks = [];
  const cur = new Date(start);
  while (cur <= today) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      col.push(cur <= today ? iso(cur) : null);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(col);
  }

  return (
    <div className="heatmap">
      <div className="heatmap-grid">
        <div className="heatmap-dow">
          {DOW.map((l, i) => (
            <span key={l} className="hm-dow-label">{i % 2 === 0 ? l : ''}</span>
          ))}
        </div>
        {weeks.map((col, wi) => (
          <div key={wi} className="heatmap-col">
            {col.map((date, di) => {
              const mood = date ? moodByDate[date] : undefined;
              return (
                <div
                  key={di}
                  className={'hm-cell' + (date ? '' : ' empty')}
                  style={date ? { background: mood ? MOOD_BG[mood] : 'var(--line)' } : undefined}
                  title={date ? `${date}${mood ? ` · mood ${mood}` : ' · no entry'}` : ''}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>low</span>
        {[1, 2, 3, 4, 5].map(m => (
          <span key={m} className="hm-cell" style={{ background: MOOD_BG[m] }} />
        ))}
        <span>high</span>
      </div>
    </div>
  );
}
