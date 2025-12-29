import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveVersionTag } from '../utils/version';

export type CachedProfile = {
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  activeRole?: 'consumer' | 'provider' | null;
  availableRoles?: Array<'consumer' | 'provider'>;
};

const PROFILE_CACHE_BASE_KEY = 'profile_cache_v2';

const PROFILE_CACHE_KEY = (() => {
  const tag = resolveVersionTag();
  return tag ? `${PROFILE_CACHE_BASE_KEY}:${tag}` : PROFILE_CACHE_BASE_KEY;
})();

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
    const keys =
      PROFILE_CACHE_KEY === PROFILE_CACHE_BASE_KEY
        ? [PROFILE_CACHE_BASE_KEY]
        : [PROFILE_CACHE_BASE_KEY, PROFILE_CACHE_KEY];
    await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }
}
