// ─── Core domain types shared across the app ───

export type Sex = 'female' | 'male';

/** A calendar day in the user's local time zone: 'YYYY-MM-DD'. Never parse as UTC. */
export type LogDay = string;

/** Women-side tracking goals */
export type AppMode = 'period' | 'conceive' | 'pregnancy' | 'perimenopause';

/** Language Luna replies in. 'en' runs MedPsy directly; others go through TranslatePsy. */
export type CoachLanguage = 'en' | 'sw';

export type VoiceOutput = 'off' | 'system';

/** What a linked partner is allowed to see (chosen by the woman) */
export interface SharingPreferences {
  sharePhase: boolean;        // current cycle phase + day
  sharePredictions: boolean;  // next period / fertile window dates
  shareMood: boolean;         // mood + energy from daily logs
  shareSymptoms: boolean;     // symptom categories (not notes)
  sharePregnancy?: boolean;   // pregnancy week (default on)
}

export interface NotificationPreferences {
  periodReminders: boolean;
  dailyCheckIn: boolean;
  insights: boolean;
  checkInTime?: string;          // 'HH:mm', default 20:00
}

export interface PregnancyInfo {
  lmp: LogDay;                   // first day of last menstrual period (or equivalent)
  dueDate: LogDay;
  source: 'weeks' | 'lmp' | 'dueDate';
  endedAt?: LogDay;
  outcome?: 'birth' | 'loss';
}

export interface UserProfile {
  id: string;
  name: string;
  birthYear: number;
  sex: Sex;
  mode: AppMode;                 // active goal (women); men keep 'period' as passive default
  onboardingComplete: boolean;
  createdAt: string;             // ISO instant
  // Women-side cycle seed data collected at onboarding
  avgCycleLength: number;        // days, default 28
  avgPeriodLength: number;       // days, default 5
  lastPeriodStart?: LogDay;
  cycleRegularity?: 'regular' | 'irregular' | 'unknown';
  // Pregnancy mode
  dueDate?: LogDay;              // kept for back-compat; pregnancy.dueDate is canonical
  pregnancy?: PregnancyInfo;
  // Perimenopause mode
  hrtStatus?: string;
  notifications: NotificationPreferences;
  sharing: SharingPreferences;
  language?: CoachLanguage;
  voiceOutput?: VoiceOutput;
  labs?: boolean;                // shows simulated P2P tiers + wallet
}

// ─── Daily logging ───

export interface KickSession {
  start: string;                 // ISO instant
  end: string;                   // ISO instant
  count: number;
}

export interface SymptomLog {
  id: string;
  /** Local calendar day this log describes (schema v2). */
  day: LogDay;
  /** Kept equal to `day` for older readers. */
  date: string;
  /** ISO instant the log was saved. */
  loggedAt: string;
  symptoms: string[];
  mood: string | null;
  energy: string | null;
  flow: string | null;           // spotting | light | medium | heavy | null
  periodStart?: boolean;         // explicit "my period started this day"
  periodEnd?: boolean;           // explicit "my period ended this day"
  bbt?: number | null;           // basal body temperature °C (conceive mode)
  cervicalMucus?: string | null; // dry | sticky | creamy | eggwhite
  opkResult?: 'positive' | 'negative' | null;
  kicksCount?: number | null;    // legacy daily counter
  kickSessions?: KickSession[];  // pregnancy mode
  hotFlashCount?: number | null; // perimenopause mode
  sleepQuality?: string | null;
  notes: string;
  mode: AppMode;
}

/** Men-side personal wellness check-in (their own data, never the partner's) */
export interface MenCheckIn {
  id: string;
  day: LogDay;
  date: string;
  loggedAt: string;
  mood: string | null;
  energy: string | null;
  stress: string | null;
  notes: string;
}

// ─── Engine outputs ───

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export type CycleConfidence = 'seed' | 'learning' | 'established' | 'irregular';

/** on_track: not due yet · late: period overdue for an active tracker · assumed: seed-only user, cycles rolled forward · overdue_long: very late · no_data: nothing to go on */
export type CycleTrackStatus = 'on_track' | 'late' | 'assumed' | 'overdue_long' | 'no_data';

export type OvulationSource = 'calendar' | 'opk' | 'mucus' | 'bbt';
export type OvulationStatus = 'predicted' | 'likely' | 'confirmed';

export interface OvulationEvidence {
  day: LogDay;
  source: OvulationSource;
  status: OvulationStatus;
}

export interface CycleRecord {
  start: LogDay;
  length: number;                // days until the next start
  periodLength: number | null;
  suspectedMissedLog: boolean;
}

export interface CycleStatus {
  status: CycleTrackStatus;
  daysLate: number;              // > 0 only when late/overdue_long
  cycleDay: number;
  cycleLength: number;
  periodLength: number;
  phase: CyclePhase;
  phaseLabel: string;
  lastPeriodStart: LogDay | null;
  nextPeriodDate: LogDay;
  nextPeriodRange: { start: LogDay; end: LogDay };
  daysUntilPeriod: number;
  ovulationDate: LogDay;
  ovulationSource: OvulationSource;
  ovulationStatus: OvulationStatus;
  daysUntilOvulation: number;
  fertileWindowStart: LogDay;
  fertileWindowEnd: LogDay;
  peakDays: LogDay[];
  inFertileWindow: boolean;
  periodDates: LogDay[];         // predicted period days
  fertileDates: LogDay[];        // predicted fertile days
  confidence: CycleConfidence;
  cyclesTracked: number;         // valid cycles used for the estimate
  spread: number | null;         // longest − shortest recent cycle
  sigma: number;                 // ± days shown as the prediction range
  history: CycleRecord[];
}

export interface PregnancyStatus {
  week: number;
  day: number;
  gestationDays: number;
  label: string;                 // "39w 4d"
  trimester: 1 | 2 | 3;
  lmp: LogDay;
  dueDate: LogDay;
  daysUntilDue: number;
  postDates: boolean;
  babySize: string;
}

export type PeriStage = 'not_enough_data' | 'no_transition_signs' | 'early_transition' | 'late_transition' | 'postmenopause';

export interface PeriStatus {
  stage: PeriStage;
  stageLabel: string;
  lastBleedDay: LogDay | null;
  daysSinceLastBleed: number | null;
  recentCycleLengths: number[];
  spread: number | null;
  hotFlashAvg7: number | null;
  hotFlashAvg30: number | null;
  poorSleepNights7: number;
}

export type FlagSeverity = 'info' | 'warn' | 'urgent';

export interface HealthFlag {
  id: string;
  severity: FlagSeverity;
  title: string;
  body: string;
}

// ─── AI model management ───

export type ModelCategory = 'llm' | 'translation' | 'speech';

export interface ModelInfo {
  id: string;
  name: string;
  family: string;
  category: ModelCategory;
  parameters: string;
  quantization: string;
  sizeBytes: number;             // download size
  description: string;
  capabilities: string[];
  /** Key of the @qvac/sdk registry constant that loads this model. */
  sdkConstant: string;
  sdkModelType: 'llamacpp-completion' | 'whispercpp-transcription';
  medical: boolean;
  role: 'coach' | 'coach-light' | 'translator' | 'asr';
}

export type ModelDownloadState =
  | { status: 'not_downloaded' }
  | { status: 'downloading'; progress: number; downloadedBytes?: number; totalBytes?: number }
  | { status: 'paused'; progress: number }
  | { status: 'downloaded'; downloadedAt: string }
  | { status: 'error'; message: string };

export interface ModelRegistryEntry {
  modelId: string;
  state: ModelDownloadState;
  active: boolean;               // currently selected as the coach model
}

// ─── Wallet (WDK, labs) ───

export type WalletNetwork = 'testnet' | 'mainnet';

export interface WalletState {
  initialized: boolean;
  address: string | null;
  mnemonic: string | null;       // in memory only; persisted in SecureStore
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

export type PartnerRole = 'sharer' | 'viewer';

export interface PartnerLink {
  linked: boolean;
  role: PartnerRole | null;
  inviteCode: string | null;
  partnerName: string | null;
  linkedAt: string | null;
  swarmTopic: string | null;
  lastSyncAt: string | null;
}

/** The snapshot a woman publishes to her linked partner (respects SharingPreferences) */
export interface SharedSnapshot {
  updatedAt: string;
  sharerName: string;
  mode: AppMode;
  /** True when generated locally because no real peer data exists (demo). */
  synthetic?: boolean;
  phase?: CyclePhase;
  phaseLabel?: string;
  cycleDay?: number;
  daysUntilPeriod?: number;
  nextPeriodDate?: string;
  inFertileWindow?: boolean;
  pregnancyWeek?: number;
  recentDay?: LogDay;
  recentMood?: string | null;
  recentEnergy?: string | null;
  recentSymptoms?: string[];
}

// ─── Chat ───

export type ChatMessageStatus = 'done' | 'stopped' | 'cut_short' | 'error' | 'emergency' | 'streaming';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** English original when the reply was machine-translated. */
  original?: string;
  language?: CoachLanguage;
  engine?: 'qvac' | 'demo';
  status?: ChatMessageStatus;
  tokensPerSecond?: number;
  tier?: 'local' | 'p2p';
  timestamp?: string;
}
