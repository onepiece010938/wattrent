import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function NetworkTest() {
  const [testResult, setTestResult] = useState<string>('');

  const testConnection = async () => {
    setTestResult('測試中...');
    
    const testUrls = [
      { name: 'Localhost', url: 'http://localhost:8080/api/v1/health' },
      { name: 'IP 地址', url: 'http://192.168.0.172:8080/api/v1/health' },
      { name: '10.0.2.2 (Android 模擬器)', url: 'http://10.0.2.2:8080/api/v1/health' },
      { name: 'Ngrok', url: 'https://calf-positive-urgently.ngrok-free.app/api/v1/health' },
    ];

    let results = [];
    
    for (const test of testUrls) {
      try {
        const response = await fetch(test.url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push(`✅ ${test.name}: 成功 - ${data.message}`);
        } else {
          results.push(`❌ ${test.name}: 失敗 - HTTP ${response.status}`);
        }
      } catch (error) {
        results.push(`❌ ${test.name}: 錯誤 - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    setTestResult(results.join('\n'));
  };

  return (
    <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-5">
      <Text className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4">
        網路連線測試
      </Text>
      
      <TouchableOpacity
        className="bg-amber-600 dark:bg-amber-700 rounded-lg py-3 px-4 mb-4"
        onPress={testConnection}
      >
        <Text className="text-center text-white font-semibold">
          測試連線
        </Text>
      </TouchableOpacity>
      
      {testResult ? (
        <Text className="text-sm text-gray-800 dark:text-gray-200 font-mono">
          {testResult}
        </Text>
      ) : null}
    </View>
  );
} 