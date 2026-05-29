// Dev Mode singleton — controls test/debug toggles persisted in AsyncStorage.
//
// Toggles surface in Settings (only in __DEV__ builds). They let you exercise
// the UI without hitting real backend / Gemini, and let you swap API URL on
// the fly without re-building.
//
// IMPORTANT: never trust these in production. The whole module guards on
// __DEV__ and toggles default to OFF.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@wattrent/devMode';

export interface DevModeState {
  /** Skip Gemini call; fake a meter reading on the client. Saves cost while testing UI. */
  skipOcr: boolean;
  /** Force History to show built-in mock bills (instead of calling the API). */
  forceMockHistory: boolean;
  /** Override API URL at runtime; empty = use lib/apiUrl.ts resolution. */
  apiUrlOverride: string;
}

const DEFAULTS: DevModeState = {
  skipOcr: false,
  forceMockHistory: false,
  apiUrlOverride: '',
};

let cached: DevModeState = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<(s: DevModeState) => void>();

export function isDevModeAvailable(): boolean {
  return __DEV__;
}

export async function loadDevMode(): Promise<DevModeState> {
  if (!__DEV__) return DEFAULTS;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      cached = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DevModeState>) };
    }
  } catch {
    // ignore; keep defaults
  }
  loaded = true;
  return cached;
}

export function getDevMode(): DevModeState {
  if (!__DEV__) return DEFAULTS;
  return cached;
}

export function isLoaded(): boolean {
  return loaded;
}

export async function setDevMode(partial: Partial<DevModeState>): Promise<void> {
  if (!__DEV__) return;
  cached = { ...cached, ...partial };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // ignore persistence failure
  }
  listeners.forEach((fn) => {
    try { fn(cached); } catch { /* ignore listener errors */ }
  });
}

export function subscribeDevMode(fn: (s: DevModeState) => void): () => void {
  if (!__DEV__) return () => undefined;
  listeners.add(fn);
  return () => listeners.delete(fn) as unknown as void;
}

/** True if any dev toggle is active and the user should see the banner. */
export function isAnyDevToggleActive(s: DevModeState = cached): boolean {
  if (!__DEV__) return false;
  return s.skipOcr || s.forceMockHistory || s.apiUrlOverride.length > 0;
}
