import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 24px" }}>
      <div
        className="mono"
        style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "var(--teal)", marginBottom: 4 }}
      >
        SITUATION ROOM &middot; SIGN IN
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", marginTop: 0 }}>
        Electoral Malpractice Watch
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ border: "1px solid var(--line)", background: "#fff", padding: 24, borderRadius: 3, marginTop: 20 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18, fontSize: "0.85rem" }}>
          <span style={{ opacity: 0.7 }}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ fontSize: "0.85rem", marginTop: 16, textAlign: "center" }}>
        No account? <Link to="/register" style={{ color: "var(--forest)", fontWeight: 600 }}>Register</Link>
      </p>
    </div>
  );
}
