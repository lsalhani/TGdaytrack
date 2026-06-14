// HabitRow — one row in the habits card.
// Habit types:
//   boolean — on/off toggle
//   count   — small stepper, 0..count_max (default 5)
//   number  — free numeric entry with an optional unit label
//   options — a toggle that, when ON, reveals selectable chips (e.g. Exercise
//             -> run / swim / gym / push / pull / legs). Value is an ARRAY of
//             chosen option keys. Multiple can be picked; tapping toggles each.
export default function HabitRow({ habit, value, onChange }) {
  const { name, icon, type, unit, count_max, options } = habit;
  const max = Number(count_max) || 5;

  // ---- options type ----
  if (type === 'options') {
    const chosen = Array.isArray(value) ? value : [];
    const isOn = chosen.length > 0;
    const opts = Array.isArray(options) ? options : [];

    const toggleOption = optKey => {
      const next = chosen.includes(optKey)
        ? chosen.filter(k => k !== optKey)
        : [...chosen, optKey];
      onChange(next);            // [] when none left -> treated as "not done"
    };
    // Tapping the master toggle: off -> clears all; on -> no-op (user then
    // picks chips). We only clear on turning off, so an accidental tap that's
    // already on doesn't wipe selections.
    const toggleMaster = () => { if (isOn) onChange([]); else onChange(chosen); };

    return (
      <div className="habit habit-options">
        <div className="habit-options-head">
          <span className="icon">{icon}</span>
          <span className="name">{name}</span>
          <button
            className={'toggle' + (isOn ? ' on' : '')}
            onClick={toggleMaster}
            aria-pressed={isOn}
            aria-label={isOn ? 'Clear selections' : 'Mark done and choose'}
          />
        </div>
        <div className="option-chips">
          {opts.map(o => (
            <button
              key={o.key}
              className={'option-chip' + (chosen.includes(o.key) ? ' on' : '')}
              onClick={() => toggleOption(o.key)}
              aria-pressed={chosen.includes(o.key)}
            >
              {o.label}
            </button>
          ))}
          {opts.length === 0 && (
            <span className="option-empty">No options set — add some in Settings.</span>
          )}
        </div>
      </div>
    );
  }

  // ---- other types share the simple single-row layout ----
  return (
    <div className="habit">
      <span className="icon">{icon}</span>
      <span className="name">{name}</span>

      {type === 'count' ? (
        <div className="stepper">
          <button onClick={() => onChange(Math.max(0, (value || 0) - 1))} aria-label="Decrease">−</button>
          <span className="count">{value || 0}</span>
          <button onClick={() => onChange(Math.min(max, (value || 0) + 1))} aria-label="Increase">+</button>
        </div>
      ) : type === 'number' ? (
        <div className="habit-number">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="0"
            value={value ?? ''}
            onChange={e => {
              const v = e.target.value;
              onChange(v === '' ? 0 : Number(v));
            }}
          />
          {unit ? <span className="unit">{unit}</span> : null}
        </div>
      ) : (
        <button
          className={'toggle' + (value ? ' on' : '')}
          onClick={() => onChange(!value)}
          aria-pressed={!!value}
        />
      )}
    </div>
  );
}
