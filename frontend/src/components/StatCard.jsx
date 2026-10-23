export default function StatCard({ label, value, accent, sub }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderTop: `3px solid ${accent || "var(--forest)"}`,
        background: "#fff",
        padding: "16px 18px",
        borderRadius: 3,
        minWidth: 150,
        flex: "1 1 150px",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: "0.68rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          fontWeight: 700,
          lineHeight: 1,
          color: accent || "var(--ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.78rem", opacity: 0.6, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}
