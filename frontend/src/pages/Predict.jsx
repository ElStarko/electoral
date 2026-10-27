import { useState } from "react";
import { predictRecord } from "../api";

const ZONES = {
  "North Central": ["Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "FCT"],
  "North East": ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"],
  "North West": ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"],
  "South East": ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
  "South South": ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
  "South West": ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
};

// State-level socio-economic baselines (matches data/generate_dataset.py)
const STATE_INDICATORS = {
  Benue: [68, 28], Kogi: [64, 30], Kwara: [70, 24], Nasarawa: [60, 27], Niger: [55, 26], Plateau: [66, 29], FCT: [88, 18],
  Adamawa: [58, 32], Bauchi: [48, 35], Borno: [45, 38], Gombe: [50, 33], Taraba: [54, 34], Yobe: [42, 37],
  Jigawa: [44, 30], Kaduna: [62, 27], Kano: [52, 31], Katsina: [46, 33], Kebbi: [41, 35], Sokoto: [40, 36], Zamfara: [39, 37],
  Abia: [85, 22], Anambra: [87, 19], Ebonyi: [72, 26], Enugu: [84, 21], Imo: [86, 23],
  "Akwa Ibom": [80, 24], Bayelsa: [78, 26], "Cross River": [79, 23], Delta: [82, 20], Edo: [81, 22], Rivers: [83, 21],
  Ekiti: [89, 20], Lagos: [92, 17], Ogun: [85, 19], Ondo: [83, 21], Osun: [86, 20], Oyo: [80, 20],
};

const initialForm = {
  zone: "South West",
  state: "Lagos",
  lga: "",
  ward: "",
  polling_unit: "",
  registered_voters: 500,
  accredited_voters: 400,
  total_votes_cast: 410,
  valid_votes: 400,
  rejected_votes: 10,
  turnout_pct: 82,
  leading_party_vote_share: 0.55,
  benford_deviation_score: 0.2,
  over_voting_flag: 0,
  literacy_rate: 60,
  unemployment_rate: 25,
};

const riskColor = (level) =>
  ({
    High: "var(--red)",
    Medium: "var(--amber)",
    Low: "var(--teal)",
  }[level] || "var(--ink)");

export default function Predict() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        ...form,
        registered_voters: Number(form.registered_voters),
        accredited_voters: Number(form.accredited_voters),
        total_votes_cast: Number(form.total_votes_cast),
        valid_votes: Number(form.valid_votes),
        rejected_votes: Number(form.rejected_votes),
        turnout_pct: Number(form.turnout_pct),
        leading_party_vote_share: Number(form.leading_party_vote_share),
        benford_deviation_score: Number(form.benford_deviation_score),
        over_voting_flag: Number(form.over_voting_flag),
        literacy_rate: Number(form.literacy_rate),
        unemployment_rate: Number(form.unemployment_rate),
      };
      const data = await predictRecord(payload);
      setResult(data.prediction);
    } catch (err) {
      setError("Prediction failed. Check the API is running and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px", display: "flex", gap: 28, flexWrap: "wrap" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          flex: "1 1 480px",
          border: "1px solid var(--line)",
          background: "#fff",
          padding: 22,
          borderRadius: 3,
        }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", marginTop: 0 }}>
          Score a polling unit record
        </h2>
        <p style={{ fontSize: "0.85rem", opacity: 0.65, marginTop: -6 }}>
          Enter the raw figures reported for a polling unit. The system runs
          all three models — classification, risk scoring, and anomaly
          detection — against them.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <Field label="Zone">
            <select
              value={form.zone}
              onChange={(e) => {
                const zone = e.target.value;
                update("zone", zone);
                update("state", ZONES[zone][0]);
              }}
            >
              {Object.keys(ZONES).map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
          <Field label="State">
            <select
              value={form.state}
              onChange={(e) => {
                const state = e.target.value;
                update("state", state);
                const indicators = STATE_INDICATORS[state];
                if (indicators) {
                  setForm((f) => ({ ...f, state, literacy_rate: indicators[0], unemployment_rate: indicators[1] }));
                }
              }}
            >
              {ZONES[form.zone].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="LGA">
            <input value={form.lga} onChange={(e) => update("lga", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Polling unit code">
            <input
              value={form.polling_unit}
              onChange={(e) => update("polling_unit", e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Registered voters">
            <input type="number" value={form.registered_voters} onChange={(e) => update("registered_voters", e.target.value)} />
          </Field>
          <Field label="Accredited voters">
            <input type="number" value={form.accredited_voters} onChange={(e) => update("accredited_voters", e.target.value)} />
          </Field>
          <Field label="Total votes cast">
            <input type="number" value={form.total_votes_cast} onChange={(e) => update("total_votes_cast", e.target.value)} />
          </Field>
          <Field label="Valid votes">
            <input type="number" value={form.valid_votes} onChange={(e) => update("valid_votes", e.target.value)} />
          </Field>
          <Field label="Rejected votes">
            <input type="number" value={form.rejected_votes} onChange={(e) => update("rejected_votes", e.target.value)} />
          </Field>
          <Field label="Turnout %">
            <input type="number" step="0.1" value={form.turnout_pct} onChange={(e) => update("turnout_pct", e.target.value)} />
          </Field>
          <Field label="Leading party vote share (0-1)">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.leading_party_vote_share}
              onChange={(e) => update("leading_party_vote_share", e.target.value)}
            />
          </Field>
          <Field label="Benford deviation score (0-1)">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.benford_deviation_score}
              onChange={(e) => update("benford_deviation_score", e.target.value)}
            />
          </Field>
          <Field label="Over-voting observed?">
            <select value={form.over_voting_flag} onChange={(e) => update("over_voting_flag", e.target.value)}>
              <option value={0}>No</option>
              <option value={1}>Yes</option>
            </select>
          </Field>
          <Field label="Literacy rate % (state indicator)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.literacy_rate}
              onChange={(e) => update("literacy_rate", e.target.value)}
            />
          </Field>
          <Field label="Unemployment rate % (state indicator)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.unemployment_rate}
              onChange={(e) => update("unemployment_rate", e.target.value)}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 18,
            background: "var(--forest)",
            color: "var(--paper)",
            border: "none",
            padding: "10px 20px",
            borderRadius: 3,
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          {loading ? "Scoring…" : "Run prediction"}
        </button>
        {error && <div style={{ color: "var(--red)", marginTop: 10, fontSize: "0.85rem" }}>{error}</div>}
      </form>

      <div style={{ flex: "1 1 300px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>Result</h2>
        {!result ? (
          <div style={{ opacity: 0.55, fontSize: "0.9rem" }}>
            Submit the form to see the malpractice classification, risk
            score, and anomaly flag.
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${riskColor(result.risk_level)}`,
              borderLeft: `5px solid ${riskColor(result.risk_level)}`,
              background: "#fff",
              padding: 20,
              borderRadius: 3,
            }}
          >
            <div className="mono" style={{ fontSize: "0.7rem", letterSpacing: "0.08em", opacity: 0.6 }}>
              RISK LEVEL
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.8rem",
                fontWeight: 700,
                color: riskColor(result.risk_level),
                marginBottom: 12,
              }}
            >
              {result.risk_level} &middot; {result.risk_score}
            </div>

            <Row label="Malpractice predicted" value={result.malpractice_predicted ? "Yes" : "No"} />
            <Row label="Malpractice probability" value={`${(result.malpractice_probability * 100).toFixed(1)}%`} />
            <Row label="Statistical anomaly" value={result.is_anomaly ? "Flagged" : "Not flagged"} />
            <Row label="Anomaly score" value={result.anomaly_score} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderTop: "1px solid var(--line)",
        fontSize: "0.88rem",
      }}
    >
      <span style={{ opacity: 0.65 }}>{label}</span>
      <span className="mono" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
