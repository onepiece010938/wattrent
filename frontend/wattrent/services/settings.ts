import { UserSettings } from '@/types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SETTINGS_KEY = 'user_settings';

// 根據平台選擇正確的 API URL - 與 api.ts 保持一致
const getApiBaseUrl = () => {
  // 優先使用 app.config.js 中的配置
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }
  
  // 如果有環境變數，使用環境變數
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // 開發環境下的 URL 配置
  if (__DEV__) {
    if (Platform.OS === 'web') {
      // Web 可以使用 localhost
      return 'http://localhost:8080/api/v1';
    } else {
      // 手機需要使用電腦的 IP 地址
      return 'http://192.168.0.172:8080/api/v1';
    }
  }
  
  // 生產環境
  return 'https://api.wattrent.com/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

// 帶超時的 fetch 函數
const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout: number = 10000): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeout);

    fetch(url, options)
      .then(response => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

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
      console.log('從後端API獲取設定...', 'API URL:', API_BASE_URL);
      const response = await fetchWithTimeout(`${API_BASE_URL}/settings?userId=user1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      }, 10000);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('API回應:', result);

      if (result.success && result.data) {
        // 轉換後端的欄位名稱到前端格式
        const backendSettings = result.data;
        const frontendSettings: UserSettings = {
          userId: backendSettings.userId || backendSettings.userID,
          defaultElectricityRate: backendSettings.defaultElectricityRate,
          defaultRent: backendSettings.defaultRent,
          previousMeterReading: backendSettings.previousMeterReading || 0,
          landlordName: backendSettings.landlordName || '',
          paymentMethod: backendSettings.paymentMethod || '銀行轉帳',
        };
        
        console.log('轉換後的設定:', frontendSettings);
        return frontendSettings;
      } else {
        console.log('API回應不成功，使用預設設定');
        return this.defaultSettings;
      }
    } catch (error) {
      console.error('從API載入設定失敗:', error);
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        console.error('網路連線失敗，請確認：');
        console.error('1. 後端伺服器是否在運行 (http://localhost:8080)');
        console.error('2. 模擬器網路設定是否正確');
        console.error(`3. 當前使用的API URL: ${API_BASE_URL}`);
      } else if (error instanceof Error && error.message.includes('Request timeout')) {
        console.error('請求超時，請檢查網路連線和伺服器狀態');
      }
      console.log('使用預設設定作為備用');
      return this.defaultSettings;
    }
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      console.log('儲存設定到後端API:', settings, 'API URL:', API_BASE_URL);
      
      // 轉換前端格式到後端格式
      const backendSettings = {
        userId: settings.userId,
        defaultElectricityRate: settings.defaultElectricityRate,
        defaultRent: settings.defaultRent,
        previousMeterReading: settings.previousMeterReading,
        landlordName: settings.landlordName,
        paymentMethod: settings.paymentMethod,
      };

      const response = await fetchWithTimeout(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(backendSettings),
      }, 10000);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('儲存設定API回應:', result);

      if (!result.success) {
        throw new Error(result.error || '儲存設定失敗');
      }
    } catch (error) {
      console.error('儲存設定到API失敗:', error);
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        console.error('網路連線失敗，請確認後端伺服器是否運行');
      }
      throw error;
    }
  }

  async updatePreviousMeterReading(reading: number): Promise<void> {
    try {
      console.log('更新前次電表度數到後端API:', reading, 'API URL:', API_BASE_URL);
      
      const response = await fetchWithTimeout(`${API_BASE_URL}/settings/user1/meter-reading`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ reading }),
      }, 10000);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('更新前次電表度數API回應:', result);

      if (!result.success) {
        throw new Error(result.error || '更新前次電表度數失敗');
      }
    } catch (error) {
      console.error('更新前次電表度數失敗:', error);
      throw error;
    }
  }

  async clearSettings(): Promise<void> {
    try {
      console.log('清除用戶設定...', 'API URL:', API_BASE_URL);
      
      const response = await fetchWithTimeout(`${API_BASE_URL}/settings/user1`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      }, 10000);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('清除設定API回應:', result);

      if (!result.success) {
        throw new Error(result.error || '清除設定失敗');
      }
    } catch (error) {
      console.error('清除設定失敗:', error);
      throw error;
    }
  }

  // 測試 API 連線的方法
  async testConnection(): Promise<boolean> {
    try {
      console.log('測試API連線...', API_BASE_URL);
      const response = await fetchWithTimeout(`${API_BASE_URL.replace('/api/v1', '')}/api/v1/health`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      }, 5000);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API連線測試成功:', result);
        return true;
      } else {
        console.error('API連線測試失敗，狀態碼:', response.status);
        return false;
      }
    } catch (error) {
      console.error('API連線測試失敗:', error);
      return false;
    }
  }
}

export default new SettingsService(); 