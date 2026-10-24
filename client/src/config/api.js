// API Base URL configuration:
// In local development: defaults to "http://localhost:5000"
// In production: uses VITE_API_URL if configured (e.g. on Vercel)
export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

export function apiUrl(path = "") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export default API_BASE;
