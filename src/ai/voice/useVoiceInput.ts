import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync,
} from 'expo-audio';
import { coachEngine } from '../engine';
import { ModelManager } from '../../services/ModelManager';
import { CoachLanguage } from '../../types';

/**
 * Voice input: record on-device (m4a, 16 kHz mono), then Whisper turns it into
 * text via QVAC. Audio never leaves the phone. Auto-stops at 60 s.
 * Supports pause, resume, cancel, and stop.
 */

const MAX_MS = 60_000;

export type VoiceState = 'idle' | 'recording' | 'paused' | 'transcribing';

export function voiceAvailable(): { ok: boolean; reason?: string } {
  if (coachEngine.kind() !== 'qvac') return { ok: false, reason: 'Voice needs the LunaPredict app build (not Expo Go).' };
  if (!ModelManager.getModelForRole('asr')) return { ok: false, reason: 'Download "Voice input" on the AI Models screen first.' };
  return { ok: true };
}

export function useVoiceInput(language: CoachLanguage, onText: (text: string) => void, onError: (msg: string) => void) {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  });
  const status = useAudioRecorderState(recorder, 250);
  const [state, setState] = useState<VoiceState>('idle');
  const stopping = useRef(false);

  const start = useCallback(async () => {
    const avail = voiceAvailable();
    if (!avail.ok) { onError(avail.reason!); return; }
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) { onError('Microphone permission is needed for voice input. You can allow it in Settings.'); return; }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      stopping.current = false;
      setState('recording');
    } catch (e) {
      onError('Could not start the microphone.');
      setState('idle');
    }
  }, [recorder, onError]);

  const pause = useCallback(() => {
    if (state !== 'recording') return;
    try {
      recorder.pause();
      setState('paused');
    } catch {
      // ignore
    }
  }, [recorder, state]);

  const resume = useCallback(() => {
    if (state !== 'paused') return;
    try {
      recorder.record();
      setState('recording');
    } catch {
      // ignore
    }
  }, [recorder, state]);

  const cancel = useCallback(async () => {
    if (state !== 'recording' && state !== 'paused') return;
    stopping.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // ignore
    } finally {
      stopping.current = false;
      setState('idle');
    }
  }, [recorder, state]);

  const stop = useCallback(async () => {
    if (stopping.current || (state !== 'recording' && state !== 'paused')) return;
    stopping.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording');
      setState('transcribing');
      const text = await coachEngine.transcribe(uri, language);
      if (text) onText(text);
      else onError('I could not hear any words. Try again a little closer to the phone.');
    } catch (e) {
      onError('Could not transcribe that recording. Please try again.');
    } finally {
      setState('idle');
    }
  }, [recorder, state, language, onText, onError]);

  // Auto-stop at the limit
  useEffect(() => {
    if (state === 'recording' && status.durationMillis >= MAX_MS) stop();
  }, [state, status.durationMillis, stop]);

  return {
    state,
    start,
    stop,
    pause,
    resume,
    cancel,
    durationMs: status.durationMillis,
    metering: status.metering,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
  };
}
