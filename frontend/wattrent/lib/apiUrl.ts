// 統一決定 API base URL，避免散落在多個 service 檔。
//
// 解析順序：
//  1. process.env.EXPO_PUBLIC_API_URL（build-time env，最高優先）
//  2. Constants.expoConfig.extra.apiUrl（app.config.js 設的 runtime config）
//  3. __DEV__ + web → http://localhost:8080/api/v1
//  4. __DEV__ + native → 從 Metro 的 hostUri 推 LAN IP → http://<lan>:8080/api/v1
//     （對應「實機 Expo Go 跟筆電在同 WiFi」的情境，不必再硬寫 192.168.x.x）
//  5. fallback → staging Cloud Run
//
// 要切到別的 backend：跑 frontend 前 `$env:EXPO_PUBLIC_API_URL='https://...'`。
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const STAGING_URL = 'https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1';

export function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return stripTrailingSlash(fromEnv);
  }

  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined)?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) {
    return stripTrailingSlash(fromExtra);
  }

  if (__DEV__) {
    if (Platform.OS === 'web') {
      return 'http://localhost:8080/api/v1';
    }
    const host = extractDevHost();
    if (host) {
      return `http://${host}:8080/api/v1`;
    }
  }

  return STAGING_URL;
}

function extractDevHost(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: string } | undefined;
  const expoGoConfig = (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } })
    .expoGoConfig;
  const hostUri = expoConfig?.hostUri ?? expoGoConfig?.debuggerHost ?? null;
  if (!hostUri) return null;
  const colon = hostUri.indexOf(':');
  return colon === -1 ? hostUri : hostUri.slice(0, colon);
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
