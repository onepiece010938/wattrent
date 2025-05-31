import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';

interface DropdownItem {
  label: string;
  value: string;
}

interface DropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  items: DropdownItem[];
  placeholder?: string;
}

export default function Dropdown({
  value,
  onValueChange,
  items,
  placeholder,
}: DropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { t } = useTranslation();

  const selectedItem = items.find(item => item.value === value);
  const displayText = selectedItem ? selectedItem.label : (placeholder || t('common.selectOption'));

  const handleItemSelect = (item: DropdownItem) => {
    onValueChange(item.value);
    setShowDropdown(false);
  };

  return (
    <>
      <TouchableOpacity
        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 flex-row items-center justify-between"
        onPress={() => setShowDropdown(true)}
      >
        <Text className="text-gray-900 dark:text-gray-100 flex-1">
          {displayText}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color="#9CA3AF" 
        />
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
            <View className="bg-white dark:bg-gray-800 rounded-2xl mx-8 max-h-80 shadow-lg">
              <FlatList
                data={items}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="px-4 py-3 border-b border-gray-200 dark:border-gray-700"
                    onPress={() => handleItemSelect(item)}
                  >
                    <Text className="text-gray-900 dark:text-gray-100 text-base">
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
} 