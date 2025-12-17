import AsyncStorage from '@react-native-async-storage/async-storage';
import { Branding } from '../api/branding';

const BRANDING_CACHE_KEY = 'branding_cache_v1';

export async function readBrandingCache(): Promise<Branding | null> {
  try {
    const raw = await AsyncStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Branding;
  } catch (err) {
    console.warn('Falha ao ler cache de branding:', err);
    return null;
  }
}

export async function writeBrandingCache(data?: Branding | null) {
  if (!data) return;
  try {
    await AsyncStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Falha ao gravar cache de branding:', err);
  }
}

export async function clearBrandingCache() {
  try {
    await AsyncStorage.removeItem(BRANDING_CACHE_KEY);
  } catch {
    // ignore
  }
}
