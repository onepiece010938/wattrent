import React, { useState, useRef } from 'react';
import {
  StyleSheet,
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
import { Camera, CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function CaptureScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [meterReading, setMeterReading] = useState('');
  const [electricityRate, setElectricityRate] = useState('4.5'); // 預設電費
  const [rent, setRent] = useState('8000'); // 預設房租
  const [processing, setProcessing] = useState(false);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (photo) {
          setCapturedImage(photo.uri);
          // TODO: 呼叫 OCR API 識別電表度數
          processImage(photo.uri);
        }
      } catch (error) {
        console.error('拍照失敗:', error);
        Alert.alert('錯誤', '拍照失敗，請再試一次');
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      // TODO: 呼叫 OCR API 識別電表度數
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (imageUri: string) => {
    setProcessing(true);
    try {
      // TODO: 實作 OCR 處理
      // 模擬 OCR 處理
      setTimeout(() => {
        setMeterReading('12345'); // 模擬識別結果
        setProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('影像處理失敗:', error);
      Alert.alert('錯誤', '無法識別電表度數，請手動輸入');
      setProcessing(false);
    }
  };

  const calculateBill = () => {
    if (!meterReading) {
      Alert.alert('提示', '請輸入電表度數');
      return;
    }

    // TODO: 實作帳單計算邏輯
    Alert.alert('成功', '帳單已計算並儲存');
    router.push('/(tabs)/history');
  };

  const retake = () => {
    setCapturedImage(null);
    setMeterReading('');
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionText, { color: colors.text }]}>
            需要相機權限才能拍攝電表
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>授予權限</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (capturedImage) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>正在識別電表度數...</Text>
              </View>
            )}
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>電表度數</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                value={meterReading}
                onChangeText={setMeterReading}
                keyboardType="numeric"
                placeholder="請輸入電表度數"
                placeholderTextColor={colors.icon}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>電費單價 (元/度)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                value={electricityRate}
                onChangeText={setElectricityRate}
                keyboardType="decimal-pad"
                placeholder="請輸入電費單價"
                placeholderTextColor={colors.icon}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>房租 (元)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                value={rent}
                onChangeText={setRent}
                keyboardType="numeric"
                placeholder="請輸入房租"
                placeholderTextColor={colors.icon}
              />
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { borderColor: colors.tint }]}
              onPress={retake}
            >
              <Ionicons name="camera-reverse" size={20} color={colors.tint} />
              <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>重新拍攝</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.tint }]}
              onPress={calculateBill}
              disabled={processing}
            >
              <Ionicons name="calculator" size={20} color="#fff" />
              <Text style={styles.buttonText}>計算帳單</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse" size={30} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
              <Ionicons name="images" size={30} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <View style={styles.iconButton} />
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 50,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 30,
  },
  iconButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  capturedImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  processingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  form: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 