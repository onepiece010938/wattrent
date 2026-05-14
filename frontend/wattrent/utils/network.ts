// This file is currently unused; kept as a reference for future on-device subnet detection.
// The real API URL resolution lives in lib/apiUrl.ts.
import { Platform } from 'react-native';
import { resolveApiUrl } from '~/lib/apiUrl';

export const getLocalIP = async (): Promise<string> => {
  // Previously used expo-network; that package is no longer installed, so this is stubbed to an empty string.
  return '';
};

export const getApiBaseUrl = async (): Promise<string> => {
  return resolveApiUrl();
};

const isAndroidEmulator = async (): Promise<boolean> => {
  return Platform.OS === 'android';
};
void isAndroidEmulator;
 