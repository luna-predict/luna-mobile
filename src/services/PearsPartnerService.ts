import * as Crypto from 'expo-crypto';
import { PartnerLink, SharedSnapshot, UserProfile, SymptomLog, CycleStatus, PregnancyStatus, LogDay } from '../types';
import { Store } from '../storage/Store';
import { addDays } from '../domain';

/**
 * Partner linking, modelled on Pears building blocks (BlindPairing invite → Hyperswarm topic →
 * read-only replicated snapshot).
 *
 * DEMO TRANSPORT: there is no network yet. Snapshots persist locally; a partner phone with no
 * local snapshot gets a synthetic one marked `synthetic: true`, and the UI labels it "Demo data".
 * Real sync needs a Bare worklet (react-native-bare-kit, already shipped with QVAC) running
 * BlindPairing + Hyperswarm — see docs/archi-docs/05-navigation-and-user-flows.md §5.5.
 */

const Z32_ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';
const EMPTY_LINK: PartnerLink = {
  linked: false, role: null, inviteCode: null, partnerName: null,
  linkedAt: null, swarmTopic: null, lastSyncAt: null,
};

async function randomZ32(length: number): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes).map(b => Z32_ALPHABET[b % 32]).join('');
}

export function formatInviteCode(raw: string): string {
  return raw.replace(/(.{4})/g, '$1-').replace(/-$/, '').toLowerCase();
}

export function isValidInviteCode(code: string): boolean {
  const raw = code.replace(/-/g, '').trim().toLowerCase();
  return raw.length === 12 && [...raw].every(c => Z32_ALPHABET.includes(c));
}

async function topicFromCode(code: string): Promise<string> {
  const raw = code.replace(/-/g, '').trim().toLowerCase();
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `lunapredict:pairing:${raw}`);
  return digest.slice(0, 52);
}

/**
 * The exact snapshot a partner would receive. The Partner screen preview renders from this
 * same function, so what she sees is what is sent. Mood/symptoms only from the last 2 days.
 */
export function buildSnapshot(
  user: UserProfile,
  cycle: CycleStatus | null,
  pregnancy: PregnancyStatus | null,
  logs: SymptomLog[],
  today: LogDay,
): SharedSnapshot {
  const prefs = user.sharing;
  const recent = [...logs].filter(l => l.day <= today && l.day >= addDays(today, -1)).sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
  return {
    updatedAt: new Date().toISOString(),
    sharerName: user.name,
    mode: user.mode,
    ...(prefs.sharePhase && cycle ? { phase: cycle.phase, phaseLabel: cycle.phaseLabel, cycleDay: cycle.cycleDay } : {}),
    ...(prefs.sharePredictions && cycle ? {
      daysUntilPeriod: cycle.daysUntilPeriod,
      nextPeriodDate: cycle.nextPeriodDate,
      inFertileWindow: cycle.inFertileWindow,
    } : {}),
    ...(pregnancy && prefs.sharePregnancy !== false ? { pregnancyWeek: pregnancy.week } : {}),
    ...(prefs.shareMood && recent ? { recentDay: recent.day, recentMood: recent.mood, recentEnergy: recent.energy } : {}),
    ...(prefs.shareSymptoms && recent ? { recentDay: recent.day, recentSymptoms: recent.symptoms } : {}),
  };
}

class PearsPartnerServiceImpl {
  private link: PartnerLink | null = null;

  async init(): Promise<PartnerLink> {
    if (!this.link) this.link = (await Store.getPartnerLink()) ?? { ...EMPTY_LINK };
    return this.link;
  }

  getLink(): PartnerLink | null {
    return this.link;
  }

  /** Forget in-memory state (used by Delete all data). */
  reset(): void {
    this.link = null;
  }

  /** Woman-side: mint a pairing invite the partner types into their app. */
  async generateInvite(): Promise<string> {
    const code = formatInviteCode(await randomZ32(12));
    this.link = { ...EMPTY_LINK, role: 'sharer', inviteCode: code, swarmTopic: await topicFromCode(code) };
    await Store.savePartnerLink(this.link);
    return code;
  }

  /** Woman-side: partner completed pairing (production: the BlindPairing callback). */
  async confirmPartnerJoined(partnerName: string): Promise<PartnerLink> {
    if (!this.link || this.link.role !== 'sharer') throw new Error('No pending invite');
    this.link = { ...this.link, linked: true, partnerName, linkedAt: new Date().toISOString() };
    await Store.savePartnerLink(this.link);
    return this.link;
  }

  /** Partner-side: join with the code she shared. */
  async linkWithCode(code: string, sharerNameFallback = 'Your partner'): Promise<PartnerLink> {
    if (!isValidInviteCode(code)) {
      throw new Error('That code doesn\'t look right. It should be 12 characters, like xxxx-xxxx-xxxx.');
    }
    this.link = {
      linked: true,
      role: 'viewer',
      inviteCode: formatInviteCode(code.replace(/-/g, '')),
      partnerName: sharerNameFallback,
      linkedAt: new Date().toISOString(),
      swarmTopic: await topicFromCode(code),
      lastSyncAt: null,
    };
    await Store.savePartnerLink(this.link);
    return this.link;
  }

  async unlink(): Promise<void> {
    this.link = { ...EMPTY_LINK };
    await Store.savePartnerLink(this.link);
    await Store.saveSharedSnapshot(null);
  }

  /** Woman-side: write the filtered snapshot to the (local, demo) replicated store. */
  async publishSnapshot(
    user: UserProfile,
    cycle: CycleStatus | null,
    pregnancy: PregnancyStatus | null,
    logs: SymptomLog[],
    today: LogDay,
  ): Promise<SharedSnapshot | null> {
    if (!this.link?.linked || this.link.role !== 'sharer') return null;
    const snapshot = buildSnapshot(user, cycle, pregnancy, logs, today);
    await Store.saveSharedSnapshot(snapshot);
    this.link.lastSyncAt = snapshot.updatedAt;
    await Store.savePartnerLink(this.link);
    return snapshot;
  }

  /**
   * Partner-side: latest snapshot. Uses a locally replicated snapshot when present (same-device
   * demo); otherwise a stable synthetic one seeded by the pairing topic, flagged `synthetic`.
   */
  async fetchSnapshot(): Promise<SharedSnapshot | null> {
    if (!this.link?.linked) return null;
    const local = await Store.getSharedSnapshot();
    if (local) return local;
    if (this.link.role !== 'viewer' || !this.link.swarmTopic) return null;

    const seed = parseInt(this.link.swarmTopic.slice(0, 8), 16);
    const cycleDay = (seed % 28) + 1;
    const phase = cycleDay <= 5 ? 'menstrual' : cycleDay < 13 ? 'follicular' : cycleDay <= 15 ? 'ovulatory' : 'luteal';
    const snapshot: SharedSnapshot = {
      updatedAt: new Date().toISOString(),
      synthetic: true,
      sharerName: this.link.partnerName ?? 'Your partner',
      mode: 'period',
      phase,
      phaseLabel: phase.charAt(0).toUpperCase() + phase.slice(1),
      cycleDay,
      daysUntilPeriod: Math.max(0, 28 - cycleDay),
      nextPeriodDate: addDays(new Date().toISOString().slice(0, 10), 28 - cycleDay),
      inFertileWindow: cycleDay >= 10 && cycleDay <= 15,
      recentMood: ['good', 'okay', 'stressed'][seed % 3],
      recentEnergy: ['high', 'normal', 'low'][seed % 3],
      recentSymptoms: phase === 'menstrual' ? ['cramps', 'fatigue'] : phase === 'luteal' ? ['bloating'] : [],
    };
    return snapshot;
  }
}

export const PearsPartnerService = new PearsPartnerServiceImpl();
