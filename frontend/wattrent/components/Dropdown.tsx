import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  items: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}

export default function Dropdown({
  value,
  onValueChange,
  items,
  placeholder = '請選擇',
  className = '',
}: DropdownProps) {
  const [visible, setVisible] = useState(false);
  const selectedItem = items.find(item => item.value === value);

  return (
    <>
      <TouchableOpacity
        className={`flex-row items-center justify-between border border-gray-300 dark:border-gray-600 rounded-lg p-3 ${className}`}
        onPress={() => setVisible(true)}
      >
        <Text className="text-gray-900 dark:text-gray-100 text-base">
          {selectedItem?.label || placeholder}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color="#9CA3AF"
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center px-4"
          onPress={() => setVisible(false)}
        >
          <View className="bg-white dark:bg-gray-800 rounded-lg max-h-80">
            <ScrollView>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
                    item.value === value ? 'bg-primary-50 dark:bg-primary-900' : ''
                  }`}
                  onPress={() => {
                    onValueChange(item.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    className={`text-base ${
                      item.value === value
                        ? 'text-primary-600 dark:text-primary-400 font-semibold'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
} 