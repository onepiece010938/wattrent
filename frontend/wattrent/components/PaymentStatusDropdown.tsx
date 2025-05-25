import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bill } from '@/types';

interface PaymentStatusDropdownProps {
  bill: Bill;
  onUpdatePaymentStatus: (bill: Bill) => void;
  onDeleteBill: (billId: string) => void;
}

export default function PaymentStatusDropdown({
  bill,
  onUpdatePaymentStatus,
  onDeleteBill,
}: PaymentStatusDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleOptionSelect = (option: 'unpaid' | 'delete') => {
    setShowDropdown(false);
    
    if (option === 'unpaid') {
      onUpdatePaymentStatus(bill);
    } else if (option === 'delete') {
      Alert.alert(
        '確認刪除',
        '確定要刪除此帳單嗎？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '刪除',
            style: 'destructive',
            onPress: () => onDeleteBill(bill.id),
          },
        ]
      );
    }
  };

  if (!bill.paidAt) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full"
        onPress={() => setShowDropdown(true)}
      >
        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
        <Text className="text-green-700 dark:text-green-300 text-sm ml-1">
          已匯款
        </Text>
        <Ionicons name="chevron-down" size={14} color="#10B981" style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View className="flex-1 justify-center items-center">
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 mx-8 shadow-lg">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                選擇操作
              </Text>
              
              <TouchableOpacity
                className="flex-row items-center py-3 px-4 rounded-lg mb-2"
                onPress={() => handleOptionSelect('unpaid')}
              >
                <Ionicons name="close-circle" size={20} color="#F59E0B" />
                <Text className="text-gray-900 dark:text-white ml-3 text-base">
                  標記為尚未匯款
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-row items-center py-3 px-4 rounded-lg"
                onPress={() => handleOptionSelect('delete')}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text className="text-red-600 dark:text-red-400 ml-3 text-base">
                  刪除帳單
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="mt-4 py-3 px-4 bg-gray-100 dark:bg-gray-700 rounded-lg"
                onPress={() => setShowDropdown(false)}
              >
                <Text className="text-gray-900 dark:text-white text-center text-base">
                  取消
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
} 