import { Platform } from 'react-native';
import * as Network from 'expo-network';

export const getLocalIP = async (): Promise<string> => {
  try {
    const ip = await Network.getIpAddressAsync();
    return ip;
  } catch (error) {
    console.error('無法獲取本機 IP:', error);
    return '192.168.0.172'; // 預設值
  }
};

export const getApiBaseUrl = async (): Promise<string> => {
  // 如果有環境變數，優先使用
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // 開發環境下的 URL 配置
  if (__DEV__) {
    if (Platform.OS === 'web') {
      // Web 可以使用 localhost
      return 'http://localhost:8080/api/v1';
    } else if (Platform.OS === 'android') {
      // Android 模擬器使用特殊 IP
      const isEmulator = await isAndroidEmulator();
      if (isEmulator) {
        return 'http://10.0.2.2:8080/api/v1';
      }
    }
    
    // 實體手機使用實際 IP
    return 'http://192.168.0.172:8080/api/v1';
  }
  
  // 生產環境
  return 'https://api.wattrent.com/api/v1';
};

const isAndroidEmulator = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  
  try {
    const ip = await Network.getIpAddressAsync();
    // Android 模擬器通常使用 10.0.2.x 網段
    return ip.startsWith('10.0.2.');
  } catch {
    return false;
  }
}; 