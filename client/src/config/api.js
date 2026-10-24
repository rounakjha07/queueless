// API Base URL configuration:
// In local development: defaults to "http://localhost:5000"
// In cloud/production: defaults to Render backend "https://queueless-og7u.onrender.com"
const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (isLocal ? "http://localhost:5000" : "https://queueless-og7u.onrender.com")
).replace(/\/+$/, "");

export function apiUrl(path = "") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export default API_BASE;
