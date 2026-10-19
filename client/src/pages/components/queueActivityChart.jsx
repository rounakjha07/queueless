
import "./queueActivityChart.css";

export default function QueueActivityChart({ data = [] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  const colors = [
    "#8b5cf6",
    "#38bdf8",
    "#fbbf24",
    "#10b981",
    "#f43f5e",
    "#a78bfa",
    "#14b8a6",
    "#fb7185",
    "#eab308",
    "#6366f1",
  ];

  if (data.length === 0 || data.every((item) => item.count === 0)) {
    return (
      <div className="qa-empty">
        No queue activity to display yet.
      </div>
    );
  }

  const scrollable = data.length > 5;

  return (
    <div
      className="qa-chart-scroll"
      style={{
        width: "100%",
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
        marginTop: "12px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: "1fr",
          gridAutoColumns: scrollable
            ? "120px"
            : `calc((100% - ${(data.length - 1) * 12}px) / ${data.length})`,
          gap: "12px",
          width: scrollable ? "max-content" : "100%",
          height: "190px",
          padding: "4px 4px 0",
          boxSizing: "border-box",
        }}
      >
        {data.map((item, index) => {
          const barHeight = Math.max(
            (item.count / maxCount) * 140,
            8
          );

          return (
            <div
              key={item.name}
              style={{
                display: "grid",
                gridTemplateRows: "minmax(0, 1fr) 30px",
                minWidth: 0,
                height: "100%",
                textAlign: "center",
              }}
            >
              {/* Bar area */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  minHeight: 0,
                  borderBottom:
                    "1px solid var(--border-color, #2b3952)",
                  boxSizing: "border-box",
                  overflow: "visible",
                }}
              >
                {/* Bar + number */}
                <div
                  style={{
                    position: "relative",
                    height: `${barHeight}px`,
                    width: "min(100%, 38px)",
                    flexShrink: 0,
                  }}
                >
                  {/* Number directly above bar */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 5px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: "12px",
                      fontWeight: 700,
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      color: "var(--text-heading, #f1f5ff)",
                    }}
                  >
                    {item.count}
                  </span>

                  {/* Colored bar */}
                  <div
                    title={`${item.name}: ${item.count}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: colors[index % colors.length],
                      borderRadius: "8px 8px 2px 2px",
                    }}
                  />
                </div>
              </div>

              {/* Service name */}
              <span
                title={item.name}
                style={{
                  fontSize: "10px",
                  lineHeight: 1.3,
                  overflowWrap: "anywhere",
                  color: "var(--text-muted, #9aa9c2)",
                  paddingTop: "5px",
                }}
              >
                {item.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
