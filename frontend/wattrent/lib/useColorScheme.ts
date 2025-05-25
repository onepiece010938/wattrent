import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export function useColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useNativewindColorScheme();

  return {
    colorScheme: colorScheme ?? 'light',
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
  };
}

export function useInitialAndroidBarSync() {
  const { colorScheme } = useNativewindColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    // Set the navigation bar to be translucent and match the theme
    NavigationBar.setBackgroundColorAsync(colorScheme === 'dark' ? '#000000' : '#ffffff');
  }, [colorScheme]);
} 