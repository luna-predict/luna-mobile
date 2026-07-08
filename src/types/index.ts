// ─── Core domain types shared across the app ───

export type Sex = 'female' | 'male';

/** Women-side tracking goals */
export type AppMode = 'period' | 'conceive' | 'pregnancy' | 'perimenopause';

/** What a linked partner is allowed to see (chosen by the woman) */
export interface SharingPreferences {
  sharePhase: boolean;        // current cycle phase + day
  sharePredictions: boolean;  // next period / fertile window dates
  shareMood: boolean;         // mood + energy from daily logs
  shareSymptoms: boolean;     // symptom categories (not notes)
}

export interface NotificationPreferences {
  periodReminders: boolean;
  dailyCheckIn: boolean;
  insights: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  birthYear: number;
  sex: Sex;
  mode: AppMode;                 // active goal (women); men keep 'period' as passive default
  onboardingComplete: boolean;
  createdAt: string;             // ISO date
  // Women-side cycle seed data collected at onboarding
  avgCycleLength: number;        // days, default 28
  avgPeriodLength: number;       // days, default 5
  lastPeriodStart?: string;      // ISO date
  cycleRegularity?: 'regular' | 'irregular' | 'unknown';
  // Pregnancy mode
  dueDate?: string;              // ISO date
  // Perimenopause mode
  hrtStatus?: string;
  notifications: NotificationPreferences;
  sharing: SharingPreferences;
}

// ─── Daily logging ───

export interface SymptomLog {
  id: string;
  date: string;                  // ISO date (day precision, local)
  symptoms: string[];
  mood: string | null;
  energy: string | null;
  flow: string | null;           // spotting | light | medium | heavy | null
  bbt?: number | null;           // basal body temperature (conceive mode)
  cervicalMucus?: string | null; // conceive mode
  opkResult?: 'positive' | 'negative' | null;
  kicksCount?: number | null;    // pregnancy mode
  hotFlashCount?: number | null; // perimenopause mode
  sleepQuality?: string | null;
  notes: string;
  mode: AppMode;
}

/** Men-side personal wellness check-in (their own data, never the partner's) */
export interface MenCheckIn {
  id: string;
  date: string;
  mood: string | null;
  energy: string | null;
  stress: string | null;
  notes: string;
}

// ─── Cycle engine output ───

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface CycleStatus {
  cycleDay: number;
  cycleLength: number;
  phase: CyclePhase;
  phaseLabel: string;
  nextPeriodDate: string;        // ISO date
  daysUntilPeriod: number;
  ovulationDate: string;         // ISO date
  daysUntilOvulation: number;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  inFertileWindow: boolean;
  periodDates: string[];         // predicted period days for current + next cycle (ISO)
  fertileDates: string[];        // predicted fertile days (ISO)
  confidence: 'seed' | 'learning' | 'established'; // seed = onboarding only, learning = <3 cycles, established = 3+
}

export interface PregnancyStatus {
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
  dueDate: string;
  daysUntilDue: number;
  babySize: string;              // fun size comparison
}

// ─── AI model management ───

export type ModelCategory = 'llm' | 'speech' | 'translation' | 'vision';

export interface ModelInfo {
  id: string;
  name: string;
  family: string;                // MedPsy | Whisper | Bergamot ...
  category: ModelCategory;
  parameters: string;            // "1.7B"
  quantization: string;          // "Q4_0 GGUF"
  sizeBytes: number;             // download size
  minRamBytes: number;           // minimum device RAM
  description: string;
  capabilities: string[];
  recommended?: boolean;         // recommended for this device (computed)
}

export type ModelDownloadState =
  | { status: 'not_downloaded' }
  | { status: 'downloading'; progress: number } // 0..1
  | { status: 'downloaded'; downloadedAt: string; path: string }
  | { status: 'error'; message: string };

export interface ModelRegistryEntry {
  modelId: string;
  state: ModelDownloadState;
  active: boolean;               // currently selected for local inference
}

// ─── Wallet (WDK) ───

export type WalletNetwork = 'testnet' | 'mainnet';

export interface WalletState {
  initialized: boolean;
  address: string | null;
  mnemonic: string | null;       // stored locally only; production: WDK secret-manager / secure enclave
  network: WalletNetwork;
  balanceUsdt: number;
  totalSpentUsdt: number;
  txHistory: WalletTx[];
}

export interface WalletTx {
  id: string;
  date: string;
  type: 'stream_payment' | 'topup';
  amountUsdt: number;
  peerId?: string;
  memo: string;
}

// ─── Partner linking (Pears / Hyperswarm pairing) ───

export type PartnerRole = 'sharer' | 'viewer'; // sharer = woman sharing data, viewer = partner

export interface PartnerLink {
  linked: boolean;
  role: PartnerRole | null;
  inviteCode: string | null;     // z32-style Pears pairing invite
  partnerName: string | null;
  linkedAt: string | null;
  swarmTopic: string | null;     // derived Hyperswarm topic for the pair
  lastSyncAt: string | null;
}

/** The snapshot a woman publishes to her linked partner (respects SharingPreferences) */
export interface SharedSnapshot {
  updatedAt: string;
  sharerName: string;
  mode: AppMode;
  phase?: CyclePhase;
  phaseLabel?: string;
  cycleDay?: number;
  daysUntilPeriod?: number;
  nextPeriodDate?: string;
  inFertileWindow?: boolean;
  pregnancyWeek?: number;
  recentMood?: string | null;
  recentEnergy?: string | null;
  recentSymptoms?: string[];
}

// ─── Chat ───

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tier?: 'local' | 'p2p';
  timestamp?: string;
}
