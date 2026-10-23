import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.includes("/api/auth/login");
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem("emp_token");
      localStorage.removeItem("emp_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const getOverview = () => api.get("/api/stats/overview").then((r) => r.data);
export const getByState = () => api.get("/api/stats/by-state").then((r) => r.data);
export const getByZone = () => api.get("/api/stats/by-zone").then((r) => r.data);
export const getRiskDistribution = () =>
  api.get("/api/stats/risk-distribution").then((r) => r.data);

export const getRecords = (params) =>
  api.get("/api/records", { params }).then((r) => r.data);

export const predictRecord = (payload) =>
  api.post("/api/predict", payload).then((r) => r.data);

export const uploadCsv = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post("/api/upload/csv", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const loginRequest = (email, password) =>
  api.post("/api/auth/login", { email, password }).then((r) => r.data);

export const registerRequest = (fullName, email, password, role) =>
  api
    .post("/api/auth/register", { full_name: fullName, email, password, role })
    .then((r) => r.data);

// Export routes now require auth, so a plain <a href> won't carry the
// token — fetch as a blob with axios (which attaches the Authorization
// header) and trigger the download manually.
export const downloadExport = async (format, params) => {
  const query = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== "" && v != null)
  );
  const response = await api.get(`/api/records/export/${format}`, {
    params: query,
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename=([^;]+)/);
  const filename = match ? match[1].trim() : `export.${format}`;

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
