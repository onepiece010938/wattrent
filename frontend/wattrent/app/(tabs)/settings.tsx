import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { UserSettings } from '@/types';
import Dropdown from '@/components/Dropdown';
import settingsService from '@/services/settings';
import { useColorScheme } from '~/lib/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, getCurrentLanguage } from '@/lib/i18n';

// 系統預設值定義
const SYSTEM_DEFAULT_SETTINGS: UserSettings = {
  userId: 'user1',
  defaultElectricityRate: 4.5,
  defaultRent: 8000,
  previousMeterReading: 0,
  landlordName: '',
  paymentMethod: '銀行轉帳',
};

const DEFAULT_NOTIFICATIONS = true;
const DEFAULT_AUTO_BACKUP = false;
const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-TW';

export default function SettingsScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { isDarkColorScheme } = useColorScheme();
  const { t, changeLanguage, currentLanguage } = useTranslation();
  
  const [settings, setSettings] = useState<UserSettings>({
    userId: 'user1',
    defaultElectricityRate: 4.5,
    defaultRent: 8000,
    previousMeterReading: 0,
    landlordName: '',
    paymentMethod: t('paymentMethods.bankTransfer'),
  });
  
  // 為電費單價建立獨立的字串狀態
  const [electricityRateText, setElectricityRateText] = useState('4.5');
  
  // 語言設定狀態
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(currentLanguage);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialSettings, setInitialSettings] = useState<UserSettings | null>(null);
  const [initialNotifications, setInitialNotifications] = useState(true);
  const [initialAutoBackup, setInitialAutoBackup] = useState(false);
  const [initialLanguage, setInitialLanguage] = useState<SupportedLanguage>(currentLanguage);
  const [isCheckingUnsavedChanges, setIsCheckingUnsavedChanges] = useState(false);
  const [shouldReloadSettings, setShouldReloadSettings] = useState(true);
  const [isLeavingPage, setIsLeavingPage] = useState(false);

  // 使用 ref 來存儲最新狀態，供離開頁面時檢查使用
  const latestStateRef = useRef({
    settings,
    electricityRateText,
    selectedLanguage,
    notificationsEnabled,
    autoBackup,
    initialSettings,
    initialNotifications,
    initialAutoBackup,
    initialLanguage,
    isCheckingUnsavedChanges,
    isLeavingPage
  });

  // 更新 ref 中的狀態
  useEffect(() => {
    latestStateRef.current = {
      settings,
      electricityRateText,
      selectedLanguage,
      notificationsEnabled,
      autoBackup,
      initialSettings,
      initialNotifications,
      initialAutoBackup,
      initialLanguage,
      isCheckingUnsavedChanges,
      isLeavingPage
    };
  }, [settings, electricityRateText, selectedLanguage, notificationsEnabled, autoBackup, initialSettings, initialNotifications, initialAutoBackup, initialLanguage, isCheckingUnsavedChanges, isLeavingPage]);

  const paymentMethods = [
    { label: t('paymentMethods.bankTransfer'), value: t('paymentMethods.bankTransfer') },
    { label: t('paymentMethods.cash'), value: t('paymentMethods.cash') },
    { label: t('paymentMethods.linePay'), value: t('paymentMethods.linePay') },
    { label: t('paymentMethods.jkoPay'), value: t('paymentMethods.jkoPay') },
    { label: t('paymentMethods.other'), value: t('paymentMethods.other') },
  ];

  const languageOptions = [
    { label: t('languages.zh-TW'), value: 'zh-TW' as SupportedLanguage },
    { label: t('languages.en'), value: 'en' as SupportedLanguage },
  ];

  // 獲取當前是否有變更（使用傳入的狀態或當前狀態）
  const getCurrentHasChanges = (stateToCheck?: typeof latestStateRef.current) => {
    const state = stateToCheck || latestStateRef.current;
    if (!state.initialSettings) return false;
    
    const currentElectricityRate = parseFloat(state.electricityRateText) || 0;
    const hasChanges = state.settings.defaultRent !== state.initialSettings.defaultRent ||
           state.settings.previousMeterReading !== state.initialSettings.previousMeterReading ||
           state.settings.landlordName !== state.initialSettings.landlordName ||
           state.settings.paymentMethod !== state.initialSettings.paymentMethod ||
           currentElectricityRate !== state.initialSettings.defaultElectricityRate ||
           state.selectedLanguage !== state.initialLanguage ||
           state.notificationsEnabled !== state.initialNotifications ||
           state.autoBackup !== state.initialAutoBackup;
    
    return hasChanges;
  };

  // 使用 useEffect 來處理頁面載入
  useEffect(() => {
    console.log('設定頁面載入');
    loadSettings(true); // 首次載入時強制重新載入
  }, []);

  // 使用 useFocusEffect 來處理頁面聚焦和失焦
  useFocusEffect(
    React.useCallback(() => {
      console.log('設定頁面聚焦');
      setIsLeavingPage(false); // 重置離開狀態
      
      // 滾動到頂部
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);

      // 返回清理函數，在頁面失去焦點時執行（即將切換到其他tab）
      return () => {
        console.log('設定頁面即將失去焦點，檢查變更...');
        
        // 設置離開狀態
        setIsLeavingPage(true);
        
        // 立即檢查是否有未儲存變更
        const currentState = latestStateRef.current;
        const currentHasChanges = getCurrentHasChanges(currentState);
        
        console.log('立即檢查失焦狀態:', {
          currentHasChanges,
          isCheckingUnsavedChanges: currentState.isCheckingUnsavedChanges,
          isLeavingPage: currentState.isLeavingPage
        });
        
        if (currentHasChanges && !currentState.isCheckingUnsavedChanges) {
          // 立即顯示警告，不使用延遲
          console.log('立即顯示離開頁面警告');
          showLeavePageWarning();
        }
      };
    }, []) // 空依賴陣列避免重複註冊
  );

  // 顯示離開頁面警告的函數
  const showLeavePageWarning = () => {
    setIsCheckingUnsavedChanges(true);
    
    Alert.alert(
      t('settings.unsavedChangesTitle'),
      t('settings.unsavedChangesMessage'),
      [
        {
          text: t('settings.discardChanges'),
          style: 'destructive',
          onPress: async () => {
            console.log('用戶選擇放棄變更');
            setIsCheckingUnsavedChanges(false);
            setIsLeavingPage(false);
            // 恢復到上次儲存的狀態，而不是重新載入
            await restoreToLastSavedState();
          },
        },
        {
          text: t('settings.saveAndLeave'),
          onPress: async () => {
            console.log('用戶選擇儲存並離開');
            setIsCheckingUnsavedChanges(true);
            try {
              // 使用共用的儲存邏輯
              await performSave();
              
              console.log('儲存成功，語言變更已生效，允許離開');
              setIsLeavingPage(false);
              // 儲存成功後不需要特別處理，用戶已經在其他頁面了
            } catch (error) {
              console.error('儲存設定失敗:', error);
              setIsCheckingUnsavedChanges(false);
              setIsLeavingPage(false);
              Alert.alert(
                t('common.error'), 
                t('settings.cannotSaveSettings'),
                [
                  {
                    text: t('common.confirm'),
                    onPress: () => {
                      // 儲存失敗時強制回到設定頁面
                      router.replace('/(tabs)/settings');
                    }
                  }
                ]
              );
            }
          },
        },
      ],
      { 
        cancelable: false,
        onDismiss: () => {
          // 如果對話框被意外關閉，重置狀態
          setIsCheckingUnsavedChanges(false);
          setIsLeavingPage(false);
        }
      }
    );
  };

  // 恢復到上次儲存的狀態或從後端重新獲取
  const restoreToLastSavedState = async () => {
    console.log('開始恢復設定...');
    console.log('當前設定:', {
      settings,
      electricityRateText,
      selectedLanguage,
      notificationsEnabled,
      autoBackup,
      initialSettings: initialSettings
    });
    
    try {
      // 優先從後端重新獲取最新的儲存值
      console.log('從後端重新獲取最新的儲存設定...');
      const latestSavedSettings = await settingsService.getSettings();
      console.log('從後端獲取的最新儲存設定:', latestSavedSettings);
      
      // 恢復到從後端獲取的設定
      setSettings({...latestSavedSettings});
      setElectricityRateText(latestSavedSettings.defaultElectricityRate.toString());
      setInitialSettings({...latestSavedSettings});
      
      // 恢復語言設定
      setSelectedLanguage(initialLanguage);
      
      // 恢復通知和備份設定
      if (initialNotifications !== null && initialAutoBackup !== null) {
        setNotificationsEnabled(initialNotifications);
        setAutoBackup(initialAutoBackup);
        console.log('恢復到之前的通知設定:', { initialNotifications, initialAutoBackup });
      } else {
        // 如果沒有初始通知設定，使用預設值
        setNotificationsEnabled(DEFAULT_NOTIFICATIONS);
        setAutoBackup(DEFAULT_AUTO_BACKUP);
        setInitialNotifications(DEFAULT_NOTIFICATIONS);
        setInitialAutoBackup(DEFAULT_AUTO_BACKUP);
        console.log('使用預設通知設定');
      }
      
      console.log('已恢復到後端最新儲存的狀態');
      
    } catch (error) {
      console.error('從後端獲取設定失敗，嘗試使用本地初始設定:', error);
      
      // 如果API失敗，嘗試使用本地的初始設定
      if (initialSettings) {
        console.log('使用本地初始設定:', initialSettings);
        
        setSettings({...initialSettings});
        setElectricityRateText(initialSettings.defaultElectricityRate.toString());
        setSelectedLanguage(initialLanguage);
        setNotificationsEnabled(initialNotifications);
        setAutoBackup(initialAutoBackup);
        
        console.log('已恢復到本地初始設定');
      } else {
        // 最後手段：使用系統預設值
        console.log('沒有本地初始設定，使用系統預設值:', SYSTEM_DEFAULT_SETTINGS);
        
        setSettings({...SYSTEM_DEFAULT_SETTINGS});
        setElectricityRateText(SYSTEM_DEFAULT_SETTINGS.defaultElectricityRate.toString());
        setSelectedLanguage(DEFAULT_LANGUAGE);
        setNotificationsEnabled(DEFAULT_NOTIFICATIONS);
        setAutoBackup(DEFAULT_AUTO_BACKUP);
        setInitialSettings({...SYSTEM_DEFAULT_SETTINGS});
        setInitialNotifications(DEFAULT_NOTIFICATIONS);
        setInitialAutoBackup(DEFAULT_AUTO_BACKUP);
        setInitialLanguage(DEFAULT_LANGUAGE);
        
        console.log('已恢復到系統預設值');
      }
    }
    
    setHasChanges(false);
    setIsCheckingUnsavedChanges(false);
    setShouldReloadSettings(false); // 防止頁面重新聚焦時重新載入設定
    
    console.log('恢復完成，已設定為不重新載入設定');
  };

  const loadSettings = async (forceReload: boolean = false) => {
    if (!shouldReloadSettings && !forceReload) {
      console.log('跳過重新載入設定，保持當前恢復的狀態');
      return;
    }
    
    try {
      const loadedSettings = await settingsService.getSettings();
      console.log('載入的設定:', loadedSettings);
      
      setSettings(loadedSettings);
      setElectricityRateText(loadedSettings.defaultElectricityRate.toString());
      setInitialSettings({...loadedSettings});
      
      // 設定語言初始值
      setSelectedLanguage(currentLanguage);
      setInitialLanguage(currentLanguage);
      
      // 重要：在載入設定後，記錄當前的通知和備份設定作為初始值
      setInitialNotifications(notificationsEnabled);
      setInitialAutoBackup(autoBackup);
      setHasChanges(false);
      setIsCheckingUnsavedChanges(false);
      setShouldReloadSettings(true); // 設定載入後允許下次重新載入
      
      console.log('設定初始狀態:', {
        loadedSettings,
        currentLanguage,
        notificationsEnabled,
        autoBackup
      });
      
      // 重置滾動位置
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    } catch (error) {
      console.error(t('settings.loadSettingsFailed'), error);
    }
  };

  // 監聽設定變更
  useEffect(() => {
    if (initialSettings && !isCheckingUnsavedChanges) {
      const currentHasChanges = getCurrentHasChanges();
      console.log('監聽設定變更:', {
        currentHasChanges,
        hasChanges,
        currentSettings: settings,
        initialSettings,
        electricityRateText,
        selectedLanguage,
        initialLanguage
      });
      if (currentHasChanges !== hasChanges) {
        setHasChanges(currentHasChanges);
      }
    }
  }, [settings.defaultRent, settings.previousMeterReading, settings.landlordName, settings.paymentMethod, electricityRateText, selectedLanguage, notificationsEnabled, autoBackup]);

  // 共用的儲存邏輯
  const performSave = async (stateToSave?: typeof latestStateRef.current) => {
    const currentState = stateToSave || latestStateRef.current;
    
    // 構建要儲存的設定
    const finalSettings = {
      ...currentState.settings,
      defaultElectricityRate: parseFloat(currentState.electricityRateText) || 0
    };
    
    console.log('執行儲存設定:', finalSettings);
    console.log('準備變更語言到:', currentState.selectedLanguage);
    
    // 儲存設定到後端
    await settingsService.saveSettings(finalSettings);
    
    // 如果語言有變更，則應用語言變更
    if (currentState.selectedLanguage !== currentState.initialLanguage) {
      console.log('應用語言變更:', currentState.selectedLanguage);
      await changeLanguage(currentState.selectedLanguage);
      setInitialLanguage(currentState.selectedLanguage);
      console.log('語言變更完成，當前語言:', getCurrentLanguage());
    }
    
    // 驗證儲存並使用實際儲存的值作為新的初始設定
    const savedSettings = await settingsService.getSettings();
    console.log('驗證儲存後的設定:', savedSettings);
    
    // 使用從API返回的實際儲存值，而不是本地的finalSettings
    setSettings(savedSettings);
    setElectricityRateText(savedSettings.defaultElectricityRate.toString());
    setInitialSettings({...savedSettings});
    
    // 也要更新當前的通知和備份設定作為新的初始值
    setInitialNotifications(currentState.notificationsEnabled);
    setInitialAutoBackup(currentState.autoBackup);
    setHasChanges(false);
    setIsCheckingUnsavedChanges(false);
    
    console.log('已更新初始設定為:', savedSettings);
    console.log('通知和備份初始設定:', { 
      notificationsEnabled: currentState.notificationsEnabled, 
      autoBackup: currentState.autoBackup 
    });
    console.log('語言初始設定:', currentState.selectedLanguage);
    
    return true; // 儲存成功
  };

  const saveSettings = async (showSuccessAlert: boolean = true) => {
    try {
      await performSave();
      
      if (showSuccessAlert) {
        Alert.alert(t('common.success'), t('settings.settingsSaved'));
      }
    } catch (error) {
      console.error(t('settings.saveSettingsFailed'), error);
      Alert.alert(t('common.error'), t('settings.cannotSaveSettings'));
      throw error; // 重新拋出錯誤以便調用者處理
    }
  };

  // 處理電費單價輸入
  const handleElectricityRateChange = (value: string) => {
    console.log('電費單價輸入變更:', value);
    // 允許空字串、數字和小數點，但不立即轉換為數字
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setElectricityRateText(value);
    }
  };

  // 處理電費單價失去焦點 - 只更新內存中的狀態，不儲存到 AsyncStorage
  const handleElectricityRateBlur = () => {
    const numValue = parseFloat(electricityRateText) || 0;
    console.log('電費單價失去焦點，更新內存狀態:', numValue);
    setSettings({ ...settings, defaultElectricityRate: numValue });
    // 如果輸入的是空字串或無效值，重置為 0
    if (!electricityRateText || isNaN(parseFloat(electricityRateText))) {
      setElectricityRateText('0');
    }
  };

  const handleExport = () => {
    Alert.alert(
      t('settings.exportDataTitle'),
      t('settings.exportDataMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            // TODO: 實作資料匯出功能
            Alert.alert(t('common.success'), t('settings.dataExported'));
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      t('settings.clearDataTitle'),
      t('settings.clearDataMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            // TODO: 實作資料清除功能
            Alert.alert(t('common.success'), t('settings.allDataCleared'));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1" 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="p-5">
          <Text className="text-3xl font-bold text-foreground mb-6">
            {t('settings.title')}
          </Text>

          {/* 預設值設定 */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('settings.defaults')}
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.electricityRate')}
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={electricityRateText}
                  onChangeText={handleElectricityRateChange}
                  onBlur={handleElectricityRateBlur}
                  keyboardType="decimal-pad"
                  placeholder={t('placeholders.electricityRate')}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.rent')}
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.defaultRent.toString()}
                  onChangeText={(value) => 
                    setSettings({ ...settings, defaultRent: parseInt(value) || 0 })
                  }
                  keyboardType="numeric"
                  placeholder={t('placeholders.rent')}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.previousMeterReading')}
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.previousMeterReading.toString()}
                  onChangeText={(value) => 
                    setSettings({ ...settings, previousMeterReading: parseInt(value) || 0 })
                  }
                  keyboardType="numeric"
                  placeholder={t('placeholders.meterReading')}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.landlordName')}
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.landlordName}
                  onChangeText={(value) => 
                    setSettings({ ...settings, landlordName: value })
                  }
                  placeholder={t('placeholders.landlordName')}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.paymentMethod')}
                </Text>
                <Dropdown
                  value={settings.paymentMethod || ''}
                  onValueChange={(value) => 
                    setSettings({ ...settings, paymentMethod: value })
                  }
                  items={paymentMethods}
                  placeholder={t('settings.selectPaymentMethod')}
                />
              </View>
            </View>
          </View>

          {/* 通知設定 */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('settings.notifications')}
            </Text>
            
            <View className="space-y-4">
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-base text-gray-900 dark:text-gray-100">
                  {t('settings.paymentReminder')}
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#D1D5DB', true: '#0EA5E9' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View className="flex-row items-center justify-between py-2">
                <Text className="text-base text-gray-900 dark:text-gray-100">
                  {t('settings.autoBackup')}
                </Text>
                <Switch
                  value={autoBackup}
                  onValueChange={setAutoBackup}
                  trackColor={{ false: '#D1D5DB', true: '#0EA5E9' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* 資料管理 */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('settings.dataManagement')}
            </Text>
            
            <TouchableOpacity
              className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700"
              onPress={handleExport}
            >
              <View className="flex-row items-center">
                <Ionicons name="download-outline" size={24} color="#0EA5E9" />
                <Text className="text-base text-gray-900 dark:text-gray-100 ml-3">
                  {t('settings.exportData')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between py-4"
              onPress={handleClearData}
            >
              <View className="flex-row items-center">
                <Ionicons name="trash-outline" size={24} color="#EF4444" />
                <Text className="text-base text-red-600 dark:text-red-400 ml-3">
                  {t('settings.clearAllData')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          
          {/* 語言設定 */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('settings.language')}
            </Text>
            
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.selectLanguage')}
              </Text>
              <Dropdown
                value={selectedLanguage}
                onValueChange={(value) => setSelectedLanguage(value as SupportedLanguage)}
                items={languageOptions}
                placeholder={t('settings.selectLanguage')}
              />
            </View>
          </View>

          {/* 儲存和重置按鈕 */}
          <View className="flex-row space-x-4 mt-6">
            {/* 重置按鈕 */}
            <TouchableOpacity
              className={`flex-1 rounded-lg py-4 border-2 ${
                hasChanges 
                  ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' 
                  : 'bg-gray-300 dark:bg-gray-600 border-gray-300 dark:border-gray-600'
              }`}
              onPress={async () => {
                console.log('重置按鈕被點擊');
                await restoreToLastSavedState();
              }}
              disabled={!hasChanges}
            >
              <Text className={`text-center text-lg font-semibold ${
                hasChanges 
                  ? 'text-gray-700 dark:text-gray-300' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {t('common.reset')}
              </Text>
            </TouchableOpacity>

            {/* 儲存按鈕 */}
            <TouchableOpacity
              className={`flex-1 rounded-lg py-4 border-2 ${
                hasChanges 
                  ? 'bg-primary dark:bg-primary border-primary' 
                  : 'bg-gray-300 dark:bg-gray-600 border-gray-300 dark:border-gray-600'
              }`}
              onPress={() => saveSettings(true)}
              disabled={!hasChanges}
            >
              <Text className={`text-center text-lg font-semibold ${
                hasChanges 
                  ? 'text-primary-foreground' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {t('settings.saveSettings')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 版本資訊 */}
          <View className="items-center mt-8 mb-4">
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              {t('app.version')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}