import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getAlertCount } from "../api";
import { useAuth } from "../AuthContext";

const linkStyle = ({ isActive }) => ({
  padding: "8px 4px",
  borderBottom: isActive ? "2px solid var(--forest)" : "2px solid transparent",
  color: isActive ? "var(--forest)" : "var(--ink)",
  fontWeight: isActive ? 600 : 500,
  textDecoration: "none",
  fontSize: "0.95rem",
  letterSpacing: "0.01em",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openAlerts, setOpenAlerts] = useState(0);

  const isSecurityOrAdmin = user && ["Security Officer", "Administrator"].includes(user.role);

  useEffect(() => {
    if (isSecurityOrAdmin) {
      getAlertCount()
        .then((c) => {
          if (c && typeof c.open === "number") setOpenAlerts(c.open);
        })
        .catch(() => {});
    }
  }, [isSecurityOrAdmin, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      style={{
        borderBottom: "1px solid var(--line-strong)",
        background: "var(--paper)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "18px 28px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              color: "var(--teal)",
              marginBottom: 4,
            }}
          >
            SITUATION ROOM &middot; FEDERAL REPUBLIC OF NIGERIA
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.7rem",
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Electoral Malpractice Watch
          </h1>
        </div>
        <nav style={{ display: "flex", gap: 20, alignItems: "center", paddingBottom: 6, flexWrap: "wrap" }}>
          <NavLink to="/" end style={linkStyle}>
            Dashboard
          </NavLink>
          {user && ["Administrator", "Analyst"].includes(user.role) && (
            <NavLink to="/predict" style={linkStyle}>
              Score a Record
            </NavLink>
          )}
          <NavLink to="/records" style={linkStyle}>
            Records
          </NavLink>
          <NavLink to="/incidents" style={linkStyle}>
            Incidents
          </NavLink>
          {isSecurityOrAdmin && (
            <NavLink to="/alerts" style={linkStyle}>
              Alerts
              {openAlerts > 0 && (
                <span
                  className="mono"
                  style={{
                    background: "var(--red)",
                    color: "#fff",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 10,
                    lineHeight: 1.2,
                  }}
                >
                  {openAlerts}
                </span>
              )}
            </NavLink>
          )}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
              <div style={{ fontSize: "0.8rem", textAlign: "right", lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.6 }}>{user.role}</div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  border: "1px solid var(--line-strong)",
                  background: "#fff",
                  padding: "6px 12px",
                  borderRadius: 3,
                  fontSize: "0.8rem",
                }}
              >
                Log out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
