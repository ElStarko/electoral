const levelColor = (avgRisk) => {
  if (avgRisk >= 13) return "var(--red)";
  if (avgRisk >= 7) return "var(--amber)";
  return "var(--teal)";
};

export default function RiskBoard({ states }) {
  if (!states || states.length === 0) {
    return (
      <div style={{ color: "var(--ink)", opacity: 0.6, fontSize: "0.9rem" }}>
        No scored records yet — seed or upload data to populate the board.
      </div>
    );
  }

  const sorted = [...states].sort((a, b) => b.avg_risk_score - a.avg_risk_score);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
        gap: 8,
      }}
    >
      {sorted.map((s, i) => {
        const color = levelColor(s.avg_risk_score);
        const isTop = i === 0;
        return (
          <div
            key={s.state}
            title={`${s.state}: ${s.avg_risk_score} risk score, ${s.malpractice_count}/${s.total} flagged`}
            style={{
              border: `1px solid ${color}`,
              borderLeft: `4px solid ${color}`,
              background: isTop ? `${color}14` : "var(--paper)",
              padding: "10px 10px 8px",
              borderRadius: 3,
              position: "relative",
              overflow: "hidden",
              animation: isTop ? "pulse 2.4s ease-in-out infinite" : "none",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                marginBottom: 6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.state}
            </div>
            <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 600, color }}>
              {s.avg_risk_score}
            </div>
            <div className="mono" style={{ fontSize: "0.65rem", opacity: 0.65 }}>
              {s.malpractice_count}/{s.total} flagged
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(158,43,37,0.0); }
          50% { box-shadow: 0 0 0 4px rgba(158,43,37,0.12); }
        }
      `}</style>
    </div>
  );
}
