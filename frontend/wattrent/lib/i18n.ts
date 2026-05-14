import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import language resources
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';

const LANGUAGE_STORAGE_KEY = 'user_language';

// Supported languages
export const SUPPORTED_LANGUAGES = ['zh-TW', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Language resources
const resources = {
  'zh-TW': {
    translation: zhTW,
  },
  en: {
    translation: en,
  },
};

// Detect the system language and map it to a supported language.
const getSystemLanguage = (): SupportedLanguage => {
  const systemLocale = Localization.getLocales()[0];
  const systemLanguage = systemLocale?.languageTag || 'en';

  // Exact match against the supported list
  if (SUPPORTED_LANGUAGES.includes(systemLanguage as SupportedLanguage)) {
    return systemLanguage as SupportedLanguage;
  }

  // Match by language code only (drop the region)
  const languageCode = systemLanguage.split('-')[0];
  if (languageCode === 'zh') {
    return 'zh-TW';
  }

  // Default to English
  return 'en';
};

// Read the persisted language from AsyncStorage.
const getStoredLanguage = async (): Promise<SupportedLanguage | null> => {
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as SupportedLanguage)) {
      return storedLanguage as SupportedLanguage;
    }
  } catch (error) {
    console.warn('Failed to get stored language:', error);
  }
  return null;
};

// Persist the language to AsyncStorage.
export const setStoredLanguage = async (language: SupportedLanguage): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to store language:', error);
  }
};

// Initialise i18n.
const initI18n = async () => {
  const storedLanguage = await getStoredLanguage();
  const systemLanguage = getSystemLanguage();
  const initialLanguage = storedLanguage || systemLanguage;

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
      debug: __DEV__,
      
      interpolation: {
        escapeValue: false, // React Native already handles escaping safely
      },

      react: {
        useSuspense: false, // Avoid React Suspense in React Native
      },
    });

  return initialLanguage;
};

// Switch language.
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
  await setStoredLanguage(language);
};

// Get the current language.
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage;
};

// Get the system language (for display purposes).
export const getSystemLanguageForDisplay = (): SupportedLanguage => {
  return getSystemLanguage();
};

export { initI18n };
export default i18n; 