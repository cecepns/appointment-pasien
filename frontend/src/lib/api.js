import { apiUrl } from "../utils/apiBase";

export { getApiBaseUrl, apiUrl } from "../utils/apiBase";

export async function fetchJson(path, options = {}) {
  const { signal, ...rest } = options;
  const res = await fetch(apiUrl(path), {
    ...rest,
    signal,
    headers: {
      ...(rest.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Invalid JSON" };
  }
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
