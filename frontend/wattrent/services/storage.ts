import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettings } from '@/types';

const STORAGE_KEYS = {
  USER_SETTINGS: 'user_settings',
  LATEST_READING: 'latest_reading',
};

class StorageService {
  // 用戶設定
  async getUserSettings(): Promise<UserSettings | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('讀取用戶設定失敗:', error);
      return null;
    }
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_SETTINGS,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error('儲存用戶設定失敗:', error);
      throw error;
    }
  }

  // 最新讀數
  async getLatestReading(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LATEST_READING);
      return data ? parseFloat(data) : null;
    } catch (error) {
      console.error('讀取最新讀數失敗:', error);
      return null;
    }
  }

  async saveLatestReading(reading: number): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LATEST_READING,
        reading.toString()
      );
    } catch (error) {
      console.error('儲存最新讀數失敗:', error);
      throw error;
    }
  }

  // 清除所有資料
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_SETTINGS,
        STORAGE_KEYS.LATEST_READING,
      ]);
    } catch (error) {
      console.error('清除資料失敗:', error);
      throw error;
    }
  }
}

export default new StorageService(); 