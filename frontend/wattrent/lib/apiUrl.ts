// Centralised API base URL resolution so it does not get scattered across services.
//
// Resolution order:
//  1. Dev-mode runtime override (Settings -> Dev mode -> Backend URL)
//  2. process.env.EXPO_PUBLIC_API_URL (build-time env)
//  3. Constants.expoConfig.extra.apiUrl (runtime config from app.config.js)
//  4. __DEV__ + web -> http://localhost:8080/api/v1
//  5. __DEV__ + native -> derive LAN IP from Metro hostUri -> http://<lan>:8080/api/v1
//     (covers the "physical phone running Expo Go on the same WiFi as the laptop"
//     scenario without hard-coding 192.168.x.x)
//  6. fallback -> staging Cloud Run
//
// To switch backends: `$env:EXPO_PUBLIC_API_URL='https://...'` before running the frontend,
// or use the in-app dev-mode override (settings tab in __DEV__ builds).
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getDevMode } from '@/lib/devMode';

const STAGING_URL = 'https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1';

export function resolveApiUrl(): string {
  if (__DEV__) {
    const override = getDevMode().apiUrlOverride;
    if (override) return stripTrailingSlash(override);
  }

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
