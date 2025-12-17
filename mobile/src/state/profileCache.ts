import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedProfile = {
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

const PROFILE_CACHE_KEY = 'profile_cache_v1';

export async function readProfileCache(): Promise<CachedProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedProfile;
  } catch {
    return null;
  }
}

export async function writeProfileCache(data: CachedProfile) {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore cache write errors
  }
}

export async function clearProfileCache() {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
}
