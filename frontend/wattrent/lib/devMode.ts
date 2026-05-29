// Dev Mode singleton — controls test/debug toggles persisted in AsyncStorage.
//
// Toggles surface in Settings (when isDevModeAvailable() is true). They let
// you exercise the UI without hitting real backend / Gemini, and let you swap
// the API URL on the fly without re-building.
//
// Availability:
//   - __DEV__ builds: always available (running from Metro / dev client).
//   - Production binaries: available only when the build was made with the
//     env var EXPO_PUBLIC_DEV_MODE_ENABLED=true. This lets us flip a
//     staging-flavored production build into a test mode without recompiling,
//     while keeping it permanently OFF for user-facing release builds.
//
// IMPORTANT: never trust these in production for security-sensitive paths.
// The toggles only affect UI/state behavior (skipping OCR, swapping API URL,
// surfacing mock history). They never bypass auth.

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

// Resolved once at module load time. process.env values baked into Expo bundles
// via EXPO_PUBLIC_* are static, so caching is safe and avoids per-call string
// comparisons.
const DEV_MODE_AVAILABLE: boolean =
  __DEV__ || process.env.EXPO_PUBLIC_DEV_MODE_ENABLED === 'true';

export function isDevModeAvailable(): boolean {
  return DEV_MODE_AVAILABLE;
}

export async function loadDevMode(): Promise<DevModeState> {
  if (!DEV_MODE_AVAILABLE) return DEFAULTS;
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
  if (!DEV_MODE_AVAILABLE) return DEFAULTS;
  return cached;
}

export function isLoaded(): boolean {
  return loaded;
}

export async function setDevMode(partial: Partial<DevModeState>): Promise<void> {
  if (!DEV_MODE_AVAILABLE) return;
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
  if (!DEV_MODE_AVAILABLE) return () => undefined;
  listeners.add(fn);
  return () => listeners.delete(fn) as unknown as void;
}

/** True if any dev toggle is active and the user should see the banner. */
export function isAnyDevToggleActive(s: DevModeState = cached): boolean {
  if (!DEV_MODE_AVAILABLE) return false;
  return s.skipOcr || s.forceMockHistory || s.apiUrlOverride.length > 0;
}

/**
 * Reset cached state. Used by tests; never call from app code.
 *
 * @internal
 */
export function __resetDevModeForTests(): void {
  cached = { ...DEFAULTS };
  loaded = false;
  listeners.clear();
}
