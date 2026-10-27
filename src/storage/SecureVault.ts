import * as SecureStore from 'expo-secure-store';

/** Secrets live in the OS keystore (Android Keystore / iOS Keychain), never in AsyncStorage. */
const MNEMONIC_KEY = 'luna.wallet.mnemonic';

export const SecureVault = {
  async getMnemonic(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(MNEMONIC_KEY);
    } catch {
      return null;
    }
  },
  async setMnemonic(value: string): Promise<void> {
    await SecureStore.setItemAsync(MNEMONIC_KEY, value);
  },
  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(MNEMONIC_KEY);
    } catch {
      // nothing stored
    }
  },
};
