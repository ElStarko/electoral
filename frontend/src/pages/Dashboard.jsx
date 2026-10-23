import { useEffect, useState } from "react";
import { getByState, getByZone, getOverview } from "../api";
import RiskBoard from "../components/RiskBoard";
import StatCard from "../components/StatCard";
import ZoneChart from "../components/ZoneChart";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [states, setStates] = useState([]);
  const [zones, setZones] = useState([]);
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
          "Couldn't reach the API. Make sure the backend (uvicorn) and MongoDB are running."
        )
      );
  }, []);

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

      <section>
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
    </div>
  );
}

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
