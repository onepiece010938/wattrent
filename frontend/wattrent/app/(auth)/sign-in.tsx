import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { useColorScheme } from '~/lib/useColorScheme';
import { mapAuthError } from '@/lib/authErrors';
import { useGoogleSignIn } from '@/lib/googleAuth';
import { useLineSignIn } from '@/lib/lineAuth';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, mode } = useAuth();
  const { t } = useTranslation();
  const { isDarkColorScheme } = useColorScheme();
  const google = useGoogleSignIn();
  const line = useLineSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [lineBusy, setLineBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError(t('auth.errors.missingFields'));
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // Routing into (tabs) is handled by the redirect in app/_layout.tsx
      // once status flips to signedIn.
    } catch (err) {
      setError(t(mapAuthError(err)));
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await google.signIn();
    } catch (err) {
      setError(t(mapAuthError(err)));
    } finally {
      setGoogleBusy(false);
    }
  };

  const onLine = async () => {
    setError(null);
    setLineBusy(true);
    try {
      await line.signIn();
    } catch (err) {
      setError(t(mapAuthError(err)));
    } finally {
      setLineBusy(false);
    }
  };

  if (mode === 'disabled') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="cloud-offline-outline" size={64} color={isDarkColorScheme ? '#9CA3AF' : '#6B7280'} />
          <Text className="text-foreground text-lg text-center mt-4">{t('auth.notConfigured')}</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2">
            {t('auth.notConfiguredHint')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View className="px-6 py-8">
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-2xl bg-primary/10 justify-center items-center mb-3">
                <Ionicons name="flash" size={32} color={isDarkColorScheme ? '#A5B4FC' : '#4F46E5'} />
              </View>
              <Text className="text-2xl font-bold text-foreground">{t('auth.signInTitle')}</Text>
              <Text className="text-sm text-muted-foreground mt-1">{t('auth.signInSubtitle')}</Text>
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">{t('auth.email')}</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={isDarkColorScheme ? '#6B7280' : '#9CA3AF'}
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">{t('auth.password')}</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="••••••••"
                  placeholderTextColor={isDarkColorScheme ? '#6B7280' : '#9CA3AF'}
                />
              </View>

              {error ? (
                <View className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg p-3">
                  <Text className="text-sm text-red-700 dark:text-red-200">{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                disabled={busy}
                onPress={onSubmit}
                className="bg-primary rounded-lg py-3.5 items-center mt-2"
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-primary-foreground font-semibold text-base">{t('auth.signIn')}</Text>
                )}
              </TouchableOpacity>

              {google.available || line.available ? (
                <>
                  <View className="flex-row items-center my-4">
                    <View className="flex-1 h-px bg-border" />
                    <Text className="px-3 text-xs text-muted-foreground uppercase">{t('auth.orDivider')}</Text>
                    <View className="flex-1 h-px bg-border" />
                  </View>
                  {google.available ? (
                    <TouchableOpacity
                      disabled={googleBusy || !google.ready}
                      onPress={onGoogle}
                      className="border border-border rounded-lg py-3.5 flex-row items-center justify-center bg-card"
                    >
                      {googleBusy ? (
                        <ActivityIndicator color={isDarkColorScheme ? '#E5E7EB' : '#374151'} />
                      ) : (
                        <>
                          <Ionicons name="logo-google" size={18} color={isDarkColorScheme ? '#E5E7EB' : '#374151'} />
                          <Text className="ml-2 text-foreground font-medium text-base">{t('auth.continueWithGoogle')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                  {line.available ? (
                    <TouchableOpacity
                      disabled={lineBusy || !line.ready}
                      onPress={onLine}
                      // LINE brand green (#06C755). White content on green per LINE
                      // brand guidelines for the "primary" sign-in button style.
                      style={{ backgroundColor: '#06C755' }}
                      className="rounded-lg py-3.5 flex-row items-center justify-center mt-3"
                    >
                      {lineBusy ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                          <Text className="ml-2 font-semibold text-base" style={{ color: '#FFFFFF' }}>
                            {t('auth.continueWithLine')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}

              <View className="flex-row justify-between mt-4">
                <TouchableOpacity onPress={() => router.push('/(auth)/reset')}>
                  <Text className="text-primary text-sm">{t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
                  <Text className="text-primary text-sm">{t('auth.createAccount')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
