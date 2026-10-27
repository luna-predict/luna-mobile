import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile, SymptomLog, MenCheckIn, WalletState, PartnerLink,
  ModelRegistryEntry, SharedSnapshot, ChatMessage, LogDay, AppMode,
} from '../types';
import { migrateCheckInsToV2, migrateLogsToV2 } from './migrations';

/**
 * Single typed gateway to local persistence. All app data lives on-device under `luna:`.
 * Secrets (wallet mnemonic) go to SecureStore via SecureVault, never here.
 */
const KEYS = {
  schemaVersion: 'luna:schemaVersion',
  user: 'luna:user',
  logs: 'luna:logs',
  menCheckIns: 'luna:menCheckIns',
  wallet: 'luna:wallet',
  partner: 'luna:partner',
  sharedSnapshot: 'luna:sharedSnapshot',
  models: 'luna:models',
  chatHistory: 'luna:chatHistory',
  flagsDismissed: 'luna:flagsDismissed',
} as const;

const LEGACY_LOGS_KEY = '@lunapredict_symptom_logs';
const SCHEMA_VERSION = 2;

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`[Store] read failed for ${key}`, e);
    return null;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    if (value === null || value === undefined) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Store] write failed for ${key}`, e);
  }
}

export const Store = {
  /** Runs once at app start: brings stored data up to the current schema. */
  async migrate(): Promise<void> {
    const version = (await getJSON<number>(KEYS.schemaVersion)) ?? 0;
    if (version >= SCHEMA_VERSION) return;

    if (version < 1) {
      const legacy = await getJSON<SymptomLog[]>(LEGACY_LOGS_KEY);
      if (legacy && legacy.length > 0) {
        const existing = (await getJSON<SymptomLog[]>(KEYS.logs)) ?? [];
        await setJSON(KEYS.logs, [...legacy, ...existing]);
        await AsyncStorage.removeItem(LEGACY_LOGS_KEY);
      }
    }
    if (version < 2) {
      const logs = (await getJSON<SymptomLog[]>(KEYS.logs)) ?? [];
      await setJSON(KEYS.logs, migrateLogsToV2(logs));
      const checkIns = (await getJSON<MenCheckIn[]>(KEYS.menCheckIns)) ?? [];
      await setJSON(KEYS.menCheckIns, migrateCheckInsToV2(checkIns));
      // Wallets saved by v1 kept the mnemonic in plain storage: drop it here; SecureVault holds it now
      const wallet = await getJSON<WalletState>(KEYS.wallet);
      if (wallet?.mnemonic) {
        const { SecureVault } = await import('./SecureVault');
        await SecureVault.setMnemonic(wallet.mnemonic);
        await setJSON(KEYS.wallet, { ...wallet, mnemonic: null });
      }
    }
    await setJSON(KEYS.schemaVersion, SCHEMA_VERSION);
  },

  // ── User ──
  getUser: () => getJSON<UserProfile>(KEYS.user),
  saveUser: (user: UserProfile) => setJSON(KEYS.user, user),

  // ── Symptom logs (one per day per mode) ──
  getLogs: async (): Promise<SymptomLog[]> => (await getJSON<SymptomLog[]>(KEYS.logs)) ?? [],
  async saveLog(log: SymptomLog): Promise<SymptomLog[]> {
    const logs = await this.getLogs();
    const updated = [...logs.filter(l => !(l.day === log.day && l.mode === log.mode)), log]
      .sort((a, b) => a.day.localeCompare(b.day));
    await setJSON(KEYS.logs, updated);
    return updated;
  },
  async deleteLog(day: LogDay, mode: AppMode): Promise<SymptomLog[]> {
    const updated = (await this.getLogs()).filter(l => !(l.day === day && l.mode === mode));
    await setJSON(KEYS.logs, updated);
    return updated;
  },

  // ── Partner check-ins (one per day) ──
  getMenCheckIns: async (): Promise<MenCheckIn[]> => (await getJSON<MenCheckIn[]>(KEYS.menCheckIns)) ?? [],
  async saveMenCheckIn(entry: MenCheckIn): Promise<MenCheckIn[]> {
    const all = await this.getMenCheckIns();
    const updated = [...all.filter(e => e.day !== entry.day), entry].sort((a, b) => a.day.localeCompare(b.day));
    await setJSON(KEYS.menCheckIns, updated);
    return updated;
  },

  // ── Wallet (labs; mnemonic excluded) ──
  getWallet: () => getJSON<WalletState>(KEYS.wallet),
  saveWallet: (w: WalletState | null) => setJSON(KEYS.wallet, w ? { ...w, mnemonic: null } : null),

  // ── Partner ──
  getPartnerLink: () => getJSON<PartnerLink>(KEYS.partner),
  savePartnerLink: (p: PartnerLink) => setJSON(KEYS.partner, p),
  getSharedSnapshot: () => getJSON<SharedSnapshot>(KEYS.sharedSnapshot),
  saveSharedSnapshot: (s: SharedSnapshot | null) => setJSON(KEYS.sharedSnapshot, s),

  // ── Models ──
  getModelRegistry: async (): Promise<ModelRegistryEntry[]> => (await getJSON<ModelRegistryEntry[]>(KEYS.models)) ?? [],
  saveModelRegistry: (entries: ModelRegistryEntry[]) => setJSON(KEYS.models, entries),

  // ── Chat ──
  getChatHistory: async (): Promise<ChatMessage[]> => (await getJSON<ChatMessage[]>(KEYS.chatHistory)) ?? [],
  saveChatHistory: (msgs: ChatMessage[]) => setJSON(KEYS.chatHistory, msgs.slice(-100)),

  // ── Dismissed info flags (flagId → day dismissed) ──
  getDismissedFlags: async (): Promise<Record<string, LogDay>> => (await getJSON<Record<string, LogDay>>(KEYS.flagsDismissed)) ?? {},
  saveDismissedFlags: (m: Record<string, LogDay>) => setJSON(KEYS.flagsDismissed, m),

  /** Everything the user owns, for export. Never includes secrets. */
  async exportAll() {
    const [user, logs, checkIns] = await Promise.all([this.getUser(), this.getLogs(), this.getMenCheckIns()]);
    return { app: 'LunaPredict', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), user, logs, checkIns };
  },

  /** Full local wipe (Profile → Delete all data). Services reset their memory separately. */
  async wipeAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    await AsyncStorage.removeItem(LEGACY_LOGS_KEY);
  },
};
