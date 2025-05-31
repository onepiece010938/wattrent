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

export default function HistoryScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isDarkColorScheme } = useColorScheme();
  const { t, currentLanguage } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [])
  );

  const loadBills = async () => {
    setRefreshing(true);
    try {
      const billsData = await apiService.getBills();
      setBills(billsData);
    } catch (error) {
      console.error(t('history.loadBillsFailed'), error);
      // 如果 API 連線失敗，使用模擬資料
      const mockBills: Bill[] = [
        {
          id: '1',
          userId: 'user1',
          meterReadingId: 'reading1',
          meterReading: 1500,
          electricityUsage: 150,
          electricityRate: 4.5,
          electricityCost: 675,
          rent: 8000,
          totalAmount: 8675,
          period: currentLanguage === 'zh-TW' ? '2024年1月' : 'January 2024',
          createdAt: '2024-01-15T10:00:00Z',
          message: t('history.billMessage', { rent: 8000, electricityCost: 675, totalAmount: 8675 }),
        },
        {
          id: '2',
          userId: 'user1',
          meterReadingId: 'reading2',
          meterReading: 1680,
          electricityUsage: 180,
          electricityRate: 4.5,
          electricityCost: 810,
          rent: 8000,
          totalAmount: 8810,
          period: currentLanguage === 'zh-TW' ? '2024年2月' : 'February 2024',
          createdAt: '2024-02-15T10:00:00Z',
          paidAt: '2024-02-16T14:30:00Z',
          message: t('history.billMessage', { rent: 8000, electricityCost: 810, totalAmount: 8810 }),
        },
      ];
      setBills(mockBills);
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
        // TODO: 更新帳單已分享狀態
      }
    } catch (error) {
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
              
              Alert.alert(t('common.success'), t('history.billDeleted'));
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
      
      const updatedBill = await apiService.updateBill(bill.id, {
        paidAt: bill.paidAt ? undefined : new Date().toISOString(),
      });
      
      const updatedBills = bills.map(b =>
        b.id === bill.id ? updatedBill : b
      );
      setBills(updatedBills);
      
      // 如果標記為已匯款，更新前次電表度數
      if (isMarkingAsPaid) {
        try {
          await settingsService.updatePreviousMeterReading(bill.meterReading);
        } catch (error) {
          console.error(t('history.updatePreviousMeterReadingFailed'), error);
        }
      }
      
      Alert.alert(t('common.success'), bill.paidAt ? t('history.markAsUnpaid') : t('history.markAsPaid'));
    } catch (error) {
      console.error(t('history.updatePaymentStatusFailed'), error);
      Alert.alert(t('common.error'), t('history.cannotUpdatePaymentStatus'));
    }
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <View className="bg-card rounded-2xl p-5 mb-4 shadow-sm border border-border">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-card-foreground">
          {item.period}
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
          }
        />
      </View>
    </SafeAreaView>
  );
} 