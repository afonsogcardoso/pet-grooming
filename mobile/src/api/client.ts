import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuthStore } from '../state/authStore';
import { getCachedToken, setCachedToken } from './tokenCache';
import { useAccountStore } from '../state/accountStore';

function resolveApiBase() {
  // expoConfig -> dev/Expo Go, manifest/manifest2/manifestExtra -> production builds
  const extra =
    (Constants as any).expoConfig?.extra ||
    (Constants as any).manifest?.extra ||
    (Constants as any).manifest2?.extra ||
    (Constants as any).manifestExtra;

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


const api = axios.create({
  baseURL: baseWithVersion,
});

// Axios instance without interceptors for refresh flow
const rawApi = axios.create({
  baseURL: baseWithVersion,
});

async function resolveToken(): Promise<string | null> {
  const memoryToken = useAuthStore.getState().token;
  if (memoryToken) {
    setCachedToken(memoryToken);
    return memoryToken;
  }
  const cachedToken = getCachedToken();
  if (cachedToken) return cachedToken;
  const stored = await SecureStore.getItemAsync('authToken');
  if (stored) setCachedToken(stored);
  return stored;
}

api.interceptors.request.use(async config => {
  const token = await resolveToken();
  const hasToken = Boolean(token);
  if (hasToken) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  try {
    const accountId = useAccountStore.getState().activeAccountId;
    if (accountId) {
      config.headers = config.headers || {};
      if (!config.headers['X-Account-Id'] && !config.headers['x-account-id']) {
        config.headers['X-Account-Id'] = accountId;
      }
    }
  } catch (err) {
    // ignore
  }
  if (__DEV__) {
    (config as any)._startedAt = Date.now();
    const logHeaders = {
      auth: hasToken,
      bearer: token ? `${String(token).slice(0, 10)}...` : null,
      accountHeader: (config.headers || {})['X-Account-Id'] || (config.headers || {})['x-account-id'] || null,
    };
    console.debug('[api:req]', {
      method: config.method,
      url: config.url,
      params: config.params,
      headers: logHeaders,
    });
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
        setCachedToken(token);
        try {
          if (data?.accountId) {
            await useAccountStore.getState().setActiveAccount(data.accountId, data.accountSlug || null);
          }
        } catch {}
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
    if (__DEV__) {
      const started = (response.config as any)._startedAt;
      const dur = typeof started === 'number' ? Date.now() - started : null;
      console.debug('[api:res]', {
        method: response.config?.method,
        url: response.config?.url,
        status: response.status,
        dur,
      });
    }
    return response;
  },
  async error => {
    if (__DEV__) {
      const started = (error?.config as any)?._startedAt;
      const dur = typeof started === 'number' ? Date.now() - started : null;
      console.debug('[api:err]', {
        method: error?.config?.method,
        url: error?.config?.url,
        status: error?.response?.status,
        dur,
        data: error?.response?.data,
      });
    }
    const originalRequest = error?.config || {};
    if (shouldRefreshSession(error) && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshToken();
      if (newToken) {
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${newToken}`,
        };
        return api(originalRequest);
      }
      await useAuthStore.getState().clear();
    }
    return Promise.reject(error);
  }
);

export default api;
