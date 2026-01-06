import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuthStore } from '../state/authStore';

function resolveApiBase() {
  // expoConfig -> dev/Expo Go, manifest/manifest2/manifestExtra -> production builds
  const extra =
    Constants.expoConfig?.extra ||
    Constants.manifest?.extra ||
    // @ts-expect-error manifest2 is undocumented but present on some builds
    Constants.manifest2?.extra ||
    // @ts-expect-error manifestExtra is new on SDK 54+
    Constants.manifestExtra;

  const candidate = extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || null;
  if (!candidate) {
    console.warn(
      '[api] API base URL ausente. Configure API_BASE_URL/EXPO_PUBLIC_API_BASE_URL para builds.'
    );
  }
  return candidate ? candidate.replace(/\/$/, '') : undefined;
}

const baseUrl = resolveApiBase();
const baseWithVersion = baseUrl ? `${baseUrl}/api/v1` : undefined;

console.log('[api/client] Base URL:', baseUrl, '-> Full:', baseWithVersion);

const api = axios.create({
  baseURL: baseWithVersion,
});

// Axios instance without interceptors for refresh flow
const rawApi = axios.create({
  baseURL: baseWithVersion,
});

let cachedToken: string | null = null;

async function resolveToken(): Promise<string | null> {
  const memoryToken = useAuthStore.getState().token;
  if (memoryToken) {
    cachedToken = memoryToken;
    return memoryToken;
  }
  if (cachedToken) return cachedToken;
  const stored = await SecureStore.getItemAsync('authToken');
  if (stored) cachedToken = stored;
  return stored;
}

api.interceptors.request.use(async config => {
  const token = await resolveToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (__DEV__) {
    (config as any)._startedAt = Date.now();
  }
  return config;
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshToken() {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) return null;
    try {
      const { data } = await rawApi.post('/auth/refresh', { refreshToken });
      const token = data?.token;
      const nextRefresh = data?.refreshToken || refreshToken;
      if (token) {
        await useAuthStore.getState().setTokens({ token, refreshToken: nextRefresh });
        cachedToken = token;
        return token;
      }
      return null;
    } catch (err) {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function shouldRefreshSession(error: any) {
  const status = error?.response?.status;
  if (status === 401) return true;

  const message =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    '';

  return typeof message === 'string' && message.toLowerCase().includes('jwt expired');
}

api.interceptors.response.use(
  response => {
    if (__DEV__ && (response.config as any)._startedAt) {
      const duration = Date.now() - (response.config as any)._startedAt;
      console.log('[api]', response.config.url, `${duration}ms`);
    }
    return response;
  },
  async error => {
    if (__DEV__ && (error?.config as any)?._startedAt) {
      const duration = Date.now() - (error.config as any)._startedAt;
      console.log('[api] error', error.config?.url, `${duration}ms`);
    }
    const originalRequest = error?.config || {};
    if (shouldRefreshSession(error) && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshToken();
      if (newToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
      await useAuthStore.getState().clear();
    }
    return Promise.reject(error);
  }
);

export default api;
