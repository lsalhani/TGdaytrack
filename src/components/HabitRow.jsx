// HabitRow — one row in the habits card.
// Three habit types:
//   boolean — on/off toggle
//   count   — small stepper, 0..count_max (default 5)
//   number  — free numeric entry with an optional unit label (e.g. "glasses",
//             "pages", "min"). Good for "how many / how long" tracking.
export default function HabitRow({ habit, value, onChange }) {
  const { name, icon, type, unit, count_max } = habit;
  const max = Number(count_max) || 5;

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
