import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettings } from '@/types';

const SETTINGS_KEY = 'user_settings';

class SettingsService {
  private defaultSettings: UserSettings = {
    userId: 'user1',
    defaultElectricityRate: 4.5,
    defaultRent: 8000,
    previousMeterReading: 0,
    landlordName: '',
    paymentMethod: '銀行轉帳',
  };

  async getSettings(): Promise<UserSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        // 確保所有必要的欄位都存在
        return { ...this.defaultSettings, ...settings };
      }
      return this.defaultSettings;
    } catch (error) {
      console.error('載入設定失敗:', error);
      return this.defaultSettings;
    }
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      const settingsJson = JSON.stringify(settings);
      await AsyncStorage.setItem(SETTINGS_KEY, settingsJson);
    } catch (error) {
      console.error('儲存設定失敗:', error);
      throw error;
    }
  }

  async updatePreviousMeterReading(reading: number): Promise<void> {
    try {
      const settings = await this.getSettings();
      settings.previousMeterReading = reading;
      await this.saveSettings(settings);
    } catch (error) {
      console.error('更新前次電表度數失敗:', error);
      throw error;
    }
  }

  async clearSettings(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
      console.error('清除設定失敗:', error);
      throw error;
    }
  }
}

export default new SettingsService(); 