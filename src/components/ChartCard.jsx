// ChartCard — a titled card that wraps any chart (the spec's component 4.6).
export default function ChartCard({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="chart-slot">{children}</div>
    </section>
  );
}
