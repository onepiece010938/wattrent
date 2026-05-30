import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform, View, ActivityIndicator } from 'react-native';
import { initI18n } from '../lib/i18n';
import { loadDevMode } from '@/lib/devMode';
import { ToastProvider } from '@/components/Toast';
import DevModeBanner from '@/components/DevModeBanner';
import telemetry from '@/lib/telemetry';
import { AuthProvider, useAuth } from '@/lib/auth';
import { initAds } from '@/lib/ads';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

/**
 * AuthRouteGate redirects between the (auth) and (tabs) groups based on the
 * Firebase Auth state. Runs as a child of <AuthProvider> so useAuth() works.
 */
function AuthRouteGate({ children }: { children: React.ReactNode }) {
  const { status, mode } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'initializing') return;
    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, mode, segments, router]);

  if (status === 'initializing') {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [i18nInitialized, setI18nInitialized] = useState(false);

  useEffect(() => {
    // Initialise i18n + dev-mode persisted state + telemetry in parallel
    const initialize = async () => {
      try {
        await Promise.all([initI18n(), loadDevMode(), telemetry.init()]);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        telemetry.captureException(error, { scope: 'app.init' });
      } finally {
        setI18nInitialized(true);
      }
      // Fire-and-forget: AdMob init can take a second on cold start; we don't
      // want to block splash screen on it. Failures are captured inside.
      initAds();
    };

    initialize();
  }, []);

  useEffect(() => {
    if (loaded && i18nInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nInitialized]);

  useEffect(() => {
    // Configure the Android navigation bar
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#ffffff');
    }
  }, []);

  if (!loaded || !i18nInitialized) {
    // Async font loading and i18n initialization only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="auto" />
          <DevModeBanner />
          <AuthRouteGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="bill/[id]" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </AuthRouteGate>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

