import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettings } from '@/types';

const STORAGE_KEYS = {
  USER_SETTINGS: 'user_settings',
  LATEST_READING: 'latest_reading',
};

class StorageService {
  // User settings
  async getUserSettings(): Promise<UserSettings | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('failed to read user settings:', error);
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
      console.error('failed to save user settings:', error);
      throw error;
    }
  }

  // Latest reading
  async getLatestReading(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LATEST_READING);
      return data ? parseFloat(data) : null;
    } catch (error) {
      console.error('failed to read latest reading:', error);
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
      console.error('failed to save latest reading:', error);
      throw error;
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_SETTINGS,
        STORAGE_KEYS.LATEST_READING,
      ]);
    } catch (error) {
      console.error('failed to clear data:', error);
      throw error;
    }
  }
}

export default new StorageService(); 