import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'voxpact.token';

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  timeout: 30_000,
});

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session only */
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Broadcast 401s so the auth provider can sign the user out cleanly. */
export const UNAUTHORIZED_EVENT = 'voxpact:unauthorized';

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401 && getToken()) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);

export function apiError(error: unknown, fallback = 'Something went wrong'): string {
  const err = error as AxiosError<{ error?: string; details?: { message: string }[] }>;
  if (err?.response?.data?.details?.length) return err.response.data.details[0].message;
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.message === 'Network Error') return 'Cannot reach the server. Is the API running?';
  if (err?.message) return err.message;
  return fallback;
}

/** GET a file (CSV export) and trigger a browser download. */
export async function downloadFile(url: string, params?: Record<string, unknown>, filename?: string) {
  const response = await api.get(url, { params, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = disposition.match(/filename="?([^";]+)"?/);
  const name = filename ?? match?.[1] ?? 'export.csv';
  const blob = new Blob([response.data]);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
