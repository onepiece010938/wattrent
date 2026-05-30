import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Bill } from '@/types';
import apiService from '@/services/api';
import { useColorScheme } from '~/lib/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatPeriod } from '~/lib/period';
import { getDevMode, isDevModeAvailable } from '@/lib/devMode';
import AdBanner from '@/components/AdBanner';

export default function HistoryScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const { isDarkColorScheme } = useColorScheme();
  const { t, currentLanguage } = useTranslation();
  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [])
  );

  const buildMockBills = (): Bill[] => [
    {
      id: 'mock-1',
      meterReading: 1500,
      previousReading: 1350,
      electricityUsage: 150,
      electricityRate: 4.5,
      electricityCost: 675,
      rent: 8000,
      totalAmount: 8675,
      period: '2024-01',
      createdAt: '2024-01-15T10:00:00Z',
      message: t('history.billMessage', { rent: 8000, electricityCost: 675, totalAmount: 8675 }),
    },
    {
      id: 'mock-2',
      meterReading: 1680,
      previousReading: 1500,
      electricityUsage: 180,
      electricityRate: 4.5,
      electricityCost: 810,
      rent: 8000,
      totalAmount: 8810,
      period: '2024-02',
      createdAt: '2024-02-15T10:00:00Z',
      paidAt: '2024-02-16T14:30:00Z',
      message: t('history.billMessage', { rent: 8000, electricityCost: 810, totalAmount: 8810 }),
    },
  ];

  const loadBills = async () => {
    setRefreshing(true);
    setLoadError(null);

    // Dev-mode escape hatch: skip the API and show fixed demo data
    if (isDevModeAvailable() && getDevMode().forceMockHistory) {
      setBills(buildMockBills());
      setUsingMock(true);
      setRefreshing(false);
      return;
    }

    try {
      const billsData = await apiService.getBills();
      setBills(billsData);
      setUsingMock(false);
    } catch (error) {
      console.error(t('history.loadBillsFailed'), error);
      // Surface the failure so the user knows what is going on instead of silently faking data
      setBills([]);
      setLoadError(error instanceof Error ? error.message : t('history.loadError'));
    } finally {
      setRefreshing(false);
    }
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/bill/[id]', params: { id: item.id } })}
      className="bg-card rounded-2xl p-5 mb-4 shadow-sm border border-border"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-sm text-muted-foreground">
            {formatPeriod(item.period, currentLanguage)}
          </Text>
          <Text className="text-2xl font-bold text-primary mt-1">
            {t('history.currency')}{item.totalAmount}
          </Text>
          <View className="mt-2 flex-row items-center">
            {item.paidAt ? (
              <View className="flex-row items-center bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full">
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <Text className="text-emerald-700 dark:text-emerald-300 text-xs ml-1">
                  {t('history.paid')}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 rounded-full">
                <Ionicons name="time" size={12} color="#F59E0B" />
                <Text className="text-amber-700 dark:text-amber-300 text-xs ml-1">
                  {t('history.pendingPayment')}
                </Text>
              </View>
            )}
            {item.imageUrl && (
              <View className="ml-2 flex-row items-center">
                <Ionicons
                  name="image-outline"
                  size={12}
                  color={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>
            )}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={22}
          color={isDarkColorScheme ? '#9CA3AF' : '#9CA3AF'}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
        <Text className="text-3xl font-bold text-foreground pt-5 pb-4">
          {t('history.title')}
        </Text>

        <FlatList
          data={bills}
          renderItem={renderBillItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadBills}
              colors={[isDarkColorScheme ? '#60A5FA' : '#2563EB']}
              tintColor={isDarkColorScheme ? '#60A5FA' : '#2563EB'}
            />
          }
          ListEmptyComponent={
            loadError ? (
              <View className="flex-1 items-center justify-center py-20 px-6">
                <Ionicons
                  name="cloud-offline-outline"
                  size={64}
                  color={isDarkColorScheme ? '#F87171' : '#DC2626'}
                />
                <Text className="text-foreground text-base mt-4 text-center">
                  {t('history.loadError')}
                </Text>
                <Text className="text-muted-foreground text-xs mt-2 text-center" numberOfLines={3}>
                  {loadError}
                </Text>
                <TouchableOpacity
                  className="mt-6 bg-primary rounded-lg px-6 py-3 flex-row items-center"
                  onPress={loadBills}
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                  <Text className="text-primary-foreground font-semibold ml-2">
                    {t('history.retryLoading')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center py-20">
                <Ionicons
                  name="document-text-outline"
                  size={64}
                  color={isDarkColorScheme ? '#6B7280' : '#9CA3AF'}
                />
                <Text className="text-muted-foreground text-base mt-4">
                  {t('history.noBills')}
                </Text>
              </View>
            )
          }
          ListHeaderComponent={
            usingMock ? (
              <View className="bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 mb-3 flex-row items-center">
                <Ionicons name="flask" size={16} color={isDarkColorScheme ? '#FBBF24' : '#D97706'} />
                <Text className="ml-2 text-xs text-amber-800 dark:text-amber-200">
                  {t('history.showingMock')}
                </Text>
              </View>
            ) : null
          }
        />
      </View>
      <AdBanner />
    </SafeAreaView>
  );
} 