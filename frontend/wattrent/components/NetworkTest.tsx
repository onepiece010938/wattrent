import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';

export default function NetworkTest() {
  const [testResult, setTestResult] = useState<string>('');
  const { t } = useTranslation();

  const runNetworkTest = async () => {
    setTestResult(t('networkTest.testing'));
    
    const tests = [
      { name: 'IP Address', url: 'http://192.168.0.172:8080/api/v1/health' },
      { name: '10.0.2.2 (Android Emulator)', url: 'http://10.0.2.2:8080/api/v1/health' },
    ];

    const results: string[] = [];

    for (const test of tests) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(test.url, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          results.push(`✅ ${test.name}: ${t('networkTest.success')} - ${data.message}`);
        } else {
          results.push(`❌ ${test.name}: ${t('networkTest.failed')} - HTTP ${response.status}`);
        }
      } catch (error) {
        results.push(`❌ ${test.name}: ${t('networkTest.error')} - ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setTestResult(results.join('\n'));
  };

  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-5 shadow-sm">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('networkTest.title')}
      </Text>
      
      <TouchableOpacity
        className="bg-blue-500 rounded-lg py-3 mb-4"
        onPress={runNetworkTest}
      >
        <Text className="text-white text-center font-medium">
          {t('networkTest.testConnection')}
        </Text>
      </TouchableOpacity>
      
      {testResult ? (
        <View className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
          <Text className="text-gray-900 dark:text-gray-100 text-sm font-mono">
            {testResult}
          </Text>
        </View>
      ) : null}
    </View>
  );
} 