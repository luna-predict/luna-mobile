import React, { useEffect, useRef } from 'react';
import { Pressable, View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { Mic, Square, Pause, Play, X, Check } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useVoiceInput } from '../ai/voice/useVoiceInput';
import { CoachLanguage } from '../types';
import { useReducedMotion } from './index';

export const MicButton: React.FC<{
  language: CoachLanguage;
  onText: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  size?: number;
  testID?: string;
  expanded?: boolean;
}> = ({ language, onText, onError, disabled, size = 44, testID, expanded = false }) => {
  const t = useApp().themeColors;
  const { state, start, stop, pause, resume, cancel, durationMs, isRecording, isPaused } = useVoiceInput(language, onText, onError);
  const pulse = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (isRecording && !reduced) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [isRecording, reduced, pulse]);

  const active = isRecording || isPaused;
  const seconds = Math.floor(durationMs / 1000);
  const timeFormatted = `0:${String(seconds).padStart(2, '0')}`;

  // When active (recording or paused), show full recording controls
  if (active) {
    return (
      <View style={[styles.activeBar, { backgroundColor: t.surface, borderColor: isPaused ? t.warning : t.danger }]}>
        {/* Cancel button */}
        <Pressable
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          hitSlop={8}
          style={[styles.controlBtn, { backgroundColor: t.card }]}
        >
          <X color={t.danger} size={18} />
        </Pressable>

        {/* Live Timer & Wave indicator */}
        <View style={styles.timerWrap}>
          <Animated.View
            style={[
              styles.redDot,
              {
                backgroundColor: isPaused ? t.warning : t.danger,
                transform: [{ scale: isPaused ? 1 : pulse }],
              },
            ]}
          />
          <Text style={[styles.timerText, { color: isPaused ? t.warning : t.danger }]} accessibilityLiveRegion="polite">
            {isPaused ? `Paused ${timeFormatted}` : timeFormatted}
          </Text>
        </View>

        {/* Pause / Resume button */}
        <Pressable
          onPress={isPaused ? resume : pause}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'}
          hitSlop={8}
          style={[styles.controlBtn, { backgroundColor: t.card }]}
        >
          {isPaused ? <Play color={t.text} size={16} fill={t.text} /> : <Pause color={t.text} size={16} fill={t.text} />}
        </Pressable>

        {/* Finish / Send button */}
        <Pressable
          testID={testID ? `${testID}-done` : undefined}
          onPress={stop}
          accessibilityRole="button"
          accessibilityLabel="Done recording. Transcribe words"
          hitSlop={8}
          style={[styles.controlBtn, { backgroundColor: t.primaryStrong }]}
        >
          <Check color="#FFFFFF" size={18} />
        </Pressable>
      </View>
    );
  }

  // Idle or Transcribing
  const label = state === 'transcribing' ? 'Transcribing…' : 'Speak instead of typing';

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        testID={testID}
        onPress={start}
        disabled={disabled || state === 'transcribing'}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: state === 'transcribing', disabled: !!disabled }}
        hitSlop={6}
      >
        <Animated.View style={[styles.btn, {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: t.tint,
          opacity: disabled ? 0.4 : 1,
        }]}>
          {state === 'transcribing'
            ? <ActivityIndicator color={t.primaryStrong} size="small" />
            : <Mic color={t.primaryStrong} size={size * 0.48} />}
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  activeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 42,
  },
});
