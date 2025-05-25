import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Bill, MeterReading } from '@/types';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [latestBill, setLatestBill] = useState<Bill | null>(null);
  const [lastReading, setLastReading] = useState<MeterReading | null>(null);

  useEffect(() => {
    // TODO: 從 API 或本地儲存載入最新資料
    loadLatestData();
  }, []);

  const loadLatestData = async () => {
    try {
      // 模擬載入資料
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('載入資料失敗:', error);
      setLoading(false);
    }
  };

  const handleQuickCapture = () => {
    router.push('/(tabs)/capture');
  };

  const colors = Colors[colorScheme ?? 'light'];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>WattRent</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>電費房租計算助手</Text>
        </View>

        {/* 最新帳單摘要 */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={24} color={colors.tint} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>本月帳單</Text>
          </View>
          
          {latestBill ? (
            <View style={styles.billInfo}>
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: colors.text }]}>電費：</Text>
                <Text style={[styles.billValue, { color: colors.text }]}>
                  NT$ {latestBill.electricityCost}
                </Text>
              </View>
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: colors.text }]}>房租：</Text>
                <Text style={[styles.billValue, { color: colors.text }]}>
                  NT$ {latestBill.rent}
                </Text>
              </View>
              <View style={[styles.billRow, styles.totalRow]}>
                <Text style={[styles.billLabel, styles.totalLabel, { color: colors.text }]}>
                  總計：
                </Text>
                <Text style={[styles.billValue, styles.totalValue, { color: colors.tint }]}>
                  NT$ {latestBill.totalAmount}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.text }]}>
              尚無帳單記錄
            </Text>
          )}
        </View>

        {/* 上次讀數 */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="speedometer-outline" size={24} color={colors.tint} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>上次讀數</Text>
          </View>
          
          {lastReading ? (
            <View style={styles.readingInfo}>
              <Text style={[styles.readingValue, { color: colors.text }]}>
                {lastReading.reading} 度
              </Text>
              <Text style={[styles.readingDate, { color: colors.text }]}>
                {new Date(lastReading.createdAt).toLocaleDateString('zh-TW')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.text }]}>
              尚無讀數記錄
            </Text>
          )}
        </View>

        {/* 快速操作按鈕 */}
        <TouchableOpacity 
          style={[styles.captureButton, { backgroundColor: colors.tint }]}
          onPress={handleQuickCapture}
        >
          <Ionicons name="camera" size={28} color="#fff" />
          <Text style={styles.captureButtonText}>拍攝電表</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  billInfo: {
    gap: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 16,
  },
  billValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 5,
  },
  totalLabel: {
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  readingInfo: {
    alignItems: 'center',
  },
  readingValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  readingDate: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.7,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 10,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
