import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type ViewMode = 'consumer' | 'private';

type ViewModeState = {
  viewMode: ViewMode | null;
  hydrated: boolean;
  setViewMode: (mode: ViewMode | null) => void;
  hydrate: () => Promise<void>;
  clear: () => Promise<void>;
};

const VIEW_MODE_KEY = 'view_mode_v1';

export const useViewModeStore = create<ViewModeState>()((set) => ({
  viewMode: null,
  hydrated: false,
  setViewMode: (mode) => {
    set({ viewMode: mode });
    if (mode) {
      AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => null);
    } else {
      AsyncStorage.removeItem(VIEW_MODE_KEY).catch(() => null);
    }
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(VIEW_MODE_KEY);
      const normalized = stored === 'consumer' || stored === 'private' ? stored : null;
      set({ viewMode: normalized, hydrated: true });
    } catch {
      set({ viewMode: null, hydrated: true });
    }
  },
  clear: async () => {
    try {
      await AsyncStorage.removeItem(VIEW_MODE_KEY);
    } finally {
      set({ viewMode: null });
    }
  },
}));
