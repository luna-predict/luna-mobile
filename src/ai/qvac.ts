import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Lazy access to @qvac/sdk. The SDK needs native code (react-native-bare-kit + the QVAC
 * worker bundle generated at prebuild), so it is only available in a development or
 * release build — never in Expo Go. Requiring it lazily keeps Expo Go working in demo mode.
 */

type QvacSdk = typeof import('@qvac/sdk');

let cached: QvacSdk | null | undefined;
let unavailableReason: string | null = null;

export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function getQvac(): QvacSdk | null {
  if (cached !== undefined) return cached;
  if (isExpoGo()) {
    unavailableReason = 'Running in Expo Go — install the LunaPredict build to use on-device AI.';
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@qvac/sdk') as QvacSdk;
  } catch (e) {
    unavailableReason = `QVAC runtime not available: ${e instanceof Error ? e.message : String(e)}`;
    cached = null;
  }
  return cached;
}

export function qvacUnavailableReason(): string | null {
  getQvac();
  return unavailableReason;
}

/** Resolve a registry constant (e.g. HEALTHCARE_1_7B_MEDICAL_Q4_K_M) from the SDK by name. */
export function registryModel(sdk: QvacSdk, constant: string): unknown {
  const value = (sdk as unknown as Record<string, unknown>)[constant];
  if (!value) throw new Error(`Model ${constant} is not in this QVAC SDK version`);
  return value;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
