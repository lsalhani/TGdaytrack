// InsightCard — spec component 4.4. A tinted card: emoji icon on the left,
// a bold headline and a line of body text. `color` selects one of four tints
// (purple, teal, coral, amber) defined in components.css as .insight.<color>.
export default function InsightCard({ icon, color = 'purple', headline, body }) {
  return (
    <div className={'insight ' + color}>
      <span className="insight-icon">{icon}</span>
      <div className="insight-text">
        <p className="insight-headline">{headline}</p>
        <p className="insight-body">{body}</p>
      </div>
    </div>
  );
}
