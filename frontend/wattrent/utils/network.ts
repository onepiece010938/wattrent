// 這份檔案目前未在 app 內使用；保留為以後實機網段偵測的 reference。
// 真正的 API URL 解析請看 lib/apiUrl.ts。
import { Platform } from 'react-native';
import { resolveApiUrl } from '~/lib/apiUrl';

export const getLocalIP = async (): Promise<string> => {
  // 之前用 expo-network；該套件未安裝，stub 成空字串
  return '';
};

export const getApiBaseUrl = async (): Promise<string> => {
  return resolveApiUrl();
};

const isAndroidEmulator = async (): Promise<boolean> => {
  return Platform.OS === 'android';
};
void isAndroidEmulator;
 