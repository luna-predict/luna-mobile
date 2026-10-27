import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Non-blocking feedback that replaces success Alerts. Announced to screen readers. */

type ToastKind = 'success' | 'info' | 'error';
interface ToastApi { show: (message: string, kind?: ToastKind) => void }

const ToastContext = createContext<ToastApi>({ show: () => {} });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    AccessibilityInfo.announceForAccessibility(message);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setToast(null));
    }, 2400);
  }, [opacity]);

  const bg = toast?.kind === 'error' ? '#B91C1C' : toast?.kind === 'info' ? '#1E293B' : '#047857';

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { opacity, bottom: insets.bottom + 88, backgroundColor: bg }]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: 16, right: 16, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  text: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
