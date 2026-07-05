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

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { t } = useTranslation();
  const { isDarkColorScheme } = useColorScheme();
  const google = useGoogleSignIn();
  const line = useLineSignIn();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    if (password.length < 8) {
      setError(t('auth.errors.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await signUp(email.trim(), password, displayName.trim() || undefined);
      // _layout.tsx redirects to (tabs) once status flips to signedIn.
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View className="px-6 py-8">
            <TouchableOpacity onPress={() => router.back()} className="self-start mb-4">
              <Ionicons name="chevron-back" size={28} color={isDarkColorScheme ? '#E5E7EB' : '#374151'} />
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-foreground mb-1">{t('auth.signUpTitle')}</Text>
            <Text className="text-sm text-muted-foreground mb-6">{t('auth.signUpSubtitle')}</Text>

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">{t('auth.displayName')}</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('auth.displayNamePlaceholder')}
                  placeholderTextColor={isDarkColorScheme ? '#6B7280' : '#9CA3AF'}
                />
              </View>

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
                  autoComplete="password-new"
                  placeholder={t('auth.passwordHint')}
                  placeholderTextColor={isDarkColorScheme ? '#6B7280' : '#9CA3AF'}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-2">{t('auth.confirmPassword')}</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-card text-base"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoComplete="password-new"
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
                  <Text className="text-primary-foreground font-semibold text-base">{t('auth.signUp')}</Text>
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
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
