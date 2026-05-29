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
import {
  getDevMode,
  setDevMode,
  subscribeDevMode,
  isDevModeAvailable,
  type DevModeState,
} from '@/lib/devMode';
import { useToast } from '@/components/Toast';
import { resolveApiUrl } from '@/lib/apiUrl';
import apiService from '@/services/api';
import telemetry from '@/lib/telemetry';
import type { Bill } from '@/types';

// Build a CSV body from a list of bills. Quoting wraps every field so commas
// in things like landlord names don't break parsing.
function buildBillsCsv(bills: Bill[]): string {
  const headers = [
    'period',
    'meterReading',
    'previousReading',
    'electricityUsage',
    'electricityRate',
    'electricityCost',
    'rent',
    'totalAmount',
    'paidAt',
    'createdAt',
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(',')];
  for (const b of bills) {
    lines.push([
      escape(b.period),
      escape(b.meterReading),
      escape(b.previousReading),
      escape(b.electricityUsage),
      escape(b.electricityRate),
      escape(b.electricityCost),
      escape(b.rent),
      escape(b.totalAmount),
      escape(b.paidAt ?? ''),
      escape(b.createdAt ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}

// System default settings
const SYSTEM_DEFAULT_SETTINGS: UserSettings = {
  defaultElectricityRate: 4.5,
  defaultRent: 8000,
  previousMeterReading: 0,
  landlordName: '',
  paymentMethod: 'bank_transfer',
};

const DEFAULT_NOTIFICATIONS = true;
const DEFAULT_AUTO_BACKUP = false;
const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-TW';

export default function SettingsScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { isDarkColorScheme } = useColorScheme();
  const { t, changeLanguage, currentLanguage } = useTranslation();
  const { showToast } = useToast();
  const devModeAvailable = isDevModeAvailable();
  const [devModeState, setDevModeStateLocal] = useState<DevModeState>(getDevMode());
  
  const [settings, setSettings] = useState<UserSettings>({
    defaultElectricityRate: 4.5,
    defaultRent: 8000,
    previousMeterReading: 0,
    landlordName: '',
    paymentMethod: t('paymentMethods.bankTransfer'),
  });
  
  // Independent string state for the electricity rate
  const [electricityRateText, setElectricityRateText] = useState('4.5');

  // Language settings state
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

  // Use a ref to keep the latest state, used when leaving the page
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

  // Sync the ref with the latest state
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

  // Compute whether there are unsaved changes (using the supplied state or the current state)
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

  // useEffect for first page load
  useEffect(() => {
    console.log('settings page loaded');
    loadSettings(true); // Force reload on first load
  }, []);

  // Subscribe to dev-mode changes so other parts of the app can update state too
  useEffect(() => {
    if (!devModeAvailable) return;
    const unsubscribe = subscribeDevMode(setDevModeStateLocal);
    return unsubscribe;
  }, [devModeAvailable]);

  // useFocusEffect for focus / blur handling
  useFocusEffect(
    React.useCallback(() => {
      console.log('settings page focused');
      setIsLeavingPage(false); // Reset the leaving flag

      // Scroll to top
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);

      // Cleanup runs when the page loses focus (about to switch to another tab)
      return () => {
        console.log('settings page about to lose focus, checking changes...');

        // Mark as leaving
        setIsLeavingPage(true);

        // Immediately check whether there are unsaved changes
        const currentState = latestStateRef.current;
        const currentHasChanges = getCurrentHasChanges(currentState);

        console.log('immediate blur state check:', {
          currentHasChanges,
          isCheckingUnsavedChanges: currentState.isCheckingUnsavedChanges,
          isLeavingPage: currentState.isLeavingPage
        });

        if (currentHasChanges && !currentState.isCheckingUnsavedChanges) {
          // Show the warning immediately, no delay
          console.log('showing leave-page warning');
          showLeavePageWarning();
        }
      };
    }, []) // Empty dependency array to avoid re-registering
  );

  // Function that displays the leave-page warning
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
            console.log('user chose to discard changes');
            setIsCheckingUnsavedChanges(false);
            setIsLeavingPage(false);
            // Restore to the last saved state instead of reloading
            await restoreToLastSavedState();
          },
        },
        {
          text: t('settings.saveAndLeave'),
          onPress: async () => {
            console.log('user chose to save and leave');
            setIsCheckingUnsavedChanges(true);
            try {
              // Use the shared save logic
              await performSave();

              console.log('save succeeded, language change applied, leaving allowed');
              setIsLeavingPage(false);
              // After a successful save no special handling is needed; the user is already on another page
            } catch (error) {
              console.error('save settings failed:', error);
              setIsCheckingUnsavedChanges(false);
              setIsLeavingPage(false);
              Alert.alert(
                t('common.error'), 
                t('settings.cannotSaveSettings'),
                [
                  {
                    text: t('common.confirm'),
                    onPress: () => {
                      // On save failure, force the user back to the settings page
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
          // If the dialog is dismissed unexpectedly, reset the state
          setIsCheckingUnsavedChanges(false);
          setIsLeavingPage(false);
        }
      }
    );
  };

  // Restore to the last saved state, or refetch from the backend
  const restoreToLastSavedState = async () => {
    console.log('starting to restore settings...');
    console.log('current settings:', {
      settings,
      electricityRateText,
      selectedLanguage,
      notificationsEnabled,
      autoBackup,
      initialSettings: initialSettings
    });
    
    try {
      // Prefer fetching the freshest saved settings from the backend
      console.log('refetching latest saved settings from backend...');
      const latestSavedSettings = await settingsService.getSettings();
      console.log('latest saved settings from backend:', latestSavedSettings);

      // Restore to whatever the backend returned
      setSettings({...latestSavedSettings});
      setElectricityRateText(latestSavedSettings.defaultElectricityRate.toString());
      setInitialSettings({...latestSavedSettings});

      // Restore the language setting
      setSelectedLanguage(initialLanguage);

      // Restore notification and backup settings
      if (initialNotifications !== null && initialAutoBackup !== null) {
        setNotificationsEnabled(initialNotifications);
        setAutoBackup(initialAutoBackup);
        console.log('restored previous notification settings:', { initialNotifications, initialAutoBackup });
      } else {
        // No initial notification settings; fall back to defaults
        setNotificationsEnabled(DEFAULT_NOTIFICATIONS);
        setAutoBackup(DEFAULT_AUTO_BACKUP);
        setInitialNotifications(DEFAULT_NOTIFICATIONS);
        setInitialAutoBackup(DEFAULT_AUTO_BACKUP);
        console.log('using default notification settings');
      }

      console.log('restored to the latest backend-saved state');

    } catch (error) {
      console.error('failed to fetch settings from backend, falling back to local initial settings:', error);

      // If the API failed, try the local initial settings
      if (initialSettings) {
        console.log('using local initial settings:', initialSettings);

        setSettings({...initialSettings});
        setElectricityRateText(initialSettings.defaultElectricityRate.toString());
        setSelectedLanguage(initialLanguage);
        setNotificationsEnabled(initialNotifications);
        setAutoBackup(initialAutoBackup);

        console.log('restored to local initial settings');
      } else {
        // Last resort: use the system defaults
        console.log('no local initial settings; using system defaults:', SYSTEM_DEFAULT_SETTINGS);

        setSettings({...SYSTEM_DEFAULT_SETTINGS});
        setElectricityRateText(SYSTEM_DEFAULT_SETTINGS.defaultElectricityRate.toString());
        setSelectedLanguage(DEFAULT_LANGUAGE);
        setNotificationsEnabled(DEFAULT_NOTIFICATIONS);
        setAutoBackup(DEFAULT_AUTO_BACKUP);
        setInitialSettings({...SYSTEM_DEFAULT_SETTINGS});
        setInitialNotifications(DEFAULT_NOTIFICATIONS);
        setInitialAutoBackup(DEFAULT_AUTO_BACKUP);
        setInitialLanguage(DEFAULT_LANGUAGE);

        console.log('restored to system defaults');
      }
    }

    setHasChanges(false);
    setIsCheckingUnsavedChanges(false);
    setShouldReloadSettings(false); // Prevent settings from being reloaded the next time the page focuses

    console.log('restore complete; reload-on-focus disabled');
  };

  const loadSettings = async (forceReload: boolean = false) => {
    if (!shouldReloadSettings && !forceReload) {
      console.log('skipping settings reload to keep the restored state');
      return;
    }

    try {
      const loadedSettings = await settingsService.getSettings();
      console.log('loaded settings:', loadedSettings);

      setSettings(loadedSettings);
      setElectricityRateText(loadedSettings.defaultElectricityRate.toString());
      setInitialSettings({...loadedSettings});

      // Initialise the language
      setSelectedLanguage(currentLanguage);
      setInitialLanguage(currentLanguage);

      // Important: capture the current notification/backup settings as initial values after loading
      setInitialNotifications(notificationsEnabled);
      setInitialAutoBackup(autoBackup);
      setHasChanges(false);
      setIsCheckingUnsavedChanges(false);
      setShouldReloadSettings(true); // Allow reloading on subsequent focuses

      console.log('initial state set:', {
        loadedSettings,
        currentLanguage,
        notificationsEnabled,
        autoBackup
      });

      // Reset scroll position
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    } catch (error) {
      console.error(t('settings.loadSettingsFailed'), error);
    }
  };

  // Watch for setting changes
  useEffect(() => {
    if (initialSettings && !isCheckingUnsavedChanges) {
      const currentHasChanges = getCurrentHasChanges();
      console.log('settings changed:', {
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

  // Shared save logic
  const performSave = async (stateToSave?: typeof latestStateRef.current) => {
    const currentState = stateToSave || latestStateRef.current;

    // Build the settings object to save
    const finalSettings = {
      ...currentState.settings,
      defaultElectricityRate: parseFloat(currentState.electricityRateText) || 0
    };

    console.log('saving settings:', finalSettings);
    console.log('about to change language to:', currentState.selectedLanguage);

    // Save settings to the backend
    await settingsService.saveSettings(finalSettings);

    // If the language changed, apply it
    if (currentState.selectedLanguage !== currentState.initialLanguage) {
      console.log('applying language change:', currentState.selectedLanguage);
      await changeLanguage(currentState.selectedLanguage);
      setInitialLanguage(currentState.selectedLanguage);
      console.log('language change complete; current language:', getCurrentLanguage());
    }

    // Verify what was saved and use the actual stored values as the new initial settings
    const savedSettings = await settingsService.getSettings();
    console.log('verified post-save settings:', savedSettings);

    // Use the actual stored values returned from the API instead of the local finalSettings
    setSettings(savedSettings);
    setElectricityRateText(savedSettings.defaultElectricityRate.toString());
    setInitialSettings({...savedSettings});

    // Also update the current notification / backup settings as the new initial values
    setInitialNotifications(currentState.notificationsEnabled);
    setInitialAutoBackup(currentState.autoBackup);
    setHasChanges(false);
    setIsCheckingUnsavedChanges(false);

    console.log('updated initial settings to:', savedSettings);
    console.log('initial notification/backup settings:', {
      notificationsEnabled: currentState.notificationsEnabled,
      autoBackup: currentState.autoBackup
    });
    console.log('initial language setting:', currentState.selectedLanguage);

    return true; // Save succeeded
  };

  const saveSettings = async (showSuccessAlert: boolean = true) => {
    try {
      await performSave();
      
      if (showSuccessAlert) {
        showToast({ kind: 'success', message: t('settings.settingsSaved') });
      }
    } catch (error) {
      console.error(t('settings.saveSettingsFailed'), error);
      Alert.alert(t('common.error'), t('settings.cannotSaveSettings'));
      throw error; // Re-throw so the caller can handle it
    }
  };

  // Handle electricity rate input
  const handleElectricityRateChange = (value: string) => {
    console.log('electricity rate input changed:', value);
    // Allow empty string, digits and decimal points; do not parse to number yet
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setElectricityRateText(value);
    }
  };

  // Handle electricity rate blur - update in-memory state only, do NOT save to AsyncStorage
  const handleElectricityRateBlur = () => {
    const numValue = parseFloat(electricityRateText) || 0;
    console.log('electricity rate blurred; updating in-memory state:', numValue);
    setSettings({ ...settings, defaultElectricityRate: numValue });
    // If the input was empty / invalid, reset to 0
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
          onPress: async () => {
            try {
              const bills = await apiService.getBills();
              if (bills.length === 0) {
                Alert.alert(t('common.error'), t('export.csvNoBills'));
                return;
              }
              const csv = buildBillsCsv(bills);
              // Plain-text share works on all platforms without extra native deps;
              // recipients can paste into a spreadsheet. File-based sharing
              // (expo-sharing + expo-file-system) is a future upgrade.
              const { Share } = await import('react-native');
              await Share.share({
                message: csv,
                title: t('export.csvDialogTitle'),
              });
              showToast({ kind: 'success', message: t('settings.dataExported') });
            } catch (err) {
              telemetry.captureException(err, { scope: 'settings.exportCsv' });
              Alert.alert(t('common.error'), t('export.csvFailed'));
            }
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
            // TODO: implement clear-all-data
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

          {/* Default values section */}
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

          {/* Data management */}
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
          
          {/* Language settings */}
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

          {/* Developer mode (debug builds only) */}
          {devModeAvailable && (
            <View className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-2xl p-5 mb-5 shadow-sm">
              <View className="flex-row items-center mb-1">
                <Ionicons name="flask-outline" size={20} color={isDarkColorScheme ? '#FBBF24' : '#B45309'} />
                <Text className="text-lg font-semibold text-amber-900 dark:text-amber-100 ml-2">
                  {t('dev.title')}
                </Text>
              </View>
              <Text className="text-xs text-amber-800 dark:text-amber-200 mb-4">
                {t('dev.subtitle')}
              </Text>

              <View className="flex-row items-center justify-between py-2">
                <View className="flex-1 pr-3">
                  <Text className="text-base text-gray-900 dark:text-gray-100">
                    {t('dev.skipOcr')}
                  </Text>
                  <Text className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {t('dev.skipOcrHint')}
                  </Text>
                </View>
                <Switch
                  value={devModeState.skipOcr}
                  onValueChange={(v) => setDevMode({ skipOcr: v })}
                  trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View className="flex-row items-center justify-between py-2">
                <View className="flex-1 pr-3">
                  <Text className="text-base text-gray-900 dark:text-gray-100">
                    {t('dev.forceMockHistory')}
                  </Text>
                  <Text className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {t('dev.forceMockHistoryHint')}
                  </Text>
                </View>
                <Switch
                  value={devModeState.forceMockHistory}
                  onValueChange={(v) => setDevMode({ forceMockHistory: v })}
                  trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View className="mt-3">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('dev.apiUrlOverride')}
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={devModeState.apiUrlOverride}
                  onChangeText={(v) => setDevMode({ apiUrlOverride: v.trim() })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder={t('dev.apiUrlPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                />
                <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t('dev.apiUrlHint')}
                </Text>
                <Text className="text-xs text-amber-800 dark:text-amber-200 mt-2" numberOfLines={2}>
                  {t('dev.currentApiUrl', { url: resolveApiUrl() })}
                </Text>
              </View>
            </View>
          )}

          {/* Save and reset buttons */}
          <View className="mt-8 px-4">
            <View className="flex-row">
              {/* Reset button */}
              <TouchableOpacity
                className={`flex-1 mr-4 rounded-xl py-4 px-6 border-2 shadow-md ${
                  hasChanges 
                    ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-gray-200 dark:shadow-gray-900' 
                    : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-60'
                }`}
                onPress={async () => {
                  console.log('reset button pressed');
                  await restoreToLastSavedState();
                }}
                disabled={!hasChanges}
                style={{
                  shadowColor: '#000',
                  shadowOffset: {
                    width: 0,
                    height: 2,
                  },
                  shadowOpacity: 0.1,
                  shadowRadius: 3.84,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons 
                    name="refresh-outline" 
                    size={20} 
                    color={hasChanges ? (isDarkColorScheme ? '#D1D5DB' : '#374151') : '#9CA3AF'} 
                  />
                  <Text className={`ml-2 text-center text-lg font-semibold ${
                    hasChanges 
                      ? 'text-gray-700 dark:text-gray-300' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {t('common.reset')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Save button */}
              <TouchableOpacity
                className={`flex-1 ml-4 rounded-xl py-4 px-6 border-2 shadow-lg ${
                  hasChanges 
                    ? 'bg-blue-500 dark:bg-blue-600 border-blue-500 dark:border-blue-600 shadow-blue-200 dark:shadow-blue-900' 
                    : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-60'
                }`}
                onPress={() => saveSettings(true)}
                disabled={!hasChanges}
                style={{
                  shadowColor: hasChanges ? '#3B82F6' : '#000',
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                  shadowOpacity: hasChanges ? 0.3 : 0.1,
                  shadowRadius: 4.65,
                  elevation: 6,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons 
                    name="checkmark-circle-outline" 
                    size={20} 
                    color={hasChanges ? '#FFFFFF' : '#9CA3AF'} 
                  />
                  <Text className={`ml-2 text-center text-lg font-semibold ${
                    hasChanges 
                      ? 'text-white' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {t('settings.saveSettings')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Version info */}
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