import "./queueActivityChart.css";

export default function QueueActivityChart({ data = [] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  const gradientPairs = [
    { from: "#6366f1", to: "#818cf8", glow: "rgba(99, 102, 241, 0.4)" }, // Indigo
    { from: "#0284c7", to: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)" }, // Sky
    { from: "#059669", to: "#34d399", glow: "rgba(16, 185, 129, 0.4)" }, // Emerald
    { from: "#d97706", to: "#fbbf24", glow: "rgba(245, 158, 11, 0.4)" }, // Amber
    { from: "#db2777", to: "#f472b6", glow: "rgba(236, 72, 153, 0.4)" }, // Pink
    { from: "#7c3aed", to: "#a78bfa", glow: "rgba(124, 58, 237, 0.4)" }, // Violet
    { from: "#0891b2", to: "#22d3ee", glow: "rgba(6, 182, 212, 0.4)" }, // Cyan
    { from: "#e11d48", to: "#fb7185", glow: "rgba(244, 63, 94, 0.4)" }, // Rose
  ];

  if (data.length === 0) {
    return (
      <div className="qa-modern-empty">
        <span className="qa-empty-glyph">📊</span>
        <h4>No Services Configured</h4>
        <p>Add departments or load demo dataset to view activity distribution.</p>
      </div>
    );
  }

  const scrollable = data.length > 5;

  return (
    <div className="qa-chart-container">
      {scrollable && (
        <div className="qa-scroll-hint">
          <span>⇄ Scroll horizontally ({data.length} services)</span>
        </div>
      )}
      <div className={`qa-bars-track ${scrollable ? "is-scrollable" : ""}`}>
        {data.map((item, index) => {
          const barHeight = Math.max((item.count / maxCount) * 140, 10);
          const colors = gradientPairs[index % gradientPairs.length];

          return (
            <div key={item.name} className="qa-bar-col">
              {/* Bar track and fill */}
              <div className="qa-bar-slot">
                <div
                  className="qa-bar-capsule"
                  style={{
                    height: `${barHeight}px`,
                    background: `linear-gradient(180deg, ${colors.to}, ${colors.from})`,
                    boxShadow: `0 4px 14px ${colors.glow}`,
                  }}
                  title={`${item.name}: ${item.count} customers`}
                >
                  <span className="qa-floating-count">{item.count}</span>
                </div>
              </div>

              {/* Label */}
              <div className="qa-bar-label-wrap" title={item.name}>
                <span className="qa-bar-label">{item.name}</span>
                <span className="qa-bar-subcount">{item.count} visits</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
