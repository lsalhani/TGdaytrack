import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db, isoKey, seedHabits,
  addHabit, updateHabit, deactivateHabit, reorderHabits, allEntries, importEntries
} from '../db';
import { useAuth } from '../hooks/useAuth';

// SettingsScreen (Week 5 — the real one).
// Sections: Account · Habits · Units · Sleep target · Export/Import CSV.
// The developer tools (sample data + reset) are kept at the bottom, clearly
// marked, to be removed around Week 6 before the app is shared.

export default function SettingsScreen() {
  const habits = useLiveQuery(() => db.habits_config.orderBy('sort_order').toArray(), [], undefined);
  const [newHabit, setNewHabit] = useState('');
  const [weightUnit, setWeightUnit] = useState(() => localStorage.getItem('daytrack.weightUnit') || 'kg');
  const [sleepUnit, setSleepUnit] = useState(() => localStorage.getItem('daytrack.sleepUnit') || 'decimal');
  const [sleepTarget, setSleepTarget] = useState(() => Number(localStorage.getItem('daytrack.sleepTarget')) || 7.5);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const { user, signOut } = useAuth();

  const flash = t => { setMsg(t); setTimeout(() => setMsg(''), 2500); };
  const active = (habits || []).filter(h => h.active);

  // ---- Habit manager ----
  const onAdd = async () => {
    const name = newHabit.trim();
    if (!name) return;
    await addHabit({ name });
    setNewHabit('');
  };
  const onRename = async h => {
    const name = prompt('Rename habit', h.name);
    if (name && name.trim()) await updateHabit(h.id, { name: name.trim() });
  };
  const onToggleType = h => updateHabit(h.id, { type: h.type === 'boolean' ? 'count' : 'boolean' });
  const onDelete = h => { if (confirm(`Hide “${h.name}”? Past data is kept.`)) deactivateHabit(h.id); };
  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= active.length) return;
    const ids = active.map(h => h.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderHabits(ids);
  };

  // ---- Units & target ----
  const pickWeight = u => { localStorage.setItem('daytrack.weightUnit', u); setWeightUnit(u); };
  const pickSleep = u => { localStorage.setItem('daytrack.sleepUnit', u); setSleepUnit(u); };
  const saveTarget = v => { const n = Number(v) || 7.5; setSleepTarget(n); localStorage.setItem('daytrack.sleepTarget', String(n)); };

  // ---- CSV export / import ----
  const onExport = async () => {
    const entries = await allEntries();
    downloadCsv(entriesToCsv(entries), `daytrack-${isoKey()}.csv`);
    flash(`Exported ${entries.length} entries.`);
  };
  const onImportFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rows = csvToEntries(await file.text());
    const { added, skipped } = await importEntries(rows);
    flash(`Imported ${added}, skipped ${skipped} existing.`);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <header>
        <Link to="/log" className="gear" aria-label="Back">‹</Link>
        <span className="brand">Settings</span>
        <div style={{ width: 38 }} />
      </header>
      <main>
        {msg && <div className="settings-msg">{msg}</div>}

        {/* Habits */}
        <section className="card">
          <h2>Habits</h2>
          {active.map((h, i) => (
            <div key={h.id} className="manage-row">
              <span className="icon">{h.icon}</span>
              <span className="name">{h.name}</span>
              <span className="type-tag">{h.type}</span>
              <span className="row-actions">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Up">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === active.length - 1} aria-label="Down">↓</button>
                <button onClick={() => onToggleType(h)} title="boolean / count">⇄</button>
                <button onClick={() => onRename(h)} aria-label="Rename">✎</button>
                <button onClick={() => onDelete(h)} aria-label="Hide">🗑</button>
              </span>
            </div>
          ))}
          <div className="add-row">
            <input
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdd()}
              placeholder="New habit name"
            />
            <button onClick={onAdd}>Add</button>
          </div>
        </section>

        {/* Units */}
        <section className="card">
          <h2>Units</h2>
          <div className="set-row">
            <span>Weight</span>
            <div className="seg">
              <button className={weightUnit === 'kg' ? 'on' : ''} onClick={() => pickWeight('kg')}>kg</button>
              <button className={weightUnit === 'lbs' ? 'on' : ''} onClick={() => pickWeight('lbs')}>lbs</button>
            </div>
          </div>
          <div className="set-row">
            <span>Sleep</span>
            <div className="seg">
              <button className={sleepUnit === 'decimal' ? 'on' : ''} onClick={() => pickSleep('decimal')}>7.5h</button>
              <button className={sleepUnit === 'hm' ? 'on' : ''} onClick={() => pickSleep('hm')}>7h 30m</button>
            </div>
          </div>
        </section>

        {/* Sleep target */}
        <section className="card">
          <h2>Sleep target</h2>
          <div className="set-row">
            <span>Target hours (shown on the sleep chart)</span>
            <input className="num-input" type="number" step="0.5" min="0" max="14"
              value={sleepTarget} onChange={e => saveTarget(e.target.value)} />
          </div>
        </section>

        {/* Data */}
        <section className="card">
          <h2>Your data</h2>
          <div className="set-row">
            <span>Export everything as CSV</span>
            <button className="ghost-btn" onClick={onExport}>Export</button>
          </div>
          <div className="set-row">
            <span>Import from CSV / spreadsheet</span>
            <button className="ghost-btn" onClick={() => fileRef.current?.click()}>Import</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onImportFile} />
          </div>
        </section>

        {/* Account */}
        <section className="card">
          <h2>Account</h2>
          <div className="set-row">
            <span>Signed in as<br /><strong style={{ fontWeight: 600 }}>{user?.email}</strong></span>
            <button className="ghost-btn" onClick={signOut}>Log out</button>
          </div>
        </section>

        {/* ===================================================== */}
        {/* DEVELOPER TOOLS — remove before launch (~Week 6).     */}
        {/* ===================================================== */}
        <section className="card">
          <h2>Developer tools</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Temporary helpers for building &amp; testing. Remove before launch.
          </p>
          <button className="save" style={{ marginBottom: 10 }} onClick={generateSampleData}>
            Add 30 days of sample data
          </button>
          <button className="save" style={{ background: '#dc2626', boxShadow: 'none' }} onClick={resetDatabase}>
            Reset database
          </button>
        </section>
      </main>
    </>
  );
}

// ===========================================================================
// DEV ONLY — sample data + reset (carried over from Week 4; delete with the
// developer-tools card before Week 6). Never clobbers a real entry.
// ===========================================================================
async function generateSampleData() {
  const habitKeys = ['study', 'gym', 'cardio', 'markets', 'news', 'read', 'journal', 'supplements', 'stretching'];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let weight = 70.5;

  for (let i = 30; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = isoKey(d);

    const existing = await db.entries.where('date').equals(key).first();
    if (existing) continue;  // never clobber real entries

    const habits = {};
    habitKeys.forEach(k => { if (Math.random() < 0.45) habits[k] = true; });
    if (Math.random() < 0.3) habits.drinks = Math.ceil(Math.random() * 3);

    weight += (Math.random() - 0.55) * 0.3;  // gentle downward drift

    await db.entries.add({
      date: key,
      mood: Math.ceil(Math.random() * 5),
      sleep_hours: Math.round((6 + Math.random() * 2.5) * 10) / 10,
      sleep_score: Math.round(60 + Math.random() * 35),
      weight_kg: Math.round(weight * 10) / 10,
      focused_hours: Math.round(Math.random() * 6 * 2) / 2,
      note: ['good day', 'busy #productive', 'tired', 'saw friends #social', ''][Math.floor(Math.random() * 5)],
      habits,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  alert('Sample data added! Check the Stats screen.');
}

async function resetDatabase() {
  if (!confirm('Delete ALL local data? This cannot be undone.')) return;
  await db.entries.clear();
  await db.habits_config.clear();
  await seedHabits();
  alert('Database reset. Habits re-seeded.');
}

// ===========================================================================
// CSV helpers (Settings-specific). Columns match the entries schema; habits is
// serialised as JSON in a single column. Parser handles quotes/commas/newlines.
// ===========================================================================
const CSV_FIELDS = [
  'date', 'mood', 'sleep_hours', 'sleep_score', 'weight_kg', 'calories',
  'focused_hours', 'pushups', 'screen_time_hours', 'drink_score', 'note', 'habits'
];

function entriesToCsv(entries) {
  const esc = v => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = CSV_FIELDS.join(',');
  const body = entries.map(e => CSV_FIELDS.map(f => esc(e[f])).join(',')).join('\n');
  return `${head}\n${body}`;
}

function csvToEntries(text) {
  const rows = parseCsv(text.trim());
  if (!rows.length) return [];
  const header = rows[0];
  const numeric = new Set(['mood','sleep_hours','sleep_score','weight_kg','calories','focused_hours','pushups','screen_time_hours','drink_score']);
  return rows.slice(1).map(cols => {
    const obj = {};
    header.forEach((key, i) => {
      const v = cols[i] ?? '';
      if (v === '') return;
      if (key === 'habits') { try { obj.habits = JSON.parse(v); } catch { /* skip */ } return; }
      obj[key] = numeric.has(key) ? Number(v) : v;
    });
    return obj;
  }).filter(o => o.date);
}

function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}