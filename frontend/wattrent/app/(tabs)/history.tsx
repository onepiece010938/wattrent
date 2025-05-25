import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Bill } from '@/types';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    setRefreshing(true);
    try {
      // TODO: 從 API 或本地儲存載入帳單
      // 模擬資料
      const mockBills: Bill[] = [
        {
          id: '1',
          userId: 'user1',
          meterReadingId: 'reading1',
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
    } catch (error) {
      console.error('載入帳單失敗:', error);
      Alert.alert('錯誤', '無法載入帳單記錄');
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

  const markAsPaid = (billId: string) => {
    Alert.alert(
      '確認付款',
      '確定要標記此帳單為已付款嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定',
          onPress: async () => {
            // TODO: 更新帳單付款狀態
            const updatedBills = bills.map(bill =>
              bill.id === billId
                ? { ...bill, paidAt: new Date().toISOString() }
                : bill
            );
            setBills(updatedBills);
          },
        },
      ]
    );
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <View style={[styles.billCard, { backgroundColor: colors.card }]}>
      <View style={styles.billHeader}>
        <Text style={[styles.billPeriod, { color: colors.text }]}>{item.period}</Text>
        {item.paidAt && (
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.paidText}>已付款</Text>
          </View>
        )}
      </View>

      <View style={styles.billDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.text }]}>用電度數</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {item.electricityUsage} 度
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.text }]}>電費</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            NT$ {item.electricityCost}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.text }]}>房租</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            NT$ {item.rent}
          </Text>
        </View>
        <View style={[styles.detailRow, styles.totalRow]}>
          <Text style={[styles.detailLabel, styles.totalLabel, { color: colors.text }]}>
            總計
          </Text>
          <Text style={[styles.detailValue, styles.totalValue, { color: colors.tint }]}>
            NT$ {item.totalAmount}
          </Text>
        </View>
      </View>

      <View style={styles.billActions}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.tint }]}
          onPress={() => shareBillMessage(item)}
        >
          <Ionicons name="share-outline" size={20} color={colors.tint} />
          <Text style={[styles.actionButtonText, { color: colors.tint }]}>分享</Text>
        </TouchableOpacity>

        {!item.paidAt && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.tint }]}
            onPress={() => markAsPaid(item.id)}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>已付款</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>帳單記錄</Text>
      </View>

      <FlatList
        data={bills}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={loadBills}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              尚無帳單記錄
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  billCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billPeriod: {
    fontSize: 18,
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  billDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  billActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    borderWidth: 0,
  },
  primaryButtonText: {
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    opacity: 0.6,
  },
}); 