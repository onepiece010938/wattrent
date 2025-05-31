import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 導入語言資源
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';

const LANGUAGE_STORAGE_KEY = 'user_language';

// 支援的語言列表
export const SUPPORTED_LANGUAGES = ['zh-TW', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// 語言資源
const resources = {
  'zh-TW': {
    translation: zhTW,
  },
  en: {
    translation: en,
  },
};

// 檢測系統語言並返回支援的語言
const getSystemLanguage = (): SupportedLanguage => {
  const systemLocale = Localization.getLocales()[0];
  const systemLanguage = systemLocale?.languageTag || 'en';
  
  // 檢查系統語言是否在支援列表中
  if (SUPPORTED_LANGUAGES.includes(systemLanguage as SupportedLanguage)) {
    return systemLanguage as SupportedLanguage;
  }
  
  // 檢查語言代碼（不包含地區）
  const languageCode = systemLanguage.split('-')[0];
  if (languageCode === 'zh') {
    return 'zh-TW';
  }
  
  // 預設使用英文
  return 'en';
};

// 從 AsyncStorage 獲取儲存的語言設定
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

// 儲存語言設定到 AsyncStorage
export const setStoredLanguage = async (language: SupportedLanguage): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to store language:', error);
  }
};

// 初始化 i18n
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
        escapeValue: false, // React Native 已經安全處理
      },
      
      react: {
        useSuspense: false, // 避免在 React Native 中使用 Suspense
      },
    });

  return initialLanguage;
};

// 變更語言
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
  await setStoredLanguage(language);
};

// 獲取當前語言
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage;
};

// 獲取系統語言（用於顯示）
export const getSystemLanguageForDisplay = (): SupportedLanguage => {
  return getSystemLanguage();
};

export { initI18n };
export default i18n; 