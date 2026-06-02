// HabitRow — one row in the habits card.
// boolean habits render a toggle; count habits render a 0–5 stepper.
export default function HabitRow({ habit, value, onChange }) {
  const { name, icon, type } = habit;

  return (
    <div className="habit">
      <span className="icon">{icon}</span>
      <span className="name">{name}</span>

      {type === 'count' ? (
        <div className="stepper">
          <button onClick={() => onChange(Math.max(0, (value || 0) - 1))}>−</button>
          <span className="count">{value || 0}</span>
          <button onClick={() => onChange(Math.min(5, (value || 0) + 1))}>+</button>
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
