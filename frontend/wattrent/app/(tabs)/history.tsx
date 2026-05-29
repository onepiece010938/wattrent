import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Bill } from '@/types';
import apiService from '@/services/api';
import PaymentStatusDropdown from '@/components/PaymentStatusDropdown';
import settingsService from '@/services/settings';
import { useColorScheme } from '~/lib/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatPeriod } from '~/lib/period';
import { getDevMode } from '@/lib/devMode';
import { useToast } from '@/components/Toast';

export default function HistoryScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const { isDarkColorScheme } = useColorScheme();
  const { t, currentLanguage } = useTranslation();
  const { showToast } = useToast();
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
    if (__DEV__ && getDevMode().forceMockHistory) {
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

  const shareBillMessage = async (bill: Bill) => {
    try {
      if (!bill.message) {
        const message = generateBillMessage(bill);
        bill.message = message;
      }
      
      const result = await Share.share({
        message: bill.message,
      });

      if (result.action === Share.sharedAction) {
        // Bill marked as shared client-side only; server-side share log is not implemented yet.
      }
    } catch {
      Alert.alert(t('common.error'), t('history.cannotShareMessage'));
    }
  };

  const generateBillMessage = (bill: Bill): string => {
    return t('history.billMessage', { 
      rent: bill.rent, 
      electricityCost: bill.electricityCost, 
      totalAmount: bill.totalAmount 
    });
  };

  const deleteBill = (billId: string) => {
    Alert.alert(
      t('history.confirmDelete'),
      t('history.confirmDeleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteBill(billId);
              
              const updatedBills = bills.filter(bill => bill.id !== billId);
              setBills(updatedBills);
              
              showToast({ kind: 'success', message: t('history.billDeleted') });
            } catch (error) {
              console.error(t('history.deleteBillFailed'), error);
              Alert.alert(t('common.error'), t('history.cannotDeleteBill'));
            }
          },
        },
      ]
    );
  };

  const togglePaymentStatus = async (bill: Bill) => {
    try {
      const isMarkingAsPaid = !bill.paidAt;

      const updatedBill = await apiService.setPaymentStatus(bill.id, isMarkingAsPaid);

      const updatedBills = bills.map(b =>
        b.id === bill.id ? updatedBill : b
      );
      setBills(updatedBills);

      // If marking as paid, update the previous meter reading
      if (isMarkingAsPaid) {
        try {
          await settingsService.updatePreviousMeterReading(bill.meterReading);
        } catch (error) {
          console.error(t('history.updatePreviousMeterReadingFailed'), error);
        }
      }

      Alert.alert(t('common.success'), bill.paidAt ? t('history.markAsUnpaid') : t('history.markAsPaid'));    } catch (error) {
      console.error(t('history.updatePaymentStatusFailed'), error);
      Alert.alert(t('common.error'), t('history.cannotUpdatePaymentStatus'));
    }
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <View className="bg-card rounded-2xl p-5 mb-4 shadow-sm border border-border">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-card-foreground">
          {formatPeriod(item.period, currentLanguage)}
        </Text>
        {item.paidAt ? (
          <PaymentStatusDropdown
            bill={item}
            onUpdatePaymentStatus={togglePaymentStatus}
            onDeleteBill={deleteBill}
          />
        ) : (
          <View className="flex-row items-center bg-amber-100 dark:bg-amber-900 px-3 py-1 rounded-full">
            <Ionicons name="time" size={16} color="#F59E0B" />
            <Text className="text-amber-700 dark:text-amber-300 text-sm ml-1">
              {t('history.pendingPayment')}
            </Text>
          </View>
        )}
      </View>

      <View className="space-y-2 mb-4">
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">{t('history.meterReading')}：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {item.meterReading} {t('history.unit')}
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">{t('history.electricityRate')}：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {t('history.currency')}{item.electricityRate}/{t('history.unit')}
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">{t('history.electricityUsage')}：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {item.electricityUsage} {t('history.unit')}
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">{t('history.electricityCalculation')}：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {item.electricityUsage} × {t('history.currency')}{item.electricityRate} = {t('history.currency')}{item.electricityCost}
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">{t('history.rent')}：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {t('history.currency')}{item.rent}
          </Text>
        </View>
        
        <View className="border-t border-border pt-2 mt-2">
          <View className="flex-row justify-between">
            <Text className="text-base font-semibold text-card-foreground">
              {t('history.totalAmount')}：
            </Text>
            <Text className="text-lg font-bold text-primary">
              {t('history.currency')}{item.totalAmount}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-2">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center border border-primary rounded-lg py-2"
          onPress={() => shareBillMessage(item)}
        >
          <Ionicons 
            name="share-outline" 
            size={18} 
            color={isDarkColorScheme ? '#60A5FA' : '#2563EB'} 
          />
          <Text className="text-primary text-sm font-medium ml-1">
            {t('common.share')}
          </Text>
        </TouchableOpacity>

        {!item.paidAt && (
          <>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center bg-primary dark:bg-primary rounded-lg py-2"
              onPress={() => togglePaymentStatus(item)}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text className="text-primary-foreground text-sm font-medium ml-1">
                {t('history.markAsPaid')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-center border border-destructive rounded-lg px-3 py-2"
              onPress={() => deleteBill(item.id)}
            >
              <Ionicons 
                name="trash-outline" 
                size={18} 
                color={isDarkColorScheme ? '#F87171' : '#DC2626'} 
              />
              <Text className="text-destructive text-sm font-medium ml-1">{t('common.delete')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
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
    </SafeAreaView>
  );
} 