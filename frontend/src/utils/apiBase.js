/** Base URL API (tanpa trailing slash). Override lewat VITE_API_BASE_URL jika perlu. */
const DEFAULT_API_BASE = "https://api-inventory.isavralabel.com/appointment-pasien";

export function getApiBaseUrl() {
  const env = import.meta.env.VITE_API_BASE_URL;
  const raw = (typeof env === "string" && env.trim()) || DEFAULT_API_BASE;
  return raw.replace(/\/$/, "");
}

/**
 * @param {string} path contoh "/api/health" atau "api/health"
 */
export function apiUrl(path) {
  if (!path) return getApiBaseUrl();
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${p}`;
}
