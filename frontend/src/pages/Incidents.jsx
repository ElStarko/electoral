import { useEffect, useState } from "react";
import { getIncidents, getIncidentsMeta, reportIncident } from "../api";

const severityColor = (sev) =>
  ({
    High: "var(--red)",
    Medium: "var(--amber)",
    Low: "var(--teal)",
  }[sev] || "var(--ink)");

export default function Incidents() {
  const [activeTab, setActiveTab] = useState("list"); // "list" | "report"
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({
    incident_types: [
      "Violence",
      "Ballot Snatching",
      "Over-voting",
      "Voter Intimidation",
      "Result Falsification",
      "Underage Voting",
      "Other",
    ],
    severities: ["Low", "Medium", "High"],
  });

  // Filters
  const [filters, setFilters] = useState({
    state: "",
    severity: "",
    incident_type: "",
  });

  // Form State
  const todayStr = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    puID: "",
    electionID: "1",
    incidentType: "Violence",
    severity: "High",
    dateReported: todayStr,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getIncidentsMeta()
      .then((m) => {
        if (m?.incident_types) setMeta(m);
      })
      .catch(() => {});
  }, []);

  const loadIncidents = () => {
    setLoading(true);
    const params = {};
    if (filters.state) params.state = filters.state;
    if (filters.severity) params.severity = filters.severity;
    if (filters.incident_type) params.incident_type = filters.incident_type;

    getIncidents(params)
      .then((data) => {
        setIncidents(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load incidents", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIncidents();
  }, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const puIDNum = parseInt(formData.puID, 10);
    const electionIDNum = parseInt(formData.electionID, 10);

    if (isNaN(puIDNum) || puIDNum <= 0) {
      setMessage({ type: "error", text: "Please enter a valid Polling Unit ID number." });
      setSubmitting(false);
      return;
    }

    try {
      const res = await reportIncident({
        puID: puIDNum,
        electionID: electionIDNum || 1,
        incidentType: formData.incidentType,
        severity: formData.severity,
        dateReported: formData.dateReported || todayStr,
      });

      setMessage({
        type: "success",
        text: `Incident #${res.incidentID} logged successfully for Polling Unit #${res.puID} (${res.ward || ""}, ${res.lga || ""}, ${res.state || ""}).`,
      });

      setFormData({
        puID: "",
        electionID: "1",
        incidentType: meta.incident_types[0] || "Violence",
        severity: "High",
        dateReported: todayStr,
      });

      loadIncidents();
      setActiveTab("list");
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to submit incident. Ensure the Polling Unit ID exists.";
      setMessage({ type: "error", text: detail });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: "0.68rem",
              letterSpacing: "0.1em",
              color: "var(--teal)",
              textTransform: "uppercase",
            }}
          >
            Use Case 3.2.4 &middot; Citizen &amp; Observer Incident Intake
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              margin: "4px 0 0",
              fontSize: "1.35rem",
            }}
          >
            Incident Reports
          </h2>
        </div>

        {/* Tab switch buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setActiveTab("list")}
            style={{
              border: "1px solid var(--line-strong)",
              background: activeTab === "list" ? "var(--forest)" : "#fff",
              color: activeTab === "list" ? "#fff" : "var(--ink)",
              padding: "8px 16px",
              borderRadius: 3,
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Browse Incidents ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab("report")}
            style={{
              border: "1px solid var(--line-strong)",
              background: activeTab === "report" ? "var(--forest)" : "#fff",
              color: activeTab === "report" ? "#fff" : "var(--ink)",
              padding: "8px 16px",
              borderRadius: 3,
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            + Report New Incident
          </button>
        </div>
      </div>

      {/* Global alert / message banner */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 20,
            borderRadius: 3,
            border: `1px solid ${message.type === "error" ? "var(--red)" : "var(--teal)"}`,
            background: message.type === "error" ? "rgba(158,43,37,0.08)" : "rgba(31,122,92,0.08)",
            color: message.type === "error" ? "var(--red)" : "var(--teal)",
            fontSize: "0.88rem",
          }}
        >
          {message.text}
        </div>
      )}

      {/* TAB: Report an Incident */}
      {activeTab === "report" && (
        <div
          style={{
            border: "1px solid var(--line-strong)",
            background: "#fff",
            padding: "24px",
            borderRadius: 4,
            maxWidth: 680,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              margin: "0 0 8px",
              fontSize: "1.15rem",
            }}
          >
            Log Polling Unit Incident
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "rgba(27,27,24,0.7)" }}>
            Observed irregularities, voter suppression, violence, or ballot tampering recorded from
            the field are saved directly into <code className="mono">tbl_incidentrecord</code>.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                  Polling Unit ID (puID) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 101"
                  value={formData.puID}
                  onChange={(e) => setFormData({ ...formData, puID: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 3,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                  Election ID *
                </label>
                <input
                  type="number"
                  required
                  value={formData.electionID}
                  onChange={(e) => setFormData({ ...formData, electionID: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 3,
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                  Incident Type *
                </label>
                <select
                  value={formData.incidentType}
                  onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 3,
                    fontSize: "0.88rem",
                    background: "#fff",
                  }}
                >
                  {meta.incident_types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                  Severity Level *
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 3,
                    fontSize: "0.88rem",
                    background: "#fff",
                  }}
                >
                  {meta.severities.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                Date Reported
              </label>
              <input
                type="date"
                value={formData.dateReported}
                onChange={(e) => setFormData({ ...formData, dateReported: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 3,
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: "var(--forest)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 3,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Submitting Incident…" : "Submit Incident Report"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--line)",
                  padding: "10px 18px",
                  borderRadius: 3,
                  fontSize: "0.9rem",
                  color: "var(--ink)",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: List of Incidents */}
      {activeTab === "list" && (
        <>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              background: "#fff",
              border: "1px solid var(--line)",
              padding: "14px 18px",
              borderRadius: 3,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--teal)" }}>
                State:
              </span>
              <input
                type="text"
                placeholder="All states"
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 3,
                  fontSize: "0.82rem",
                  width: 130,
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--teal)" }}>
                Type:
              </span>
              <select
                value={filters.incident_type}
                onChange={(e) => setFilters({ ...filters, incident_type: e.target.value })}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 3,
                  fontSize: "0.82rem",
                  background: "#fff",
                }}
              >
                <option value="">All Types</option>
                {meta.incident_types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--teal)" }}>
                Severity:
              </span>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 3,
                  fontSize: "0.82rem",
                  background: "#fff",
                }}
              >
                <option value="">All Severities</option>
                {meta.severities.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {(filters.state || filters.severity || filters.incident_type) && (
              <button
                onClick={() => setFilters({ state: "", severity: "", incident_type: "" })}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "0.8rem",
                  color: "var(--red)",
                  textDecoration: "underline",
                  padding: 4,
                }}
              >
                Reset filters
              </button>
            )}

            <button
              onClick={loadIncidents}
              style={{
                marginLeft: "auto",
                background: "#fff",
                border: "1px solid var(--line)",
                padding: "6px 12px",
                borderRadius: 3,
                fontSize: "0.8rem",
              }}
            >
              Refresh
            </button>
          </div>

          {/* Incidents Table */}
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 3,
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr
                  className="mono"
                  style={{
                    borderBottom: "1px solid var(--line-strong)",
                    background: "var(--paper-dim)",
                    textAlign: "left",
                    fontSize: "0.72rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <th style={{ padding: "10px 14px" }}>ID</th>
                  <th style={{ padding: "10px 14px" }}>Date</th>
                  <th style={{ padding: "10px 14px" }}>Incident Type</th>
                  <th style={{ padding: "10px 14px" }}>Severity</th>
                  <th style={{ padding: "10px 14px" }}>PU ID</th>
                  <th style={{ padding: "10px 14px" }}>State</th>
                  <th style={{ padding: "10px 14px" }}>LGA</th>
                  <th style={{ padding: "10px 14px" }}>Ward</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "rgba(27,27,24,0.6)" }}>
                      Loading incident records…
                    </td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "rgba(27,27,24,0.6)" }}>
                      No incident reports found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr
                      key={inc.incidentID}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="mono" style={{ padding: "10px 14px", fontWeight: 600 }}>
                        #{inc.incidentID}
                      </td>
                      <td className="mono" style={{ padding: "10px 14px", fontSize: "0.78rem" }}>
                        {inc.dateReported || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                        {inc.incidentType}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          className="mono"
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 2,
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            color: severityColor(inc.severity),
                            background:
                              inc.severity === "High"
                                ? "rgba(158,43,37,0.12)"
                                : inc.severity === "Medium"
                                ? "rgba(201,123,46,0.12)"
                                : "rgba(31,122,92,0.12)",
                          }}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="mono" style={{ padding: "10px 14px" }}>
                        PU-{inc.puID}
                      </td>
                      <td style={{ padding: "10px 14px" }}>{inc.state || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{inc.lga || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{inc.ward || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
