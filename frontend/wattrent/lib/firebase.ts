// Firebase Web SDK setup.
//
// We use the JS SDK (not @react-native-firebase) so we can stay on the Expo
// managed workflow — that means no custom native build is required and the
// app keeps working on iOS / Android / Web from the same source.
//
// Config values are pulled from app.config.js -> extra.firebase, which in
// turn reads EXPO_PUBLIC_FIREBASE_* env vars at build time (set them as EAS
// secrets so they are baked into the binary; they are not real secrets — they
// only identify the project and are fine to ship inside the bundle).
//
// Persistence:
//   - Web: built-in localStorage / IndexedDB.
//   - iOS / Android: initializeAuth + getReactNativePersistence(AsyncStorage)
//     so the session survives app restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Auth,
  initializeAuth,
  // @ts-expect-error getReactNativePersistence is shipped by firebase/auth at runtime but missing from the public type exports.
  getReactNativePersistence,
} from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

// A value counts as "present" only when it is a non-empty string. This guards
// against the common bypass-mode pitfall where Constants.expoConfig.extra ends
// up with literal `null` values (from app.config.js falling back to `|| null`
// when env vars are unset). The `??` operator only treats null/undefined as
// missing, so we need a stricter truthiness check before handing the object
// to Firebase. Without this guard, initializeApp({ apiKey: null }) explodes
// with "apiKey.includes is not a function" on first render.
function nonEmpty(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function loadConfig(): FirebaseConfig | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { firebase?: Partial<FirebaseConfig> };
  const apiKey = nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_API_KEY) ?? nonEmpty(extra.firebase?.apiKey);
  const authDomain = nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN) ?? nonEmpty(extra.firebase?.authDomain);
  const projectId = nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) ?? nonEmpty(extra.firebase?.projectId);
  const appId = nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_APP_ID) ?? nonEmpty(extra.firebase?.appId);
  if (!apiKey || !projectId || !appId) {
    return null;
  }
  return {
    apiKey,
    authDomain: authDomain ?? '',
    projectId,
    appId,
    storageBucket: nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET) ?? nonEmpty(extra.firebase?.storageBucket),
    messagingSenderId:
      nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ??
      nonEmpty(extra.firebase?.messagingSenderId),
    measurementId:
      nonEmpty(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID) ?? nonEmpty(extra.firebase?.measurementId),
  };
}

let cached: FirebaseApp | null = null;

/**
 * getFirebaseApp returns the lazily-initialised Firebase app, or null when
 * EXPO_PUBLIC_FIREBASE_* env vars are not configured.
 *
 * Callers MUST tolerate null and fall back to an unauthenticated mode (used
 * during early dev / Jest / when running against a local backend with
 * AUTH_BYPASS=true). Returning null instead of throwing lets the app still
 * boot in that scenario.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (cached) return cached;
  const cfg = loadConfig();
  if (!cfg) return null;
  if (getApps().length === 0) {
    cached = initializeApp(cfg);
  } else {
    cached = getApp();
  }
  return cached;
}

let cachedAuth: ReturnType<typeof getAuth> | null = null;

/**
 * getFirebaseAuth returns a configured Auth instance with persistence
 * wired up appropriately for the current platform.
 *
 * Returns null when Firebase config is missing, so the rest of the app can
 * decide what to do (typically: pretend the user is signed out).
 */
export function getFirebaseAuth(): ReturnType<typeof getAuth> | null {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) return null;

  if (Platform.OS === 'web') {
    cachedAuth = getAuth(app);
    return cachedAuth;
  }
  // On native we must initialise persistence on first access; subsequent
  // calls return the same instance via getAuth.
  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialised earlier in the process; fall back to getAuth.
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

/** True if the EXPO_PUBLIC_FIREBASE_* config is present and Auth is usable. */
export function isFirebaseConfigured(): boolean {
  return loadConfig() !== null;
}
