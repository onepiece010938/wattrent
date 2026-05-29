// Banner pinned to the top of the app when any dev-mode toggle is active.
// Visible only in __DEV__ builds.

import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getDevMode,
  isAnyDevToggleActive,
  isDevModeAvailable,
  subscribeDevMode,
  type DevModeState,
} from '@/lib/devMode';

export default function DevModeBanner() {
  const [state, setState] = useState<DevModeState>(getDevMode());

  useEffect(() => {
    if (!isDevModeAvailable()) return;
    const unsub = subscribeDevMode(setState);
    return () => {
      unsub();
    };
  }, []);

  if (!isDevModeAvailable() || !isAnyDevToggleActive(state)) return null;

  const labels: string[] = [];
  if (state.skipOcr) labels.push('OCR mock');
  if (state.forceMockHistory) labels.push('History mock');
  if (state.apiUrlOverride) labels.push(`API: ${state.apiUrlOverride}`);

  return (
    <View
      style={{
        backgroundColor: '#F59E0B',
        paddingHorizontal: 12,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons name="construct" size={14} color="#FFFFFF" />
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: '600',
        }}
        numberOfLines={1}
      >
        DEV · {labels.join(' · ')}
      </Text>
    </View>
  );
}
