import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const ROLES = ["Administrator", "Analyst", "Security Officer"];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "Analyst" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(form.fullName, form.email, form.password, form.role);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "60px auto", padding: "0 24px" }}>
      <div
        className="mono"
        style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "var(--teal)", marginBottom: 4 }}
      >
        SITUATION ROOM &middot; REGISTER
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", marginTop: 0 }}>
        Create an account
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ border: "1px solid var(--line)", background: "#fff", padding: 24, borderRadius: 3, marginTop: 20 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Full name</span>
          <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Email</span>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            required
            minLength={6}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18, fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Role</span>
          <select value={form.role} onChange={(e) => update("role", e.target.value)}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>

        {error && <div style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "var(--forest)",
            color: "var(--paper)",
            border: "none",
            padding: "10px 0",
            borderRadius: 3,
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={{ fontSize: "0.85rem", marginTop: 16, textAlign: "center" }}>
        Already have an account? <Link to="/login" style={{ color: "var(--forest)", fontWeight: 600 }}>Sign in</Link>
      </p>
    </div>
  );
}
