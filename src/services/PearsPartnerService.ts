import * as Crypto from 'expo-crypto';
import { PartnerLink, SharedSnapshot, UserProfile, SymptomLog, CycleStatus, PregnancyStatus, LogDay } from '../types';
import { Store } from '../storage/Store';
import { addDays } from '../domain';
import { PearsTransport } from './PearsTransport';

/**
 * Partner linking powered by Pears building blocks:
 * BlindPairing invite → Hyperswarm DHT topic → read-only replicated snapshot over Noise encryption.
 *
 * HYBRID TRANSPORT:
 * 1. Checks if native BareKit worklet with Hyperswarm & Hypercore is available.
 * 2. If available, syncs real snapshots peer-to-peer across phones over Hyperswarm.
 * 3. If in Expo Go, tests, or offline without DHT peers, gracefully falls back to local storage
 *    with a clear 'synthetic: true' or 'demo' badge.
 */

const Z32_ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';
const EMPTY_LINK: PartnerLink = {
  linked: false, role: null, inviteCode: null, partnerName: null,
  linkedAt: null, swarmTopic: null, lastSyncAt: null,
};

export async function randomZ32(length: number): Promise<string> {
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

export async function topicFromCode(code: string): Promise<string> {
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
  private p2pReady = false;

  async init(): Promise<PartnerLink> {
    if (!this.link) this.link = (await Store.getPartnerLink()) ?? { ...EMPTY_LINK };
    // Non-blocking initialization so partner transport never blocks or delays app launch
    if (this.link.linked) {
      PearsTransport.init().then(ready => { this.p2pReady = ready; }).catch(() => { this.p2pReady = false; });
    }
    return this.link;
  }

  isP2PEnabled(): boolean {
    return this.p2pReady && PearsTransport.isAvailable();
  }

  async ensureP2P(): Promise<boolean> {
    if (!this.p2pReady) {
      this.p2pReady = await PearsTransport.init().catch(() => false);
    }
    return this.isP2PEnabled();
  }

  getLink(): PartnerLink | null {
    return this.link;
  }

  /** Forget in-memory state (used by Delete all data). */
  reset(): void {
    this.link = null;
  }

  /** Woman-side: mint a pairing invite the partner types into their app. */
  async generateInvite(sharerName = 'Luna User'): Promise<string> {
    const code = formatInviteCode(await randomZ32(12));
    const topic = await topicFromCode(code);
    this.link = { ...EMPTY_LINK, role: 'sharer', inviteCode: code, swarmTopic: topic };
    await Store.savePartnerLink(this.link);

    // If P2P worklet is ready, publish DHT topic immediately
    if (await this.ensureP2P()) {
      try {
        await PearsTransport.createInvite(topic, sharerName);
      } catch (err) {
        console.warn('PearsTransport invite warning:', err);
      }
    }

    return code;
  }

  /** Woman-side: partner completed pairing. */
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
    const topic = await topicFromCode(code);
    this.link = {
      linked: true,
      role: 'viewer',
      inviteCode: formatInviteCode(code.replace(/-/g, '')),
      partnerName: sharerNameFallback,
      linkedAt: new Date().toISOString(),
      swarmTopic: topic,
      lastSyncAt: null,
    };
    await Store.savePartnerLink(this.link);

    // If P2P worklet is available, join DHT swarm topic
    if (await this.ensureP2P()) {
      try {
        await PearsTransport.joinWithCode(topic, sharerNameFallback);
      } catch (err) {
        console.warn('PearsTransport join warning:', err);
      }
    }

    return this.link;
  }

  async unlink(): Promise<void> {
    if (this.isP2PEnabled()) {
      try {
        await PearsTransport.unlink();
      } catch (err) {
        console.warn('PearsTransport unlink error:', err);
      }
    }
    this.link = { ...EMPTY_LINK };
    await Store.savePartnerLink(this.link);
    await Store.saveSharedSnapshot(null);
  }

  /** Woman-side: write the filtered snapshot to P2P Hypercore and local storage. */
  async publishSnapshot(
    user: UserProfile,
    cycle: CycleStatus | null,
    pregnancy: PregnancyStatus | null,
    logs: SymptomLog[],
    today: LogDay,
  ): Promise<SharedSnapshot | null> {
    if (!this.link?.linked || this.link.role !== 'sharer') return null;
    const snapshot = buildSnapshot(user, cycle, pregnancy, logs, today);

    // Always persist snapshot in local store
    await Store.saveSharedSnapshot(snapshot);
    this.link.lastSyncAt = snapshot.updatedAt;
    await Store.savePartnerLink(this.link);

    // If P2P worklet is active, replicate snapshot block over Hypercore
    if (this.isP2PEnabled()) {
      try {
        await PearsTransport.publishSnapshot(snapshot);
      } catch (err) {
        console.warn('Failed to publish snapshot over P2P:', err);
      }
    }

    return snapshot;
  }

  /**
   * Partner-side: retrieve the latest snapshot.
   * Checks real P2P Hypercore first, then local storage, and finally synthetic demo seed.
   */
  async fetchSnapshot(): Promise<SharedSnapshot | null> {
    if (!this.link?.linked) return null;

    // 1. Try real P2P sync via PearsTransport if available
    if (this.isP2PEnabled()) {
      try {
        const p2pSnapshot = await PearsTransport.fetchLatestSnapshot();
        if (p2pSnapshot) {
          await Store.saveSharedSnapshot(p2pSnapshot);
          return p2pSnapshot;
        }
      } catch (err) {
        console.warn('Failed to fetch snapshot over P2P:', err);
      }
    }

    // 2. Local replicated snapshot (when on same phone or already cached from P2P)
    const local = await Store.getSharedSnapshot();
    if (local) return local;

    // 3. Fallback: Stable synthetic demo data derived from topic seed
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
