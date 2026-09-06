import axios from 'axios';
import { API_BASE_URL as BASE_URL } from '../config';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Đọc exp claim từ JWT (không verify signature — chỉ để check expiry phía client)
function getTokenExp(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).exp; // seconds since epoch
  } catch {
    return null;
  }
}

// Dùng chung cho cả request interceptor (proactive) và response interceptor (reactive)
let refreshPromise = null;

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

function doRefresh() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('refreshToken');

    // Không có refresh token → clear và redirect ngay, không gọi backend
    if (!refreshToken) {
      clearSession();
      window.location.href = '/login';
      return Promise.reject(new Error('No refresh token'));
    }

    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        return data.data.accessToken;
      })
      .catch((e) => {
        clearSession();
        window.location.href = '/login';
        throw e;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ── Request interceptor — proactive refresh nếu token hết hạn trong vòng 60s ──
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('accessToken');

  if (token) {
    const exp = getTokenExp(token);
    const expiresInMs = exp ? exp * 1000 - Date.now() : Infinity;

    if (expiresInMs < 60_000) {
      // Token sắp hết hạn hoặc đã hết — refresh trước khi gửi request
      try {
        token = await doRefresh();
      } catch {
        // doRefresh() đã redirect về /login nếu thất bại
        return Promise.reject(new Error('Session expired'));
      }
    }

    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ── Response interceptor — reactive fallback nếu server vẫn trả 401 ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Không retry nếu chính request refresh bị 401 (tránh vòng lặp)
    if (original?.url?.includes('/auth/')) return Promise.reject(error);

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const newToken = await doRefresh();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
