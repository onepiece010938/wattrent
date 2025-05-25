import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserSettings } from '@/types';
import Dropdown from '@/components/Dropdown';
import NetworkTest from '@/components/NetworkTest';
import settingsService from '@/services/settings';
import { useColorScheme } from '~/lib/useColorScheme';

export default function SettingsScreen() {
  const { isDarkColorScheme } = useColorScheme();
  const [settings, setSettings] = useState<UserSettings>({
    userId: 'user1',
    defaultElectricityRate: 4.5,
    defaultRent: 8000,
    previousMeterReading: 0,
    landlordName: '',
    paymentMethod: '銀行轉帳',
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);

  const paymentMethods = [
    { label: '銀行轉帳', value: '銀行轉帳' },
    { label: '現金', value: '現金' },
    { label: 'Line Pay', value: 'Line Pay' },
    { label: '街口支付', value: '街口支付' },
    { label: '其他', value: '其他' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await settingsService.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await settingsService.saveSettings(settings);
      Alert.alert('成功', '設定已儲存');
    } catch (error) {
      console.error('儲存設定失敗:', error);
      Alert.alert('錯誤', '無法儲存設定');
    }
  };

  const handleExport = () => {
    Alert.alert(
      '匯出資料',
      '確定要匯出所有帳單記錄嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定',
          onPress: () => {
            // TODO: 實作資料匯出功能
            Alert.alert('成功', '資料已匯出');
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      '清除資料',
      '確定要清除所有資料嗎？此操作無法復原。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定',
          style: 'destructive',
          onPress: () => {
            // TODO: 實作資料清除功能
            Alert.alert('成功', '所有資料已清除');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-5">
          <Text className="text-3xl font-bold text-foreground mb-6">
            設定
          </Text>

          {/* 預設值設定 */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              預設值
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  電費單價 (元/度)
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.defaultElectricityRate.toString()}
                  onChangeText={(value) => 
                    setSettings({ ...settings, defaultElectricityRate: parseFloat(value) || 0 })
                  }
                  keyboardType="decimal-pad"
                  placeholder="4.5"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  房租 (元)
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.defaultRent.toString()}
                  onChangeText={(value) => 
                    setSettings({ ...settings, defaultRent: parseInt(value) || 0 })
                  }
                  keyboardType="numeric"
                  placeholder="8000"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  前次(月)電表度數 (初始電表度數)
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.previousMeterReading.toString()}
                  onChangeText={(value) => 
                    setSettings({ ...settings, previousMeterReading: parseInt(value) || 0 })
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  房東名稱
                </Text>
                <TextInput
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  value={settings.landlordName}
                  onChangeText={(value) => 
                    setSettings({ ...settings, landlordName: value })
                  }
                  placeholder="王房東"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  付款方式
                </Text>
                <Dropdown
                  value={settings.paymentMethod || ''}
                  onValueChange={(value) => 
                    setSettings({ ...settings, paymentMethod: value })
                  }
                  items={paymentMethods}
                  placeholder="請選擇付款方式"
                />
              </View>
            </View>
          </View>

          {/* 通知設定 */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              通知設定
            </Text>
            
            <View className="space-y-4">
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-base text-gray-900 dark:text-gray-100">
                  繳費提醒
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
                  自動備份
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
              資料管理
            </Text>
            
            <TouchableOpacity
              className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700"
              onPress={handleExport}
            >
              <View className="flex-row items-center">
                <Ionicons name="download-outline" size={24} color="#0EA5E9" />
                <Text className="text-base text-gray-900 dark:text-gray-100 ml-3">
                  匯出資料
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
                  清除所有資料
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* 網路測試 (開發模式) */}
          {__DEV__ && <NetworkTest />}

          {/* 儲存按鈕 */}
          <TouchableOpacity
            className="bg-primary-600 dark:bg-primary-500 rounded-lg py-4 mt-6"
            onPress={saveSettings}
          >
            <Text className="text-center text-white text-lg font-semibold">
              儲存設定
            </Text>
          </TouchableOpacity>

          {/* 版本資訊 */}
          <View className="items-center mt-8 mb-4">
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              WattRent v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 