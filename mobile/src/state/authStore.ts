import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { clearProfileCache } from './profileCache';

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  user: {
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    userType?: 'consumer' | 'provider' | null;
  } | null;
  setTokens: (params: { token: string; refreshToken?: string | null }) => Promise<void>;
  setUser: (
    user: {
      email?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      userType?: 'consumer' | 'provider' | null;
    } | null
  ) => void;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  refreshToken: null,
  hydrated: false,
  user: null,
  setTokens: async ({ token, refreshToken }) => {
    await SecureStore.setItemAsync('authToken', token);
    if (refreshToken) {
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    }
    set({ token, refreshToken: refreshToken ?? null });
  },
  setUser: (user) => set({ user }),
  clear: async () => {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await clearProfileCache();
    set({ token: null, refreshToken: null, user: null });
  },
  hydrate: async () => {
    const [token, refreshToken] = await Promise.all([
      SecureStore.getItemAsync('authToken'),
      SecureStore.getItemAsync('refreshToken'),
    ]);
    set({ token, refreshToken, hydrated: true });
  },
}));
