import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiService from '@/services/api';
import settingsService from '@/services/settings';
import { Bill } from '@/types';
import { useColorScheme } from '~/lib/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/Toast';
import { formatPeriod } from '~/lib/period';
import AdBanner from '@/components/AdBanner';

export default function BillDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { isDarkColorScheme } = useColorScheme();
  const { t, currentLanguage } = useTranslation();
  const { showToast } = useToast();

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const b = await apiService.getBill(params.id);
      setBill(b);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('bill.notFound'));
    } finally {
      setLoading(false);
    }
  }, [params.id, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const togglePaid = async () => {
    if (!bill) return;
    try {
      const updated = await apiService.setPaymentStatus(bill.id, !bill.paidAt);
      setBill(updated);
      if (!bill.paidAt) {
        // marked-as-paid: sync settings' previousMeterReading
        try {
          await settingsService.updatePreviousMeterReading(updated.meterReading);
        } catch (err) {
          console.warn('updatePreviousMeterReading failed', err);
        }
      }
      showToast({
        kind: 'success',
        message: updated.paidAt ? t('history.markAsPaid') : t('history.markAsUnpaid'),
      });
    } catch (err) {
      Alert.alert(t('common.error'), t('history.cannotUpdatePaymentStatus'));
      void err;
    }
  };

  const remove = () => {
    if (!bill) return;
    Alert.alert(t('history.confirmDelete'), t('history.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteBill(bill.id);
            showToast({ kind: 'success', message: t('history.billDeleted') });
            router.back();
          } catch {
            Alert.alert(t('common.error'), t('history.cannotDeleteBill'));
          }
        },
      },
    ]);
  };

  const shareMessage = async () => {
    if (!bill) return;
    const message =
      bill.message ||
      t('history.billMessage', {
        rent: bill.rent,
        electricityCost: bill.electricityCost,
        totalAmount: bill.totalAmount,
      });
    try {
      await Share.share({ message });
    } catch {
      Alert.alert(t('common.error'), t('history.cannotShareMessage'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center" edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={isDarkColorScheme ? '#60A5FA' : '#2563EB'} />
      </SafeAreaView>
    );
  }

  if (loadError || !bill) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={64} color={isDarkColorScheme ? '#F87171' : '#DC2626'} />
          <Text className="text-foreground text-base mt-4 text-center">
            {loadError || t('bill.notFound')}
          </Text>
          <TouchableOpacity
            className="mt-6 bg-primary rounded-lg px-6 py-3 flex-row items-center"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text className="text-primary-foreground font-semibold ml-2">{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color={isDarkColorScheme ? '#F3F4F6' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{t('bill.detailTitle')}</Text>
        <TouchableOpacity onPress={remove} className="p-2">
          <Ionicons name="trash-outline" size={22} color={isDarkColorScheme ? '#F87171' : '#DC2626'} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5">
          {/* Period + status */}
          <View className="bg-card rounded-2xl p-5 mb-4 border border-border">
            <Text className="text-sm text-muted-foreground">
              {formatPeriod(bill.period, currentLanguage)}
            </Text>
            <Text className="text-3xl font-bold text-primary mt-1">
              {t('history.currency')}{bill.totalAmount}
            </Text>
            <View className="mt-3 flex-row items-center">
              {bill.paidAt ? (
                <View className="flex-row items-center bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 rounded-full">
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text className="text-emerald-700 dark:text-emerald-300 text-xs ml-1">
                    {t('history.paid')}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-full">
                  <Ionicons name="time" size={14} color="#F59E0B" />
                  <Text className="text-amber-700 dark:text-amber-300 text-xs ml-1">
                    {t('history.pendingPayment')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Photo */}
          <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-sm font-semibold text-muted-foreground mb-2">
              {t('bill.photo')}
            </Text>
            {bill.imageViewUrl ? (
              <Image
                source={{ uri: bill.imageViewUrl }}
                className="w-full h-56 rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-32 rounded-xl bg-muted items-center justify-center">
                <Ionicons
                  name="image-outline"
                  size={32}
                  color={isDarkColorScheme ? '#6B7280' : '#9CA3AF'}
                />
                <Text className="text-muted-foreground text-sm mt-2">{t('bill.noPhoto')}</Text>
              </View>
            )}
          </View>

          {/* Breakdown */}
          <View className="bg-card rounded-2xl p-5 mb-4 border border-border">
            <Text className="text-sm font-semibold text-muted-foreground mb-3">
              {t('bill.breakdown')}
            </Text>
            <View className="space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">{t('history.meterReading')}</Text>
                <Text className="text-sm text-card-foreground font-medium">
                  {bill.meterReading} {t('history.unit')}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">{t('history.electricityUsage')}</Text>
                <Text className="text-sm text-card-foreground font-medium">
                  {bill.electricityUsage} {t('history.unit')}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">{t('history.electricityRate')}</Text>
                <Text className="text-sm text-card-foreground font-medium">
                  {t('history.currency')}{bill.electricityRate}/{t('history.unit')}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">
                  {t('history.electricityCalculation')}
                </Text>
                <Text className="text-sm text-card-foreground font-medium">
                  {t('history.currency')}{bill.electricityCost}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">{t('history.rent')}</Text>
                <Text className="text-sm text-card-foreground font-medium">
                  {t('history.currency')}{bill.rent}
                </Text>
              </View>
              <View className="border-t border-border pt-2 mt-1 flex-row justify-between">
                <Text className="text-base font-semibold text-card-foreground">
                  {t('history.totalAmount')}
                </Text>
                <Text className="text-lg font-bold text-primary">
                  {t('history.currency')}{bill.totalAmount}
                </Text>
              </View>
            </View>
            <View className="mt-4">
              <Text className="text-xs text-muted-foreground">
                {t('bill.createdAt')}: {new Date(bill.createdAt).toLocaleString()}
              </Text>
              {bill.paidAt && (
                <Text className="text-xs text-muted-foreground">
                  {t('bill.paidAt')}: {new Date(bill.paidAt).toLocaleString()}
                </Text>
              )}
            </View>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center border-2 border-primary rounded-lg py-3"
              onPress={shareMessage}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color={isDarkColorScheme ? '#60A5FA' : '#2563EB'}
              />
              <Text className="text-primary font-semibold ml-2">{t('common.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center bg-primary rounded-lg py-3"
              onPress={togglePaid}
            >
              <Ionicons name={bill.paidAt ? 'refresh' : 'checkmark'} size={18} color="#FFFFFF" />
              <Text className="text-primary-foreground font-semibold ml-2">
                {bill.paidAt ? t('history.markAsUnpaid') : t('history.markAsPaid')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}
