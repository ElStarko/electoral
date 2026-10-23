import { useEffect, useState } from "react";
import { downloadExport, getRecords, uploadCsv } from "../api";

const riskColor = (level) =>
  ({
    High: "var(--red)",
    Medium: "var(--amber)",
    Low: "var(--teal)",
  }[level] || "var(--ink)");

export default function Records() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ state: "", risk_level: "", malpractice_only: false });
  const [uploadMsg, setUploadMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.state) params.state = filters.state;
    if (filters.risk_level) params.risk_level = filters.risk_level;
    if (filters.malpractice_only) params.malpractice_only = true;
    params.limit = 100;

    getRecords(params)
      .then((data) => {
        setRecords(data.records);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadMsg("Uploading and scoring…");
    try {
      const res = await uploadCsv(file);
      setUploadMsg(
        `Scored ${res.rows_processed} rows — ${res.malpractice_flagged} flagged (${res.malpractice_rate_pct}%).`
      );
      load();
    } catch {
      setUploadMsg("Upload failed. Check the CSV has the required columns.");
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <div className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
            {total} records on file
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", margin: "4px 0 0", fontSize: "1.25rem" }}>Scored records</h2>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => downloadExport("csv", filters)}
            style={{
              border: "1px solid var(--line-strong)",
              background: "#fff",
              padding: "10px 16px",
              borderRadius: 3,
              fontSize: "0.85rem",
              color: "var(--ink)",
            }}
          >
            Export CSV
          </button>
          <button
            onClick={() => downloadExport("pdf", filters)}
            style={{
              border: "1px solid var(--line-strong)",
              background: "#fff",
              padding: "10px 16px",
              borderRadius: 3,
              fontSize: "0.85rem",
              color: "var(--ink)",
            }}
          >
            Export PDF Report
          </button>
          <label
            style={{
              border: "1px dashed var(--line-strong)",
              padding: "10px 16px",
              borderRadius: 3,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Upload CSV to score in bulk
            <input type="file" accept=".csv" onChange={handleUpload} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      {uploadMsg && (
        <div style={{ marginBottom: 16, fontSize: "0.85rem", color: "var(--teal)" }}>{uploadMsg}</div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          placeholder="Filter by state"
          value={filters.state}
          onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}
        />
        <select
          value={filters.risk_level}
          onChange={(e) => setFilters((f) => ({ ...f, risk_level: e.target.value }))}
        >
          <option value="">All risk levels</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={filters.malpractice_only}
            onChange={(e) => setFilters((f) => ({ ...f, malpractice_only: e.target.checked }))}
          />
          Malpractice-flagged only
        </label>
      </div>

      <div style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 3, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Zone</th>
              <th>Polling unit</th>
              <th>Turnout %</th>
              <th>Risk level</th>
              <th>Risk score</th>
              <th>Malpractice</th>
              <th>Anomaly</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ opacity: 0.5 }}>Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} style={{ opacity: 0.5 }}>No records match these filters.</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r._id}>
                  <td>{r.state}</td>
                  <td>{r.zone}</td>
                  <td className="mono">{r.polling_unit || "—"}</td>
                  <td className="mono">{r.turnout_pct}</td>
                  <td style={{ color: riskColor(r.prediction?.risk_level), fontWeight: 600 }}>
                    {r.prediction?.risk_level}
                  </td>
                  <td className="mono">{r.prediction?.risk_score}</td>
                  <td>{r.prediction?.malpractice_predicted ? "Yes" : "No"}</td>
                  <td>{r.prediction?.is_anomaly ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
