import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNT_CACHE_KEY = 'active_account_v1';

type AccountState = {
  activeAccountId: string | null;
  activeAccountName: string | null;
  setActiveAccount: (id: string | null, name?: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAccountStore = create<AccountState>()((set) => ({
  activeAccountId: null,
  activeAccountName: null,
    setActiveAccount: async (id: string | null, name?: string | null) => {
      try {
        if (id) {
          await AsyncStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify({ id, name: name ?? null }));
        } else {
          await AsyncStorage.removeItem(ACCOUNT_CACHE_KEY);
        }
      } catch (err) {
      }
      set({ activeAccountId: id, activeAccountName: name ?? null });
    },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNT_CACHE_KEY);
      if (!raw) {
        set({ activeAccountId: null, activeAccountName: null });
        return;
      }
      const parsed = JSON.parse(raw || '{}');
      set({ activeAccountId: parsed.id ?? null, activeAccountName: parsed.name ?? null });
    } catch (err) {
      set({ activeAccountId: null, activeAccountName: null });
    }
  },
}));

export default useAccountStore;
