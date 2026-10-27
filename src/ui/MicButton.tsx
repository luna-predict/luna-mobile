import React, { useEffect, useRef } from 'react';
import { Pressable, View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useVoiceInput } from '../ai/voice/useVoiceInput';
import { CoachLanguage } from '../types';
import { useReducedMotion } from './index';

/**
 * Tap to start, tap to stop (tap-toggle is easier than hold-to-talk with screen readers).
 * Shows elapsed time while recording and a spinner while Whisper transcribes on-device.
 */
export const MicButton: React.FC<{
  language: CoachLanguage;
  onText: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  size?: number;
  testID?: string;
}> = ({ language, onText, onError, disabled, size = 44, testID }) => {
  const t = useApp().themeColors;
  const { state, start, stop, durationMs } = useVoiceInput(language, onText, onError);
  const pulse = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (state === 'recording' && !reduced) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [state, reduced, pulse]);

  const recording = state === 'recording';
  const label = recording ? 'Stop recording' : state === 'transcribing' ? 'Transcribing' : 'Speak instead of typing';
  const seconds = Math.floor(durationMs / 1000);

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        testID={testID}
        onPress={recording ? stop : start}
        disabled={disabled || state === 'transcribing'}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: state === 'transcribing', disabled: !!disabled }}
        hitSlop={6}
      >
        <Animated.View style={[styles.btn, {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: recording ? t.danger : t.tint,
          transform: [{ scale: pulse }],
          opacity: disabled ? 0.4 : 1,
        }]}>
          {state === 'transcribing'
            ? <ActivityIndicator color={t.primaryStrong} size="small" />
            : recording ? <Square color="#FFFFFF" size={size * 0.38} fill="#FFFFFF" /> : <Mic color={t.primaryStrong} size={size * 0.48} />}
        </Animated.View>
      </Pressable>
      {recording ? <Text style={[styles.timer, { color: t.danger }]} accessibilityLiveRegion="polite">0:{String(seconds).padStart(2, '0')}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  timer: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
