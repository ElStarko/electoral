import { createContext, useContext, useEffect, useState } from "react";
import { api, loginRequest, registerRequest } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("emp_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const storedUser = localStorage.getItem("emp_user");
      if (storedUser) setUser(JSON.parse(storedUser));
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    const data = await loginRequest(email, password);
    localStorage.setItem("emp_token", data.access_token);
    localStorage.setItem("emp_user", JSON.stringify({ full_name: data.full_name, role: data.role }));
    setToken(data.access_token);
    setUser({ full_name: data.full_name, role: data.role });
    return data;
  };

  const register = async (fullName, email, password, role) => {
    await registerRequest(fullName, email, password, role);
    return login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("emp_token");
    localStorage.removeItem("emp_user");
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
