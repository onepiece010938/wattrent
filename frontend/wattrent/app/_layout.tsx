import '../global.css';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { initI18n } from '../lib/i18n';
import { loadDevMode } from '@/lib/devMode';
import { ToastProvider } from '@/components/Toast';
import DevModeBanner from '@/components/DevModeBanner';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [i18nInitialized, setI18nInitialized] = useState(false);

  useEffect(() => {
    // Initialise i18n + dev-mode persisted state in parallel
    const initialize = async () => {
      try {
        await Promise.all([initI18n(), loadDevMode()]);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setI18nInitialized(true);
      }
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
      <ToastProvider>
        <StatusBar style="auto" />
        <DevModeBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
