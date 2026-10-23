import { useEffect, useState } from "react";
import { getAlertCount, getAlerts, patchAlert } from "../api";
import { useAuth } from "../AuthContext";

const statusColor = (st) =>
  ({
    Open: "var(--red)",
    Responding: "var(--amber)",
    Resolved: "var(--teal)",
  }[st] || "var(--ink)");

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ open: 0, responding: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState(""); // "" means active (open+responding)
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});
  const [newStatusState, setNewStatusState] = useState({});
  const [message, setMessage] = useState(null);

  const loadAlerts = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;

    Promise.all([getAlerts(params), getAlertCount()])
      .then(([alertsData, countData]) => {
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        if (countData) setCounts(countData);

        // Prepopulate editing state
        const initialFeedbacks = {};
        const initialStatuses = {};
        (alertsData || []).forEach((a) => {
          initialFeedbacks[a.alertID] = a.fieldResponseFeedback || "";
          initialStatuses[a.alertID] = a.status || "Open";
        });
        setFeedbackState(initialFeedbacks);
        setNewStatusState(initialStatuses);
      })
      .catch((err) => {
        console.error("Failed to load alerts:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  const handleUpdate = async (alertId) => {
    setUpdatingId(alertId);
    setMessage(null);
    try {
      const payload = {
        status: newStatusState[alertId],
        fieldResponseFeedback: feedbackState[alertId],
      };
      const updated = await patchAlert(alertId, payload);
      setMessage({
        type: "success",
        text: `Alert #${alertId} updated to '${updated.status}'. Feedback logged.`,
      });
      loadAlerts();
    } catch (err) {
      const detail =
        err.response?.data?.detail || "Failed to update alert. Check your role permissions.";
      setMessage({ type: "error", text: detail });
    } finally {
      setUpdatingId(null);
    }
  };

  const isAuthorized = user && ["Security Officer", "Administrator"].includes(user.role);

  if (!isAuthorized) {
    return (
      <div style={{ maxWidth: 800, margin: "60px auto", textAlign: "center", padding: "28px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}>
          Access Restricted
        </h2>
        <p style={{ color: "rgba(27,27,24,0.7)", fontSize: "0.95rem" }}>
          The High-Risk Alert Queue is restricted to <strong>Security Officer</strong> and{" "}
          <strong>Administrator</strong> personnel in accordance with the security incident response
          architecture (Ch.3 Activity Diagram).
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px" }}>
      {/* Header */}
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
            Ch.3 Activity Diagram 3.2.5 &middot; Security Response Queue
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              margin: "4px 0 0",
              fontSize: "1.35rem",
            }}
          >
            High-Risk Alert Dispatch
          </h2>
        </div>

        <button
          onClick={loadAlerts}
          style={{
            background: "#fff",
            border: "1px solid var(--line-strong)",
            padding: "8px 14px",
            borderRadius: 3,
            fontSize: "0.85rem",
          }}
        >
          Refresh Queue
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          onClick={() => setStatusFilter("Open")}
          style={{
            border: `1px solid ${statusFilter === "Open" ? "var(--red)" : "var(--line)"}`,
            background: "#fff",
            padding: "16px 20px",
            borderRadius: 4,
            cursor: "pointer",
            borderLeft: "4px solid var(--red)",
          }}
        >
          <div className="mono" style={{ fontSize: "0.72rem", color: "var(--red)", textTransform: "uppercase" }}>
            Open Alerts (Action Required)
          </div>
          <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "6px 0 0" }}>
            {counts.open}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("Responding")}
          style={{
            border: `1px solid ${statusFilter === "Responding" ? "var(--amber)" : "var(--line)"}`,
            background: "#fff",
            padding: "16px 20px",
            borderRadius: 4,
            cursor: "pointer",
            borderLeft: "4px solid var(--amber)",
          }}
        >
          <div className="mono" style={{ fontSize: "0.72rem", color: "var(--amber)", textTransform: "uppercase" }}>
            Responding / In Field
          </div>
          <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "6px 0 0" }}>
            {counts.responding}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("Resolved")}
          style={{
            border: `1px solid ${statusFilter === "Resolved" ? "var(--teal)" : "var(--line)"}`,
            background: "#fff",
            padding: "16px 20px",
            borderRadius: 4,
            cursor: "pointer",
            borderLeft: "4px solid var(--teal)",
          }}
        >
          <div className="mono" style={{ fontSize: "0.72rem", color: "var(--teal)", textTransform: "uppercase" }}>
            Resolved
          </div>
          <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "6px 0 0" }}>
            {counts.resolved}
          </div>
        </div>
      </div>

      {/* Message alert */}
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

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--line-strong)",
          paddingBottom: 8,
        }}
      >
        <button
          onClick={() => setStatusFilter("")}
          style={{
            background: statusFilter === "" ? "var(--forest)" : "transparent",
            color: statusFilter === "" ? "#fff" : "var(--ink)",
            border: "none",
            padding: "6px 14px",
            borderRadius: 3,
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          Active (Open &amp; Responding)
        </button>
        <button
          onClick={() => setStatusFilter("Open")}
          style={{
            background: statusFilter === "Open" ? "var(--red)" : "transparent",
            color: statusFilter === "Open" ? "#fff" : "var(--ink)",
            border: "none",
            padding: "6px 14px",
            borderRadius: 3,
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          Open Only
        </button>
        <button
          onClick={() => setStatusFilter("Responding")}
          style={{
            background: statusFilter === "Responding" ? "var(--amber)" : "transparent",
            color: statusFilter === "Responding" ? "#fff" : "var(--ink)",
            border: "none",
            padding: "6px 14px",
            borderRadius: 3,
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          Responding Only
        </button>
        <button
          onClick={() => setStatusFilter("Resolved")}
          style={{
            background: statusFilter === "Resolved" ? "var(--teal)" : "transparent",
            color: statusFilter === "Resolved" ? "#fff" : "var(--ink)",
            border: "none",
            padding: "6px 14px",
            borderRadius: 3,
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          Resolved
        </button>
      </div>

      {/* Alert List Cards */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "rgba(27,27,24,0.6)" }}>
          Loading alerts queue…
        </div>
      ) : alerts.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--line-strong)",
            background: "#fff",
            padding: "48px 24px",
            textAlign: "center",
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 6 }}>
            No alerts found in this view
          </div>
          <p style={{ color: "rgba(27,27,24,0.6)", fontSize: "0.85rem", margin: 0 }}>
            {statusFilter
              ? `There are currently no alerts with status '${statusFilter}'.`
              : "No active high-risk alerts currently require field intervention."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {alerts.map((alert) => {
            const pu = alert.polling_unit || {};
            const risk = alert.risk || {};
            const isSaving = updatingId === alert.alertID;

            return (
              <div
                key={alert.alertID}
                style={{
                  border: "1px solid var(--line-strong)",
                  background: "#fff",
                  borderRadius: 4,
                  padding: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {/* Alert Top Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "var(--ink)",
                      }}
                    >
                      Alert #{alert.alertID}
                    </span>
                    <span
                      className="mono"
                      style={{
                        padding: "2px 8px",
                        borderRadius: 2,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#fff",
                        background: statusColor(alert.status),
                      }}
                    >
                      {alert.status.toUpperCase()}
                    </span>
                    <span
                      className="mono"
                      style={{
                        padding: "2px 8px",
                        borderRadius: 2,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#fff",
                        background: "var(--red)",
                      }}
                    >
                      {risk.risk_level || "HIGH"} RISK ({risk.risk_score != null ? Number(risk.risk_score).toFixed(3) : "—"})
                    </span>
                  </div>

                  <div className="mono" style={{ fontSize: "0.74rem", opacity: 0.65 }}>
                    Triggered: {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "—"}
                  </div>
                </div>

                {/* Polling Unit Details */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: 16,
                    background: "var(--paper)",
                    padding: "12px 14px",
                    borderRadius: 3,
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.6, textTransform: "uppercase" }}>
                      Polling Unit
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      {pu.code || `PU-${pu.puID}`}
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.6, textTransform: "uppercase" }}>
                      Ward / LGA
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      {pu.ward || "—"}, {pu.lga || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.6, textTransform: "uppercase" }}>
                      State &amp; Zone
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      {pu.state || "—"} ({pu.zone || "—"})
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.6, textTransform: "uppercase" }}>
                      Prediction Record
                    </div>
                    <div className="mono" style={{ fontSize: "0.82rem" }}>
                      Ref #{alert.predictionID}
                    </div>
                  </div>
                </div>

                {/* Field Response Feedback & Status Update (Ch.3 Activity Diagram) */}
                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    Security Field Response Feedback (Activity Diagram 3.2.5)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Log deployment details, on-site personnel findings, or incident resolution summary…"
                    value={feedbackState[alert.alertID] ?? ""}
                    onChange={(e) =>
                      setFeedbackState({ ...feedbackState, [alert.alertID]: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 3,
                      fontSize: "0.85rem",
                      fontFamily: "var(--font-body)",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Update Status:
                      </span>
                      <select
                        value={newStatusState[alert.alertID] || alert.status}
                        onChange={(e) =>
                          setNewStatusState({ ...newStatusState, [alert.alertID]: e.target.value })
                        }
                        style={{
                          padding: "6px 10px",
                          border: "1px solid var(--line-strong)",
                          borderRadius: 3,
                          fontSize: "0.82rem",
                          background: "#fff",
                        }}
                      >
                        <option value="Open">Open</option>
                        <option value="Responding">Responding</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleUpdate(alert.alertID)}
                      disabled={isSaving}
                      style={{
                        background: "var(--forest)",
                        color: "#fff",
                        border: "none",
                        padding: "8px 18px",
                        borderRadius: 3,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? "Saving…" : "Save Field Response"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
