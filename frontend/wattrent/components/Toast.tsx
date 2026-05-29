// Minimal toast provider — auto-dismissing banner pinned to the bottom of the
// screen. Use for non-blocking success / info notifications (replaces noisy
// Alert.alert for "saved" / "copied" style feedback).
//
// Usage:
//   const { showToast } = useToast();
//   showToast({ message: 'Saved', kind: 'success' });

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastKind = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  kind?: ToastKind;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op so screens never crash if provider is missing
    return { showToast: () => undefined };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<ToastKind>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (opts: ToastOptions) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setMessage(opts.message);
      setKind(opts.kind ?? 'info');
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      const duration = opts.durationMs ?? 2500;
      hideTimerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setVisible(false);
        });
      }, duration);
    },
    [opacity],
  );

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const colors = colorsFor(kind);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 100,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <Animated.View
            style={{
              opacity,
              backgroundColor: colors.bg,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              maxWidth: '90%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 6,
            }}
          >
            <Ionicons name={colors.icon} size={18} color="#FFFFFF" />
            <Text
              style={{
                color: '#FFFFFF',
                marginLeft: 8,
                fontSize: 14,
                fontWeight: '500',
              }}
              numberOfLines={2}
            >
              {message}
            </Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

function colorsFor(kind: ToastKind): { bg: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (kind) {
    case 'success':
      return { bg: '#16A34A', icon: 'checkmark-circle' };
    case 'error':
      return { bg: '#DC2626', icon: 'alert-circle' };
    case 'info':
    default:
      return { bg: '#2563EB', icon: 'information-circle' };
  }
}
