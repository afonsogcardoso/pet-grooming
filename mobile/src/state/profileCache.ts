import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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

function resolveProfileCacheVersionTag() {
  const appVersion =
    Constants.nativeAppVersion ||
    Constants.expoConfig?.version ||
    Constants.manifest?.version ||
    // @ts-expect-error manifest2 is undocumented but present on some builds
    Constants.manifest2?.version ||
    // @ts-expect-error manifestExtra is new on SDK 54+
    Constants.manifestExtra?.version ||
    null;
  const buildVersion =
    Constants.nativeBuildVersion ||
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode ||
    null;
  const tag = [appVersion, buildVersion].filter(Boolean).join('-');
  return tag || null;
}

const PROFILE_CACHE_KEY = (() => {
  const tag = resolveProfileCacheVersionTag();
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
