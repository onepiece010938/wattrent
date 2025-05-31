import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '~/components/nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';

export default function HomeScreen() {
  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();
  const { t } = useTranslation();

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'capture':
        router.push('/(tabs)/capture');
        break;
      case 'history':
        router.push('/(tabs)/history');
        break;
      case 'settings':
        router.push('/(tabs)/settings');
        break;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="p-5">
          {/* Header */}
          <View className="mb-6">
            <Text variant="largeTitle" className="font-bold text-foreground">
              {t('home.title')}
            </Text>
            <Text variant="body" color="secondary" className="mt-1">
              {t('home.subtitle')}
            </Text>
          </View>

          {/* Welcome Card */}
          <View className="bg-card rounded-2xl p-8 mb-6 items-center border border-border">
            <Ionicons 
              name="flash" 
              size={48} 
              color={isDarkColorScheme ? '#60A5FA' : '#2563EB'} 
            />
            <Text variant="title2" className="text-card-foreground mt-3 text-center">
              {t('home.welcome')}
            </Text>
            <Text variant="body" color="secondary" className="mt-2 text-center">
              {t('home.welcomeSubtitle')}
            </Text>
            <TouchableOpacity
              className="mt-4 bg-primary dark:bg-primary rounded-lg px-6 py-3"
              onPress={() => router.push('/(tabs)/capture')}
            >
              <Text className="text-primary-foreground font-semibold">{t('home.startUsing')}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Text variant="title2" className="text-foreground mb-4">
            {t('home.quickActions')}
          </Text>
          <View className="flex-row flex-wrap gap-4">
            <TouchableOpacity
              className="flex-1 bg-card rounded-xl p-4 items-center border border-border"
              onPress={() => handleQuickAction('capture')}
            >
              <View className="bg-primary/10 rounded-full p-3 mb-3">
                <Ionicons 
                  name="camera" 
                  size={24} 
                  color={isDarkColorScheme ? '#60A5FA' : '#2563EB'} 
                />
              </View>
              <Text variant="body" className="text-card-foreground font-medium">
                {t('home.captureMeter')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-card rounded-xl p-4 items-center border border-border"
              onPress={() => handleQuickAction('history')}
            >
              <View className="bg-accent/10 rounded-full p-3 mb-3">
                <Ionicons 
                  name="receipt" 
                  size={24} 
                  color={isDarkColorScheme ? '#34D399' : '#059669'} 
                />
              </View>
              <Text variant="body" className="text-card-foreground font-medium">
                {t('home.billHistory')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-card rounded-xl p-4 items-center border border-border"
              onPress={() => handleQuickAction('settings')}
            >
              <View className="bg-secondary/10 rounded-full p-3 mb-3">
                <Ionicons 
                  name="settings" 
                  size={24} 
                  color={isDarkColorScheme ? '#A78BFA' : '#7C3AED'} 
                />
              </View>
              <Text variant="body" className="text-card-foreground font-medium">
                {t('home.settings')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
