import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import pt from '../locales/pt.json';

const LANGUAGE_STORAGE_KEY = 'app_language_v1';

const resources = {
  en: { translation: en },
  pt: { translation: pt },
} as const;

export type SupportedLanguage = keyof typeof resources;

export function normalizeLanguage(input?: string | null): SupportedLanguage {
  const value = String(input || '').toLowerCase();
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('pt')) return 'pt';
  return 'pt';
}

const deviceLanguage = normalizeLanguage(Localization.getLocales()?.[0]?.languageCode);

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: 'pt',
  compatibilityJSON: 'v4',
  interpolation: {
    escapeValue: false,
  },
});

export async function bootstrapLanguage() {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!stored) return;
    const normalized = normalizeLanguage(stored);
    if (normalized !== i18n.language) {
      await i18n.changeLanguage(normalized);
    }
  } catch {
  }
}

export async function setAppLanguage(language: string) {
  const normalized = normalizeLanguage(language);
  await i18n.changeLanguage(normalized);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
  }
  return normalized;
}

export function getDateLocale(language = i18n.language) {
  return normalizeLanguage(language) === 'pt' ? 'pt-PT' : 'en-US';
}

export default i18n;
