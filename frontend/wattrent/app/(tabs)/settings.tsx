import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
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
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { UserSettings } from '@/types';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [settings, setSettings] = useState<UserSettings>({
    userId: 'user1',
    defaultElectricityRate: 4.5,
    defaultRent: 8000,
    landlordName: '',
    paymentMethod: '轉帳',
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // TODO: 從本地儲存載入設定
      // 使用預設值
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  };

  const saveSettings = async () => {
    try {
      // TODO: 儲存設定到本地儲存
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>設定</Text>
        </View>

        {/* 預設值設定 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>預設值</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>電費單價 (元/度)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
              value={settings.defaultElectricityRate.toString()}
              onChangeText={(value) => 
                setSettings({ ...settings, defaultElectricityRate: parseFloat(value) || 0 })
              }
              keyboardType="decimal-pad"
              placeholder="4.5"
              placeholderTextColor={colors.icon}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>房租 (元)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
              value={settings.defaultRent.toString()}
              onChangeText={(value) => 
                setSettings({ ...settings, defaultRent: parseInt(value) || 0 })
              }
              keyboardType="numeric"
              placeholder="8000"
              placeholderTextColor={colors.icon}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>房東名稱</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
              value={settings.landlordName}
              onChangeText={(value) => 
                setSettings({ ...settings, landlordName: value })
              }
              placeholder="王房東"
              placeholderTextColor={colors.icon}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>付款方式</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
              value={settings.paymentMethod}
              onChangeText={(value) => 
                setSettings({ ...settings, paymentMethod: value })
              }
              placeholder="轉帳/現金"
              placeholderTextColor={colors.icon}
            />
          </View>
        </View>

        {/* 通知設定 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>通知設定</Text>
          
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>繳費提醒</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.icon, true: colors.tint }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>自動備份</Text>
            <Switch
              value={autoBackup}
              onValueChange={setAutoBackup}
              trackColor={{ false: colors.icon, true: colors.tint }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 資料管理 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>資料管理</Text>
          
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: colors.icon }]}
            onPress={handleExport}
          >
            <View style={styles.actionContent}>
              <Ionicons name="download-outline" size={24} color={colors.tint} />
              <Text style={[styles.actionText, { color: colors.text }]}>匯出資料</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleClearData}
          >
            <View style={styles.actionContent}>
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
              <Text style={[styles.actionText, { color: '#ff4444' }]}>清除所有資料</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {/* 儲存按鈕 */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint }]}
          onPress={saveSettings}
        >
          <Text style={styles.saveButtonText}>儲存設定</Text>
        </TouchableOpacity>

        {/* 版本資訊 */}
        <View style={styles.versionInfo}>
          <Text style={[styles.versionText, { color: colors.icon }]}>
            WattRent v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 16,
  },
  saveButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 30,
  },
  versionText: {
    fontSize: 14,
  },
}); 