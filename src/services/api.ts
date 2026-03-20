import axios from 'axios';
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

// ---- Axios instance ----
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject auth token on every request from the shared module-level variable
api.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers['Authorization'] = `Bearer ${_authToken}`;
  }
  return config;
});

// Token refresh interceptor - handles 401s by refreshing the token
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
};

const REFRESH_URL = '/api/auth/refresh';

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry || originalRequest.url === REFRESH_URL) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

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

      const response = await api.post(REFRESH_URL, { refreshToken });
      const data = response.data.data || response.data;
      const { token, refreshToken: newRefreshToken } = data;

      try {
        const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state = { ...parsed.state, token, refreshToken: newRefreshToken };
          localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(parsed));
        }
      } catch { /* ignore */ }

      _authToken = token;
      processQueue(null, token);

      originalRequest.headers['Authorization'] = `Bearer ${token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      _authToken = null;
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
