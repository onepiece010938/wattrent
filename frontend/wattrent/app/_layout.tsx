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
    // 初始化 i18n
    const initializeI18n = async () => {
      try {
        await initI18n();
        setI18nInitialized(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        setI18nInitialized(true); // 即使失敗也要繼續，使用預設語言
      }
    };

    initializeI18n();
  }, []);

  useEffect(() => {
    if (loaded && i18nInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nInitialized]);

  useEffect(() => {
    // 設定Android導航欄
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
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SafeAreaProvider>
  );
}
