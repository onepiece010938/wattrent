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
import { useTranslation } from '@/hooks/useTranslation';
import { currentPeriod } from '~/lib/period';
import { getDevMode } from '@/lib/devMode';
import { compressForOcr, base64ToBytes } from '@/lib/imageCompression';
import { useToast } from '@/components/Toast';

export default function CaptureScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const { isDarkColorScheme } = useColorScheme();
  const { t, currentLanguage } = useTranslation();
  const { showToast } = useToast();
  // currentLanguage is only used for display; period is always sent to backend as YYYY-MM
  void currentLanguage;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [meterReading, setMeterReading] = useState('');
  const [electricityRate, setElectricityRate] = useState('4.5');
  const [rent, setRent] = useState('8000');
  const [previousReading, setPreviousReading] = useState('0');
  const [processing, setProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStage, setSavingStage] = useState<'upload' | 'create' | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Handle screen-focus changes
  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      setIsCameraReady(false);
      
      // Small delay so the camera can re-initialise
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
      console.error(t('capture.loadSettingsFailed'), error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && isCameraReady) {
      try {
        // Capture at full quality, compression handled separately to control cost
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          base64: false,
        });
        if (photo) {
          await prepareAndProcess(photo.uri);
        }
      } catch (error) {
        console.error(t('capture.takePictureFailed'), error);
        Alert.alert(t('common.error'), t('capture.takePictureFailed'));
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await prepareAndProcess(asset.uri);
      }
    } catch (error) {
      console.error(t('capture.selectImageFailed'), error);
      Alert.alert(t('common.error'), t('capture.selectImageFailed'));
    }
  };

  // Compress -> show preview -> kick off OCR. Centralises the camera & gallery flow.
  const prepareAndProcess = async (uri: string) => {
    setOcrError(null);
    setLowConfidence(false);
    setMeterReading('');
    setCapturedImage(uri);
    setCapturedBase64(null);
    try {
      const compressed = await compressForOcr(uri);
      setCapturedBase64(compressed.base64);
      await processImage(compressed.base64);
    } catch (error) {
      console.error('image compression failed', error);
      setOcrError(t('errors.ocr.compressionFailed'));
    }
  };

  const processImage = async (imageBase64: string | null) => {
    if (!imageBase64) {
      return;
    }

    // Dev mode: skip Gemini call entirely to save cost while testing UI
    if (__DEV__ && getDevMode().skipOcr) {
      const prev = parseFloat(previousReading) || 0;
      const fake = String(Math.round(prev + 50 + Math.random() * 150));
      setMeterReading(fake);
      showToast({ kind: 'info', message: t('capture.ocrSkipped') });
      return;
    }

    setProcessing(true);
    setOcrError(null);
    setLowConfidence(false);
    try {
      const result = await apiService.processImage({ imageBase64 });
      if (result?.reading != null) {
        setMeterReading(String(result.reading));
        if (typeof result.confidence === 'number' && result.confidence < 0.85) {
          setLowConfidence(true);
          showToast({
            kind: 'info',
            message: t('errors.ocr.lowConfidence', { percent: Math.round(result.confidence * 100) }),
          });
        } else {
          showToast({ kind: 'success', message: t('capture.ocrSucceeded', { reading: result.reading }) });
        }
      } else {
        setOcrError(t('errors.ocr.failed'));
      }
    } catch (error) {
      console.error('OCR failed', error);
      const message = error instanceof Error ? error.message : String(error);
      // Distinguish backend "not configured" 503 from generic failure for clearer UX
      if (message.includes('not_configured') || message.includes('GEMINI')) {
        setOcrError(t('errors.ocr.notConfigured'));
      } else {
        setOcrError(message || t('errors.ocr.failed'));
      }
    } finally {
      setProcessing(false);
    }
  };

  const retryOcr = () => {
    if (capturedBase64) {
      processImage(capturedBase64);
    }
  };

  const calculateBill = async () => {
    if (!meterReading) {
      Alert.alert(t('common.error'), t('capture.pleaseEnterMeterReading'));
      return;
    }

    const currentReading = parseFloat(meterReading);
    const prevReading = parseFloat(previousReading);

    if (currentReading < prevReading) {
      Alert.alert(t('common.error'), t('capture.currentReadingCannotBeLower'));
      return;
    }

    // Open the confirm step instead of saving immediately
    setShowConfirm(true);
  };

  // Generate a stable client-side ID used as the GCS object name (orphan photos
  // are cleaned by bucket lifecycle). Bill.ID is a separate Firestore-generated ID.
  const newUploadId = (): string =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const confirmAndSave = async () => {
    const currentReading = parseFloat(meterReading);
    const rate = parseFloat(electricityRate);
    const rentAmount = parseFloat(rent);
    const period = currentPeriod();

    setSaving(true);
    try {
      let imageUrl: string | undefined;

      // Upload the compressed image first (if present) so the bill record can reference it.
      if (capturedBase64) {
        try {
          setSavingStage('upload');
          const uploadId = newUploadId();
          const signed = await apiService.signUpload(uploadId, 'image/jpeg');
          const bytes = base64ToBytes(capturedBase64);
          await apiService.putBinaryToSignedUrl(signed.uploadUrl, bytes, 'image/jpeg');
          imageUrl = signed.gcsPath;
        } catch (uploadErr) {
          // Photo upload is best-effort; the bill still saves without it.
          console.warn('photo upload failed; saving bill without imageUrl', uploadErr);
        }
      }

      setSavingStage('create');
      const bill = await apiService.createBill({
        meterReading: currentReading,
        electricityRate: rate,
        rent: rentAmount,
        period,
        imageUrl,
      });
      void bill;

      setShowConfirm(false);
      showToast({ kind: 'success', message: t('capture.billCalculatedAndSaved') });
      router.push('/(tabs)/history');
    } catch (error) {
      console.error(t('capture.createBillFailedConsole'), error);
      Alert.alert(t('common.error'), t('capture.createBillFailed'));
    } finally {
      setSaving(false);
      setSavingStage(null);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setCapturedBase64(null);
    setMeterReading('');
    setOcrError(null);
    setLowConfidence(false);
  };

  const handleCameraFlip = () => {
    setIsCameraReady(false);
    setFacing(facing === 'back' ? 'front' : 'back');
    
    // Small delay so the camera can re-initialise
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
            {t('capture.cameraPermissionTitle')}
          </Text>
          <TouchableOpacity
            className="bg-primary dark:bg-primary rounded-lg px-6 py-3 mt-6"
            onPress={requestPermission}
          >
            <Text className="text-primary-foreground font-semibold">{t('capture.grantPermission')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (capturedImage) {
    const currentReadingNum = parseFloat(meterReading) || 0;
    const prevReadingNum = parseFloat(previousReading) || 0;
    const rateNum = parseFloat(electricityRate) || 0;
    const rentNum = parseFloat(rent) || 0;
    const usageNum = Math.max(0, currentReadingNum - prevReadingNum);
    const electricityCostNum = usageNum * rateNum;
    const totalNum = electricityCostNum + rentNum;
    const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(2));

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
                  <Text className="text-white mt-3 text-base">{t('capture.processingImage')}</Text>
                </View>
              )}
            </View>

            {ocrError && (
              <View className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg p-3 mb-4">
                <View className="flex-row items-start">
                  <Ionicons name="alert-circle" size={18} color={isDarkColorScheme ? '#FCA5A5' : '#DC2626'} />
                  <Text className="flex-1 ml-2 text-sm text-red-700 dark:text-red-200">{ocrError}</Text>
                </View>
                {capturedBase64 && (
                  <TouchableOpacity
                    className="self-start mt-2 flex-row items-center"
                    onPress={retryOcr}
                    disabled={processing}
                  >
                    <Ionicons name="refresh" size={16} color={isDarkColorScheme ? '#FCA5A5' : '#DC2626'} />
                    <Text className="ml-1 text-sm font-semibold text-red-700 dark:text-red-200">
                      {t('capture.ocrRetry')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {lowConfidence && !ocrError && (
              <View className="bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-lg p-3 mb-4 flex-row items-start">
                <Ionicons name="warning" size={18} color={isDarkColorScheme ? '#FBBF24' : '#D97706'} />
                <Text className="flex-1 ml-2 text-sm text-amber-800 dark:text-amber-200">
                  {t('capture.verifyReadingHint')}
                </Text>
              </View>
            )}

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  {t('capture.meterReading')}
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={meterReading}
                  onChangeText={setMeterReading}
                  keyboardType="numeric"
                  placeholder={t('capture.enterMeterReading')}
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  {t('capture.previousMeterReading')}
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={previousReading}
                  onChangeText={setPreviousReading}
                  keyboardType="numeric"
                  placeholder={t('capture.enterPreviousMeterReading')}
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  {t('capture.electricityRate')}
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={electricityRate}
                  onChangeText={setElectricityRate}
                  keyboardType="decimal-pad"
                  placeholder={t('capture.enterElectricityRate')}
                  placeholderTextColor={isDarkColorScheme ? '#9CA3AF' : '#6B7280'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">
                  {t('capture.rent')}
                </Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={rent}
                  onChangeText={setRent}
                  keyboardType="numeric"
                  placeholder={t('capture.enterRent')}
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
                  {t('capture.retake')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center bg-primary dark:bg-primary rounded-lg py-3"
                onPress={calculateBill}
                disabled={processing}
              >
                <Ionicons name="calculator" size={20} color="#FFFFFF" />
                <Text className="text-primary-foreground font-semibold ml-2">{t('capture.calculateBill')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Step 3: Confirm overlay */}
        {showConfirm && (
          <View
            className="absolute inset-0 justify-end bg-black/60"
            style={{ zIndex: 50 }}
          >
            <View className="bg-card rounded-t-3xl p-6 border-t border-border">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-card-foreground">
                  {t('capturePreview.title')}
                </Text>
                <TouchableOpacity onPress={() => !saving && setShowConfirm(false)} disabled={saving}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDarkColorScheme ? '#D1D5DB' : '#374151'}
                  />
                </TouchableOpacity>
              </View>

              <View className="space-y-2 mb-5">
                <Text className="text-sm text-muted-foreground">
                  {t('capturePreview.period', { period: currentPeriod() })}
                </Text>
                <Text className="text-sm text-card-foreground">
                  {t('capturePreview.usage', {
                    usage: fmt(usageNum),
                    current: fmt(currentReadingNum),
                    previous: fmt(prevReadingNum),
                  })}
                </Text>
                <Text className="text-sm text-card-foreground">
                  {t('capturePreview.electricityLine', {
                    usage: fmt(usageNum),
                    rate: fmt(rateNum),
                    cost: fmt(electricityCostNum),
                  })}
                </Text>
                <Text className="text-sm text-card-foreground">
                  {t('capturePreview.rentLine', { rent: fmt(rentNum) })}
                </Text>
                <View className="border-t border-border pt-2 mt-1">
                  <Text className="text-lg font-bold text-primary">
                    {t('capturePreview.totalLine', { total: fmt(totalNum) })}
                  </Text>
                </View>
              </View>

              {saving && (
                <View className="flex-row items-center mb-3">
                  <ActivityIndicator size="small" color={isDarkColorScheme ? '#60A5FA' : '#2563EB'} />
                  <Text className="ml-2 text-sm text-muted-foreground">
                    {savingStage === 'upload'
                      ? t('capturePreview.uploadingPhoto')
                      : t('capturePreview.savingBill')}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 border-2 border-primary rounded-lg py-3 items-center"
                  onPress={() => setShowConfirm(false)}
                  disabled={saving}
                >
                  <Text className="text-primary font-semibold">{t('capturePreview.back')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 rounded-lg py-3 items-center ${
                    saving ? 'bg-primary/60' : 'bg-primary'
                  }`}
                  onPress={confirmAndSave}
                  disabled={saving}
                >
                  <Text className="text-primary-foreground font-semibold">
                    {t('capturePreview.confirm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Only render the camera when the screen is focused and the camera is ready
  if (!isScreenFocused || !isCameraReady) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="text-white mt-3 text-base">{t('capture.startingCamera')}</Text>
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
        
        {/* Camera controls - absolutely positioned */}
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