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

export default function HistoryScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isDarkColorScheme } = useColorScheme();

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
      console.error('載入帳單失敗:', error);
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
          period: '2024年1月',
          createdAt: '2024-01-15T10:00:00Z',
          message: '房東您好，本月房租8000元加電費675元，總計8675元已匯款，請查收。',
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
          period: '2024年2月',
          createdAt: '2024-02-15T10:00:00Z',
          paidAt: '2024-02-16T14:30:00Z',
          message: '房東您好，本月房租8000元加電費810元，總計8810元已匯款，請查收。',
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
      Alert.alert('錯誤', '無法分享訊息');
    }
  };

  const generateBillMessage = (bill: Bill): string => {
    return `房東您好，本月房租${bill.rent}元加電費${bill.electricityCost}元，總計${bill.totalAmount}元已匯款，請查收。`;
  };

  const deleteBill = (billId: string) => {
    Alert.alert(
      '確認刪除',
      '確定要刪除此帳單嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteBill(billId);
              
              const updatedBills = bills.filter(bill => bill.id !== billId);
              setBills(updatedBills);
              
              Alert.alert('成功', '帳單已刪除');
            } catch (error) {
              console.error('刪除帳單失敗:', error);
              Alert.alert('錯誤', '無法刪除帳單');
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
          console.error('更新前次電表度數失敗:', error);
        }
      }
      
      Alert.alert('成功', bill.paidAt ? '已標記為尚未匯款' : '已標記為已匯款');
    } catch (error) {
      console.error('更新付款狀態失敗:', error);
      Alert.alert('錯誤', '無法更新付款狀態');
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
              待匯款
            </Text>
          </View>
        )}
      </View>

      <View className="space-y-2 mb-4">
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">電表度數：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {item.meterReading} 度
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">電費單價：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            ${item.electricityRate}/度
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">用電度數：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {item.electricityUsage} 度
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">電費計算：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            {item.electricityUsage} × ${item.electricityRate} = ${item.electricityCost}
          </Text>
        </View>
        
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">房租：</Text>
          <Text className="text-sm text-card-foreground font-medium">
            ${item.rent}
          </Text>
        </View>
        
        <View className="border-t border-border pt-2 mt-2">
          <View className="flex-row justify-between">
            <Text className="text-base font-semibold text-card-foreground">
              總金額：
            </Text>
            <Text className="text-lg font-bold text-primary">
              ${item.totalAmount}
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
            分享
          </Text>
        </TouchableOpacity>

        {!item.paidAt && (
          <>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center bg-primary rounded-lg py-2"
              onPress={() => togglePaymentStatus(item)}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text className="text-primary-foreground text-sm font-medium ml-1">
                標記為已匯款
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
              <Text className="text-destructive text-sm font-medium ml-1">刪除</Text>
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
          帳單記錄
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
                尚無帳單記錄
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
} 