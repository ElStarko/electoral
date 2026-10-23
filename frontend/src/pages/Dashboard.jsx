import { useEffect, useState } from "react";
import { getByState, getByZone, getModelMetrics, getOverview } from "../api";
import RiskBoard from "../components/RiskBoard";
import StatCard from "../components/StatCard";
import ZoneChart from "../components/ZoneChart";

const ALGO_COLS = [
  { key: "roc_auc", label: "ROC-AUC" },
  { key: "accuracy", label: "Accuracy" },
  { key: "precision_weighted", label: "Precision" },
  { key: "recall_weighted", label: "Recall" },
  { key: "f1_weighted", label: "F1" },
];

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [states, setStates] = useState([]);
  const [zones, setZones] = useState([]);
  const [algoComparison, setAlgoComparison] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getOverview(), getByState(), getByZone()])
      .then(([ov, st, zn]) => {
        setOverview(ov);
        setStates(st.states);
        setZones(zn.zones);
      })
      .catch(() =>
        setError(
          "Couldn't reach the API. Make sure the backend (uvicorn) and MySQL are running."
        )
      );

    // Algorithm comparison is optional — silently skip if models not trained yet
    getModelMetrics()
      .then((m) => setAlgoComparison(m.algorithm_comparison || null))
      .catch(() => {});
  }, []);

  const algoNames = algoComparison
    ? Object.keys(algoComparison).filter((k) => k !== "selected")
    : [];
  const selected = algoComparison?.selected;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px" }}>
      {error && (
        <div
          style={{
            background: "#fdf0ef",
            border: "1px solid var(--red)",
            color: "var(--red)",
            padding: "12px 16px",
            borderRadius: 3,
            marginBottom: 20,
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      <section style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Records scored" value={overview?.total_records ?? "—"} />
        <StatCard
          label="Malpractice flagged"
          value={overview?.malpractice_flagged ?? "—"}
          sub={overview ? `${overview.malpractice_rate_pct}% of records` : undefined}
          accent="var(--red)"
        />
        <StatCard
          label="Anomalies flagged"
          value={overview?.anomalies_flagged ?? "—"}
          accent="var(--amber)"
        />
        <StatCard
          label="Avg. risk score"
          value={overview?.average_risk_score ?? "—"}
          accent="var(--teal)"
        />
      </section>

      <section style={{ marginBottom: 36 }}>
        <SectionHeading eyebrow="Live board" title="Risk by state" />
        <RiskBoard states={states} />
      </section>

      <section style={{ marginBottom: 36 }}>
        <SectionHeading eyebrow="Regional pattern" title="Average risk by geopolitical zone" />
        <div
          style={{
            border: "1px solid var(--line)",
            background: "#fff",
            padding: "18px",
            borderRadius: 3,
          }}
        >
          <ZoneChart zones={zones} />
        </div>
      </section>

      {algoComparison && algoNames.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <SectionHeading
            eyebrow="Chapter 2 evaluation"
            title="Algorithm comparison"
          />
          <div
            style={{
              border: "1px solid var(--line)",
              background: "#fff",
              borderRadius: 3,
              overflow: "auto",
            }}
          >
            {selected && (
              <div
                style={{
                  padding: "10px 16px",
                  background: "var(--forest)",
                  color: "#fff",
                  fontSize: "0.82rem",
                  letterSpacing: "0.02em",
                }}
              >
                ✓ Selected classifier: <strong>{selected}</strong> — highest ROC-AUC on the held-out test set.
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle, #f8f8f8)" }}>
                  <th style={thStyle}>Algorithm</th>
                  {ALGO_COLS.map((c) => (
                    <th key={c.key} style={{ ...thStyle, textAlign: "right" }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {algoNames.map((name) => {
                  const row = algoComparison[name];
                  const isWinner = name === selected;
                  return (
                    <tr
                      key={name}
                      style={{
                        borderTop: "1px solid var(--line)",
                        background: isWinner ? "rgba(0,120,80,0.05)" : undefined,
                        fontWeight: isWinner ? 600 : 400,
                      }}
                    >
                      <td style={{ ...tdStyle, display: "flex", alignItems: "center", gap: 6 }}>
                        {isWinner && (
                          <span style={{ color: "var(--forest)", fontSize: "0.9em" }}>★</span>
                        )}
                        {name}
                      </td>
                      {ALGO_COLS.map((c) => (
                        <td key={c.key} style={{ ...tdStyle, textAlign: "right" }}>
                          {row[c.key] != null ? row[c.key].toFixed(4) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const thStyle = {
  padding: "10px 16px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: "0.78rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--teal)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 16px",
};

function SectionHeading({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        className="mono"
        style={{
          fontSize: "0.68rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--teal)",
          marginBottom: 4,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.25rem",
          margin: 0,
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
    </div>
  );
}
