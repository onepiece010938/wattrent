import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '~/lib/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';

export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // 計算正確的底部導航高度
  const tabBarHeight = Platform.select({
    ios: 49 + insets.bottom,
    android: 60 + insets.bottom,
    default: 60,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDarkColorScheme ? '#60A5FA' : '#2563EB',
        tabBarInactiveTintColor: isDarkColorScheme ? '#9CA3AF' : '#6B7280',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDarkColorScheme ? '#1F2937' : '#FFFFFF',
          borderTopColor: isDarkColorScheme ? '#374151' : '#E5E7EB',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: Platform.OS === 'android' ? 8 : 4,
          paddingHorizontal: 16,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDarkColorScheme ? 0.3 : 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: t('navigation.capture'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "camera" : "camera-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('navigation.history'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "receipt" : "receipt-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('navigation.settings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "settings" : "settings-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
