import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile, SymptomLog, MenCheckIn, WalletState, PartnerLink,
  ModelRegistryEntry, SharedSnapshot, ChatMessage,
} from '../types';

/**
 * Single typed gateway to local persistence.
 * All app data lives on-device under the `luna:` namespace.
 * Production note: swap AsyncStorage for encrypted SQLite/WatermelonDB behind
 * the same interface; the QVAC vector index would live alongside it.
 */
const KEYS = {
  schemaVersion: 'luna:schemaVersion',
  user: 'luna:user',
  logs: 'luna:logs',
  menCheckIns: 'luna:menCheckIns',
  wallet: 'luna:wallet',
  partner: 'luna:partner',
  sharedSnapshot: 'luna:sharedSnapshot',   // what we publish (women) or last received (men)
  models: 'luna:models',
  chatHistory: 'luna:chatHistory',
} as const;

const LEGACY_LOGS_KEY = '@lunapredict_symptom_logs';
const SCHEMA_VERSION = 1;

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
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Store] write failed for ${key}`, e);
  }
}

export const Store = {
  /** Run once at app start: migrates legacy data into the versioned schema. */
  async migrate(): Promise<void> {
    const version = await getJSON<number>(KEYS.schemaVersion);
    if (version === SCHEMA_VERSION) return;

    // v0 → v1: move legacy hackathon logs into the namespaced key
    const legacy = await getJSON<SymptomLog[]>(LEGACY_LOGS_KEY);
    if (legacy && legacy.length > 0) {
      const existing = (await getJSON<SymptomLog[]>(KEYS.logs)) ?? [];
      const merged = [...legacy, ...existing];
      await setJSON(KEYS.logs, merged);
      await AsyncStorage.removeItem(LEGACY_LOGS_KEY);
      console.log(`[Store] migrated ${legacy.length} legacy logs`);
    }
    await setJSON(KEYS.schemaVersion, SCHEMA_VERSION);
  },

  // ── User ──
  getUser: () => getJSON<UserProfile>(KEYS.user),
  saveUser: (user: UserProfile) => setJSON(KEYS.user, user),

  // ── Symptom logs ──
  getLogs: async (): Promise<SymptomLog[]> => (await getJSON<SymptomLog[]>(KEYS.logs)) ?? [],
  async saveLog(log: SymptomLog): Promise<SymptomLog[]> {
    const logs = await this.getLogs();
    // one log per day per mode: replace an existing same-day entry
    const day = log.date.slice(0, 10);
    const filtered = logs.filter(l => !(l.date.slice(0, 10) === day && l.mode === log.mode));
    const updated = [...filtered, log].sort((a, b) => a.date.localeCompare(b.date));
    await setJSON(KEYS.logs, updated);
    return updated;
  },
  async getLogForDay(isoDay: string, mode?: string): Promise<SymptomLog | null> {
    const logs = await this.getLogs();
    return logs.find(l => l.date.slice(0, 10) === isoDay && (!mode || l.mode === mode)) ?? null;
  },

  // ── Men check-ins ──
  getMenCheckIns: async (): Promise<MenCheckIn[]> => (await getJSON<MenCheckIn[]>(KEYS.menCheckIns)) ?? [],
  async saveMenCheckIn(entry: MenCheckIn): Promise<MenCheckIn[]> {
    const all = await this.getMenCheckIns();
    const day = entry.date.slice(0, 10);
    const updated = [...all.filter(e => e.date.slice(0, 10) !== day), entry]
      .sort((a, b) => a.date.localeCompare(b.date));
    await setJSON(KEYS.menCheckIns, updated);
    return updated;
  },

  // ── Wallet ──
  getWallet: () => getJSON<WalletState>(KEYS.wallet),
  saveWallet: (w: WalletState) => setJSON(KEYS.wallet, w),

  // ── Partner ──
  getPartnerLink: () => getJSON<PartnerLink>(KEYS.partner),
  savePartnerLink: (p: PartnerLink) => setJSON(KEYS.partner, p),
  getSharedSnapshot: () => getJSON<SharedSnapshot>(KEYS.sharedSnapshot),
  saveSharedSnapshot: (s: SharedSnapshot) => setJSON(KEYS.sharedSnapshot, s),

  // ── Models ──
  getModelRegistry: async (): Promise<ModelRegistryEntry[]> =>
    (await getJSON<ModelRegistryEntry[]>(KEYS.models)) ?? [],
  saveModelRegistry: (entries: ModelRegistryEntry[]) => setJSON(KEYS.models, entries),

  // ── Chat ──
  getChatHistory: async (): Promise<ChatMessage[]> => (await getJSON<ChatMessage[]>(KEYS.chatHistory)) ?? [],
  saveChatHistory: (msgs: ChatMessage[]) => setJSON(KEYS.chatHistory, msgs.slice(-100)),

  /** Full local wipe (Profile → Delete all data) */
  async wipeAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    await AsyncStorage.removeItem(LEGACY_LOGS_KEY);
  },
};
