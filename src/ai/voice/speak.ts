import * as Speech from 'expo-speech';
import { CoachLanguage } from '../../types';

/** Read an answer aloud with the phone's own text-to-speech engine (no download). */
export function speak(text: string, language: CoachLanguage, onDone?: () => void) {
  if (Speech.stop) Speech.stop();
  Speech.speak(text.replace(/\(Shown in English[^)]*\)/g, ''), {
    language: language === 'sw' ? 'sw-KE' : 'en-US',
    rate: 0.98,
    onDone,
    onStopped: onDone,
    onError: () => onDone?.(),
  });
}

export async function pauseSpeaking(): Promise<void> {
  if (typeof Speech.pause === 'function') {
    await Speech.pause();
  }
}

export async function resumeSpeaking(): Promise<void> {
  if (typeof Speech.resume === 'function') {
    await Speech.resume();
  }
}

export async function stopSpeaking(): Promise<void> {
  if (typeof Speech.stop === 'function') {
    await Speech.stop();
  }
}

export async function isSpeaking(): Promise<boolean> {
  if (typeof Speech.isSpeakingAsync === 'function') {
    return Speech.isSpeakingAsync();
  }
  return false;
}
