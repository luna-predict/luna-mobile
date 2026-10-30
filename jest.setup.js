// Tell React this is a test environment so act() warnings are accurate.
global.IS_REACT_ACT_ENVIRONMENT = true;

/* Native pieces that can't run under Jest. Everything else (screens, context, domain, coach
   pipeline in demo mode) runs for real. */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// The QVAC runtime is native (react-native-bare-kit); without it the app runs the demo engine.
jest.mock('@qvac/sdk', () => { throw new Error('QVAC native runtime not available in Jest'); });

jest.mock('expo-audio', () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), uri: null }),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0, metering: undefined }),
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })) },
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(async () => {}),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(async () => {}),
  resume: jest.fn(async () => {}),
  isSpeakingAsync: jest.fn(async () => false),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async k => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k, v) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async k => { store.delete(k); }),
  };
});

jest.mock('expo-file-system', () => ({
  Paths: { availableDiskSpace: 32 * 1024 ** 3, cache: '/cache', document: { uri: 'file:///doc' } },
  File: jest.fn().mockImplementation(() => ({ create: jest.fn(), write: jest.fn(), delete: jest.fn(), exists: false, uri: 'file:///cache/x.json' })),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isInternetReachable: true })),
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
}));

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

// SafeAreaProvider waits for native insets; use the library's own Jest mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
