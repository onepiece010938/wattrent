import { useTranslation as useI18nTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, type SupportedLanguage } from '../lib/i18n';
import { useEffect, useState } from 'react';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();
  const [, forceUpdate] = useState({});

  const changeAppLanguage = async (language: SupportedLanguage) => {
    await changeLanguage(language);
    // 強制重新渲染所有使用 useTranslation 的組件
    forceUpdate({});
  };

  // 監聽語言變更事件
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