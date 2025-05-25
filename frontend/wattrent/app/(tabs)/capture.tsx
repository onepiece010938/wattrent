import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '@/services/api';
import settingsService from '@/services/settings';
import { useColorScheme } from '~/lib/useColorScheme';

export default function CaptureScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const { isDarkColorScheme } = useColorScheme();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [meterReading, setMeterReading] = useState('');
  const [electricityRate, setElectricityRate] = useState('4.5');
  const [rent, setRent] = useState('8000');
  const [previousReading, setPreviousReading] = useState('0');
  const [processing, setProcessing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // 處理頁面焦點變化
  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      setIsCameraReady(false);
      
      // 延遲一點時間讓相機重新初始化
      const timer = setTimeout(() => {
        setIsCameraReady(true);
      }, 100);

      return () => {
        setIsScreenFocused(false);
        setIsCameraReady(false);
        clearTimeout(timer);
      };
    }, [])
  );

  const loadSettings = async () => {
    try {
      const settings = await settingsService.getSettings();
      setElectricityRate(settings.defaultElectricityRate.toString());
      setRent(settings.defaultRent.toString());
      setPreviousReading(settings.previousMeterReading.toString());
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && isCameraReady) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (photo) {
          setCapturedImage(photo.uri);
          processImage(photo.uri);
        }
      } catch (error) {
        console.error('拍照失敗:', error);
        Alert.alert('錯誤', '拍照失敗，請再試一次');
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCapturedImage(result.assets[0].uri);
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('選擇圖片失敗:', error);
      Alert.alert('錯誤', '選擇圖片失敗，請再試一次');
    }
  };

  const processImage = async (imageUri: string) => {
    setProcessing(true);
    try {
      // TODO: 實作 OCR 處理
      setTimeout(() => {
        setMeterReading('12345');
        setProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('影像處理失敗:', error);
      Alert.alert('錯誤', '無法識別電表度數，請手動輸入');
      setProcessing(false);
    }
  };

  const calculateBill = async () => {
    if (!meterReading) {
      Alert.alert('提示', '請輸入電表度數');
      return;
    }

    const currentReading = parseFloat(meterReading);
    const prevReading = parseFloat(previousReading);
    const rate = parseFloat(electricityRate);
    const rentAmount = parseFloat(rent);

    if (currentReading < prevReading) {
      Alert.alert('錯誤', '當前電表度數不能小於前次度數');
      return;
    }

    try {
      const now = new Date();
      const period = `${now.getFullYear()}年${now.getMonth() + 1}月`;
      const electricityUsage = currentReading - prevReading;
      const electricityCost = electricityUsage * rate;
      const totalAmount = electricityCost + rentAmount;
      
      const bill = await apiService.createBill({
        meterReading: currentReading,
        previousReading: prevReading,
        electricityUsage: electricityUsage,
        electricityRate: rate,
        electricityCost: electricityCost,
        rent: rentAmount,
        totalAmount: totalAmount,
        period: period,
      });
      
      Alert.alert('成功', '帳單已計算並儲存', [
        {
          text: '查看帳單',
          onPress: () => router.push('/(tabs)/history'),
        },
      ]);
    } catch (error) {
      console.error('建立帳單失敗:', error);
      Alert.alert('錯誤', '無法建立帳單，請檢查網路連線');
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setMeterReading('');
  };

  const handleCameraFlip = () => {
    setIsCameraReady(false);
    setFacing(facing === 'back' ? 'front' : 'back');
    
    // 延遲一點時間讓相機重新初始化
    setTimeout(() => {
      setIsCameraReady(true);
    }, 100);
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons 
            name="camera-outline" 
            size={64} 
            color={isDarkColorScheme ? '#9CA3AF' : '#6B7280'} 
          />
          <Text className="text-lg text-foreground text-center mt-4">
            需要相機權限才能拍攝電表
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-lg px-6 py-3 mt-6"
            onPress={requestPermission}
          >
            <Text className="text-primary-foreground font-semibold">授予權限</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (capturedImage) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="p-5">
            <View className="relative mb-6">
              <Image 
                source={{ uri: capturedImage }} 
                className="w-full h-80 rounded-2xl"
                resizeMode="cover"
              />
              {processing && (
                <View className="absolute inset-0 bg-black/70 rounded-2xl justify-center items-center">
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text className="text-white mt-3 text-base">正在識別電表度數...</Text>
                </View>
              )}
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  電表度數
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={meterReading}
                  onChangeText={setMeterReading}
                  keyboardType="numeric"
                  placeholder="請輸入電表度數"
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  前次(月)電表度數
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={previousReading}
                  onChangeText={setPreviousReading}
                  keyboardType="numeric"
                  placeholder="請輸入前次電表度數"
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  電費單價 (元/度)
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={electricityRate}
                  onChangeText={setElectricityRate}
                  keyboardType="decimal-pad"
                  placeholder="請輸入電費單價"
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  房租 (元)
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={rent}
                  onChangeText={setRent}
                  keyboardType="numeric"
                  placeholder="請輸入房租"
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>
            </View>

            <View className="flex-row gap-3 mt-8">
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center border-2 border-primary rounded-lg py-3"
                onPress={retake}
              >
                <Ionicons 
                  name="camera-reverse" 
                  size={20} 
                  color={isDarkColorScheme ? '#60A5FA' : '#2563EB'} 
                />
                <Text className="text-primary font-semibold ml-2">
                  重新拍攝
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center bg-primary rounded-lg py-3"
                onPress={calculateBill}
                disabled={processing}
              >
                <Ionicons name="calculator" size={20} color="#FFFFFF" />
                <Text className="text-primary-foreground font-semibold ml-2">計算帳單</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 只有在頁面聚焦且相機準備好時才顯示相機
  if (!isScreenFocused || !isCameraReady) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="text-white mt-3 text-base">正在啟動相機...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <View className="flex-1 relative">
        <CameraView 
          style={{ flex: 1 }} 
          facing={facing} 
          ref={cameraRef}
          mode="picture"
          onCameraReady={() => setIsCameraReady(true)}
        />
        
        {/* 相機控制按鈕 - 使用絕對定位 */}
        <View className="absolute top-0 right-0 p-5 pt-12">
          <TouchableOpacity
            className="bg-black/30 rounded-full p-3"
            onPress={handleCameraFlip}
          >
            <Ionicons name="camera-reverse" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View className="absolute bottom-0 left-0 right-0 pb-8">
          <View className="flex-row justify-around items-center px-8">
            <TouchableOpacity 
              className="bg-black/30 rounded-full p-3"
              onPress={pickImage}
            >
              <Ionicons name="images" size={30} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              className="bg-white rounded-full p-5"
              onPress={takePicture}
              disabled={!isCameraReady}
            >
              <View className="bg-white rounded-full w-16 h-16 border-4 border-black" />
            </TouchableOpacity>

            <View className="p-3 w-12" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
} 