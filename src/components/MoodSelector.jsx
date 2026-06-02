// MoodSelector — five tap targets (1–5). Controlled component:
// parent owns `value`, we call `onChange(n)` when one is tapped.
const MOODS = [
  { n: 1, word: 'rough' },
  { n: 2, word: 'meh' },
  { n: 3, word: 'ok' },
  { n: 4, word: 'good' },
  { n: 5, word: 'great' }
];

export default function MoodSelector({ value, onChange }) {
  return (
    <section className="card mood-card">
      <p className="prompt">How was your day?</p>
      <div className="mood-row">
        {MOODS.map(({ n, word }) => (
          <button
            key={n}
            className={'mood' + (value === n ? ' selected' : '')}
            onClick={() => onChange(n)}
          >
            <div className="num">{n}</div>
            <div className="word">{word}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
