import axios, { type AxiosInstance } from 'axios';
import { STORAGE_KEYS } from '../utils/constants';

// ---- JWT expiry check ----
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // Expired if within 30s of expiry (buffer for clock skew)
    return Date.now() >= (payload.exp * 1000) - 30000;
  } catch {
    return true;
  }
}

// ---- Shared auth token ----
// Module-level token that is initialized from localStorage SYNCHRONOUSLY at import time,
// before React renders or queries fire. This avoids the Zustand rehydration race condition
// and sidesteps Axios v1.x AxiosHeaders internals.
let _authToken: string | null = null;

try {
  const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
  if (stored) {
    const { state } = JSON.parse(stored);
    const token = state?.token || null;
    if (token && !isTokenExpired(token)) {
      _authToken = token;
    }
    // Don't clear localStorage when token is expired — let Zustand rehydrate
    // with the stored state so the refresh interceptor can attempt token renewal.
  }
} catch { /* ignore */ }

export function getAuthToken(): string | null {
  return _authToken;
}

export function setAuthToken(token: string | null) {
  _authToken = token;
}

// ---- Shared token refresh state ----
// Single refresh state shared across all axios instances so concurrent 401s
// from different instances coordinate through one refresh cycle.
let _isRefreshing = false;
let _failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  _failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  _failedQueue = [];
}

const REFRESH_URL = '/api/auth/refresh';

// ---- Reusable interceptor setup ----

/** Attach request interceptor that injects the auth token header. */
export function attachAuthInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  });
}

/** Attach response interceptor that handles 401 → token refresh → retry. */
export function attachTokenRefreshInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const url = originalRequest?.url || '';

      // Don't intercept non-401s, already-retried requests, or auth/refresh routes
      if (
        error.response?.status !== 401 ||
        originalRequest._retry ||
        url === REFRESH_URL ||
        url.includes('/auth/')
      ) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (_isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return instance(originalRequest);
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        let refreshToken: string | null = null;
        try {
          const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
          if (stored) {
            const parsed = JSON.parse(stored);
            refreshToken = parsed.state?.refreshToken || null;
          }
        } catch { /* ignore */ }

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Use a plain axios call so it doesn't trigger interceptors on either instance
        const response = await axios.post(REFRESH_URL, { refreshToken }, {
          headers: { 'Content-Type': 'application/json' },
        });
        const data = response.data?.data || response.data;
        const { token, refreshToken: newRefreshToken } = data;

        // Update module-level auth token
        _authToken = token;

        // Update localStorage so Zustand stays in sync
        try {
          const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.state = { ...parsed.state, token, refreshToken: newRefreshToken };
            localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(parsed));
          }
        } catch { /* ignore */ }

        processQueue(null, token);

        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return instance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem(STORAGE_KEYS.AUTH);
        _authToken = null;
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }
  );
}

// ---- Axios instance ----
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

attachAuthInterceptor(api);
attachTokenRefreshInterceptor(api);

export default api;
