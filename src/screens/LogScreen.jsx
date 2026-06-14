import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isoKey, getEntry, saveEntry } from '../db';
import MoodSelector from '../components/MoodSelector';
import HabitRow from '../components/HabitRow';

const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const fmt = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const EMPTY = {
  mood: null, sleep_hours: '', sleep_score: '', weight_kg: '',
  focused_hours: '', note: '', habits: {}
};

const TAGS = ['social', 'travel', 'event', 'productive', 'rough day'];

// --- Unit helpers -----------------------------------------------------------
// Weight is ALWAYS stored in kg. lbs is a display/entry convenience only.
const KG_PER_LB = 0.45359237;
const kgToLb = kg => kg == null || kg === '' ? '' : Math.round((kg / KG_PER_LB) * 10) / 10;
const lbToKg = lb => lb === '' || lb == null ? null : Math.round((Number(lb) * KG_PER_LB) * 10) / 10;

// Sleep is ALWAYS stored as decimal hours. h:m is an entry/display convenience.
const decToHM = dec => {
  if (dec === '' || dec == null) return { h: '', m: '' };
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return { h, m };
};
const hmToDec = (h, m) => {
  const hh = h === '' || h == null ? 0 : Number(h);
  const mm = m === '' || m == null ? 0 : Number(m);
  if (hh === 0 && mm === 0 && h === '' && m === '') return null;
  return Math.round((hh + mm / 60) * 100) / 100;
};

export default function LogScreen() {
  const location = useLocation();
  const [viewedDate, setViewedDate] = useState(new Date(TODAY));
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Unit preferences (set in Settings, stored in localStorage). Read on mount.
  const weightUnit = localStorage.getItem('daytrack.weightUnit') || 'kg';
  const sleepUnit = localStorage.getItem('daytrack.sleepUnit') || 'decimal';

  // If we arrived from History's "Edit" button, jump to that day.
  // History navigates with: navigate('/log', { state: { editDate: 'YYYY-MM-DD' } })
  useEffect(() => {
    const ed = location.state?.editDate;
    if (!ed) return;
    const [y, m, d] = ed.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    target.setHours(0, 0, 0, 0);
    if (!isNaN(target) && target.getTime() <= TODAY.getTime()) {
      setViewedDate(target);
    }
  }, [location.state]);

  const dateKey = isoKey(viewedDate);
  const isToday = viewedDate.getTime() === TODAY.getTime();

  // Live list of active habits from the config table.
  const habits = useLiveQuery(
    () => db.habits_config.orderBy('sort_order').filter(h => h.active).toArray(),
    [], []
  );

  // Does an entry already exist for the viewed day? (drives the checkmark)
  const savedEntry = useLiveQuery(() => getEntry(dateKey), [dateKey]);

  // Load the viewed day's entry into the form whenever the date changes.
  useEffect(() => {
    let cancelled = false;
    getEntry(dateKey).then(entry => {
      if (cancelled) return;
      if (entry) {
        setForm({
          mood: entry.mood ?? null,
          sleep_hours: entry.sleep_hours ?? '',
          sleep_score: entry.sleep_score ?? '',
          weight_kg: entry.weight_kg ?? '',
          focused_hours: entry.focused_hours ?? '',
          note: entry.note ?? '',
          habits: entry.habits ?? {}
        });
      } else {
        setForm(EMPTY);
      }
      setError(false);
      setJustSaved(false);
    });
    return () => { cancelled = true; };
  }, [dateKey]);

  // ---- field helpers ----
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setHabit = (key, val) =>
    setForm(f => {
      const habits = { ...f.habits };
      const isEmptyArray = Array.isArray(val) && val.length === 0;
      if (val === false || val === 0 || val == null || isEmptyArray) delete habits[key];
      else habits[key] = val;
      return { ...f, habits };
    });

  const addTag = useCallback(tag => {
    const hash = '#' + tag.replace(/\s+/g, '');
    setForm(f => f.note.includes(hash) ? f : { ...f, note: (f.note.trim() + ' ' + hash).trim() });
  }, []);

  // ---- last weight (most recent prior day) ----
  const lastWeight = useLiveQuery(async () => {
    const prior = await db.entries
      .where('date').below(dateKey)
      .reverse().toArray();
    const found = prior.find(e => e.weight_kg != null);
    return found ? found.weight_kg : null;
  }, [dateKey]);

  // ---- weekly focus total (Mon–Sun of viewed week) ----
  const weekTotal = useLiveQuery(async () => {
    const ref = new Date(viewedDate);
    const dow = (ref.getDay() + 6) % 7;
    const monday = new Date(ref); monday.setDate(ref.getDate() - dow);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const rows = await db.entries
      .where('date').between(isoKey(monday), isoKey(sunday), true, true).toArray();
    return rows.reduce((sum, e) => sum + (e.focused_hours || 0), 0);
  }, [dateKey]) || 0;

  // ---- save ----
  async function handleSave() {
    if (!form.mood) { setError(true); return; }
    setError(false);

    const num = v => (v === '' || v == null ? null : parseFloat(v));
    await saveEntry({
      date: dateKey,
      mood: form.mood,
      sleep_hours: num(form.sleep_hours),
      sleep_score: num(form.sleep_score),
      weight_kg: num(form.weight_kg),
      focused_hours: num(form.focused_hours),
      note: form.note.trim(),
      habits: form.habits
    });

    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1400);
  }

  const shiftDay = delta => {
    const d = new Date(viewedDate);
    d.setDate(d.getDate() + delta);
    if (d.getTime() > TODAY.getTime()) return;
    setViewedDate(d);
  };

  return (
    <>
      <header>
        <span className="brand">DayTrack</span>
        <div className="date-wrap">
          <button className="day-arrow" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
          <span className="date">{isToday ? 'Today' : fmt(viewedDate)}</span>
          <button className="day-arrow" onClick={() => shiftDay(1)} disabled={isToday} aria-label="Next day">›</button>
          {savedEntry && <span className="check">✓</span>}
        </div>
        <Link to="/settings" className="gear" aria-label="Settings">⚙</Link>
      </header>

      <main>
        <MoodSelector value={form.mood} onChange={m => { set('mood', m); setError(false); }} />

        {/* Metrics */}
        <section className="card">
          <h2>Metrics</h2>
          <div className="metric-row">
            <div className="metric">
              <label>Time asleep</label>
              {sleepUnit === 'hm' ? (
                <div className="field hm-field">
                  <input type="number" step="1" min="0" max="24" inputMode="numeric" placeholder="7"
                    value={decToHM(form.sleep_hours).h}
                    onChange={e => {
                      const { m } = decToHM(form.sleep_hours);
                      set('sleep_hours', hmToDec(e.target.value, m) ?? '');
                    }} />
                  <span className="unit">h</span>
                  <input type="number" step="5" min="0" max="59" inputMode="numeric" placeholder="30"
                    value={decToHM(form.sleep_hours).m}
                    onChange={e => {
                      const { h } = decToHM(form.sleep_hours);
                      set('sleep_hours', hmToDec(h, e.target.value) ?? '');
                    }} />
                  <span className="unit">m</span>
                </div>
              ) : (
                <div className="field">
                  <input type="number" step="0.1" inputMode="decimal" placeholder="7.5"
                    value={form.sleep_hours} onChange={e => set('sleep_hours', e.target.value)} />
                  <span className="unit">h</span>
                </div>
              )}
            </div>
            <div className="metric">
              <label>Sleep score</label>
              <div className="field">
                <input type="number" step="1" min="0" max="100" inputMode="numeric" placeholder="—"
                  value={form.sleep_score} onChange={e => set('sleep_score', e.target.value)} />
                <span className="unit">/100</span>
              </div>
            </div>
            <div className="metric">
              <label>Weight</label>
              <div className="field">
                <input type="number" step="0.1" inputMode="decimal"
                  placeholder={lastWeight != null
                    ? String(weightUnit === 'lbs' ? kgToLb(lastWeight) : lastWeight)
                    : (weightUnit === 'lbs' ? '152.6' : '69.2')}
                  value={weightUnit === 'lbs'
                    ? (form.weight_kg === '' ? '' : kgToLb(form.weight_kg))
                    : form.weight_kg}
                  onChange={e => {
                    const v = e.target.value;
                    set('weight_kg', weightUnit === 'lbs'
                      ? (v === '' ? '' : lbToKg(v))
                      : v);
                  }} />
                <span className="unit">{weightUnit}</span>
              </div>
              <div className="sub">
                last: {lastWeight != null
                  ? `${weightUnit === 'lbs' ? kgToLb(lastWeight) : lastWeight} ${weightUnit}`
                  : `— ${weightUnit}`}
              </div>
            </div>
          </div>
        </section>

        {/* Habits */}
        <section className="card">
          <h2>Habits</h2>
          {(habits || []).map(h => (
            <HabitRow
              key={h.id}
              habit={h}
              value={form.habits[h.key]}
              onChange={val => setHabit(h.key, val)}
            />
          ))}
        </section>

        {/* Focused hours */}
        <section className="card">
          <h2>Focused hours</h2>
          <div className="focus-field">
            <span className="clock">🕑</span>
            <input type="number" step="0.5" inputMode="decimal" placeholder="0"
              value={form.focused_hours} onChange={e => set('focused_hours', e.target.value)} />
            <span className="unit">h today</span>
          </div>
          <div className="week-total">Week total: {Math.round(weekTotal * 10) / 10}h</div>
        </section>

        {/* Note */}
        <section className="card">
          <h2>Note</h2>
          <textarea className="note-area" maxLength={500} placeholder="How did it go..."
            value={form.note} onChange={e => set('note', e.target.value)} />
          <div className="note-count">{form.note.length} / 500</div>
          <div className="chips">
            {TAGS.map(t => (
              <button key={t} className="chip" onClick={() => addTag(t)}>{t}</button>
            ))}
          </div>
        </section>

        <button className={'save' + (justSaved ? ' saved' : '')} onClick={handleSave}>
          {justSaved ? '✓ Saved' : (savedEntry ? 'Update day' : 'Save day')}
        </button>
        {error && <p className="error">Pick a day rating before saving.</p>}
      </main>
    </>
  );
}
