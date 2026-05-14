import { useTranslation as useI18nTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, type SupportedLanguage } from '../lib/i18n';
import { useEffect, useState } from 'react';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();
  const [, forceUpdate] = useState({});

  const changeAppLanguage = async (language: SupportedLanguage) => {
    await changeLanguage(language);
    // Force every component using useTranslation to re-render
    forceUpdate({});
  };

  // Subscribe to language change events
  useEffect(() => {
    const handleLanguageChange = () => {
      forceUpdate({});
    };

    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const currentLanguage = getCurrentLanguage();

  return {
    t,
    changeLanguage: changeAppLanguage,
    currentLanguage,
    isReady: i18n.isInitialized,
  };
}; 