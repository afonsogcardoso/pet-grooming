import AsyncStorage from '@react-native-async-storage/async-storage';
import { Branding } from '../api/branding';

const BRANDING_CACHE_KEY = 'branding_cache_v1';

export async function readBrandingCache(): Promise<Branding | null> {
  try {
    const raw = await AsyncStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return null;
    const branding = JSON.parse(raw) as Branding;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      try {
        const summary = {
          id: branding.id,
          account_id: branding.account_id,
          brand_primary: !!branding.brand_primary,
          logo: !!branding.logo_url,
        };
        // eslint-disable-next-line no-console
        console.debug('branding carregado da cache', summary);
      } catch (e) {
        // ignore logging errors
      }
    }
    return branding;
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
