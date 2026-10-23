import { createContext, useContext, useEffect, useState } from "react";
import { api, loginRequest, registerRequest } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("emp_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("emp_token"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      try {
        const storedUser = localStorage.getItem("emp_user");
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch {}
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = async (email, password) => {
    const data = await loginRequest(email, password);
    const userData = { full_name: data.full_name, role: data.role };
    localStorage.setItem("emp_token", data.access_token);
    localStorage.setItem("emp_user", JSON.stringify(userData));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setToken(data.access_token);
    setUser(userData);
    return data;
  };

  const register = async (fullName, email, password, role) => {
    await registerRequest(fullName, email, password, role);
    return login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("emp_token");
    localStorage.removeItem("emp_user");
    delete api.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
