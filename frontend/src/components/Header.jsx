import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const linkStyle = ({ isActive }) => ({
  padding: "8px 4px",
  borderBottom: isActive ? "2px solid var(--forest)" : "2px solid transparent",
  color: isActive ? "var(--forest)" : "var(--ink)",
  fontWeight: isActive ? 600 : 500,
  textDecoration: "none",
  fontSize: "0.95rem",
  letterSpacing: "0.01em",
});

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <nav style={{ display: "flex", gap: 22, alignItems: "center", paddingBottom: 6 }}>
          <NavLink to="/" end style={linkStyle}>
            Dashboard
          </NavLink>
          <NavLink to="/predict" style={linkStyle}>
            Score a Record
          </NavLink>
          <NavLink to="/records" style={linkStyle}>
            Records
          </NavLink>
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
