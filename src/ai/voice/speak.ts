import * as Speech from 'expo-speech';
import { CoachLanguage } from '../../types';

/** Read an answer aloud with the phone's own text-to-speech engine (no download). */
export function speak(text: string, language: CoachLanguage, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text.replace(/\(Shown in English[^)]*\)/g, ''), {
    language: language === 'sw' ? 'sw-KE' : 'en-US',
    rate: 0.98,
    onDone,
    onStopped: onDone,
    onError: () => onDone?.(),
  });
}

export function stopSpeaking() {
  Speech.stop();
}
