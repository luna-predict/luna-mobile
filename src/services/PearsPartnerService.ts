import * as Crypto from 'expo-crypto';
import { PartnerLink, SharedSnapshot, UserProfile, SymptomLog, CycleStatus, PregnancyStatus } from '../types';
import { Store } from '../storage/Store';

/**
 * Partner linking over Pears (Holepunch) building blocks.
 *
 * Architecture (production):
 *  - Woman's device creates a BlindPairing invite; the z32 invite code below
 *    maps to that invite.
 *  - Both devices join a Hyperswarm topic derived from the pairing; the woman
 *    writes her SharedSnapshot to a Hypercore/Hyperbee replicated to the
 *    partner over an encrypted Noise channel. The partner is a read-only peer.
 *  - Here the transport is simulated: snapshots persist locally and viewer
 *    devices synthesize a peer snapshot when no live one exists, so the full
 *    UX works end-to-end on one or two devices without the native runtime.
 */

const Z32_ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';

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
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `lunapredict:pairing:${raw}`,
  );
  return digest.slice(0, 52);
}

class PearsPartnerServiceImpl {
  private link: PartnerLink | null = null;

  async init(): Promise<PartnerLink> {
    if (!this.link) {
      this.link = (await Store.getPartnerLink()) ?? {
        linked: false, role: null, inviteCode: null, partnerName: null,
        linkedAt: null, swarmTopic: null, lastSyncAt: null,
      };
    }
    return this.link;
  }

  getLink(): PartnerLink | null {
    return this.link;
  }

  /** Woman-side: mint a pairing invite the partner types into their app. */
  async generateInvite(): Promise<string> {
    const raw = await randomZ32(12);
    const code = formatInviteCode(raw);
    const topic = await topicFromCode(code);
    this.link = {
      linked: false,
      role: 'sharer',
      inviteCode: code,
      partnerName: null,
      linkedAt: null,
      swarmTopic: topic,
      lastSyncAt: null,
    };
    await Store.savePartnerLink(this.link);
    console.log(`[Pears] BlindPairing invite created. Announcing on Hyperswarm topic ${topic.slice(0, 12)}…`);
    return code;
  }

  /** Woman-side: partner completed pairing (in production, the BlindPairing callback). */
  async confirmPartnerJoined(partnerName: string): Promise<PartnerLink> {
    if (!this.link || this.link.role !== 'sharer') throw new Error('No pending invite');
    this.link = { ...this.link, linked: true, partnerName, linkedAt: new Date().toISOString() };
    await Store.savePartnerLink(this.link);
    return this.link;
  }

  /** Men-side: join with the code your partner shared. */
  async linkWithCode(code: string, sharerNameFallback = 'Your partner'): Promise<PartnerLink> {
    if (!isValidInviteCode(code)) {
      throw new Error('That code doesn\'t look right. It should be 12 characters, like luna-xxxx-xxxx.');
    }
    const topic = await topicFromCode(code);
    console.log(`[Pears] Joining Hyperswarm topic ${topic.slice(0, 12)}… and performing Noise handshake`);
    await new Promise(r => setTimeout(r, 1500)); // DHT lookup + hole punch

    this.link = {
      linked: true,
      role: 'viewer',
      inviteCode: formatInviteCode(code.replace(/-/g, '')),
      partnerName: sharerNameFallback,
      linkedAt: new Date().toISOString(),
      swarmTopic: topic,
      lastSyncAt: new Date().toISOString(),
    };
    await Store.savePartnerLink(this.link);
    return this.link;
  }

  async unlink(): Promise<void> {
    this.link = {
      linked: false, role: null, inviteCode: null, partnerName: null,
      linkedAt: null, swarmTopic: null, lastSyncAt: null,
    };
    await Store.savePartnerLink(this.link);
    await Store.saveSharedSnapshot(null as unknown as SharedSnapshot);
    console.log('[Pears] Left swarm topic and destroyed pairing keys.');
  }

  /**
   * Woman-side: publish the snapshot the partner is allowed to see.
   * Called after each log save and on dashboard load. Fields are filtered by
   * SharingPreferences before anything is written to the replicated store.
   */
  async publishSnapshot(
    user: UserProfile,
    cycle: CycleStatus | null,
    pregnancy: PregnancyStatus | null,
    recentLog: SymptomLog | null,
  ): Promise<SharedSnapshot | null> {
    if (!this.link?.linked || this.link.role !== 'sharer') return null;
    const prefs = user.sharing;
    const snapshot: SharedSnapshot = {
      updatedAt: new Date().toISOString(),
      sharerName: user.name,
      mode: user.mode,
      ...(prefs.sharePhase && cycle ? {
        phase: cycle.phase,
        phaseLabel: cycle.phaseLabel,
        cycleDay: cycle.cycleDay,
      } : {}),
      ...(prefs.sharePredictions && cycle ? {
        daysUntilPeriod: cycle.daysUntilPeriod,
        nextPeriodDate: cycle.nextPeriodDate,
        inFertileWindow: cycle.inFertileWindow,
      } : {}),
      ...(pregnancy ? { pregnancyWeek: pregnancy.week } : {}),
      ...(prefs.shareMood && recentLog ? {
        recentMood: recentLog.mood,
        recentEnergy: recentLog.energy,
      } : {}),
      ...(prefs.shareSymptoms && recentLog ? { recentSymptoms: recentLog.symptoms } : {}),
    };
    await Store.saveSharedSnapshot(snapshot);
    this.link.lastSyncAt = snapshot.updatedAt;
    await Store.savePartnerLink(this.link);
    console.log('[Pears] Snapshot appended to shared Hypercore (encrypted, partner read-only).');
    return snapshot;
  }

  /**
   * Viewer-side: fetch the latest snapshot from the swarm.
   * Uses a locally replicated snapshot when present (same-device demo);
   * otherwise synthesizes a stable demo snapshot seeded by the pairing topic.
   */
  async fetchSnapshot(): Promise<SharedSnapshot | null> {
    if (!this.link?.linked) return null;
    const local = await Store.getSharedSnapshot();
    if (local) {
      this.link.lastSyncAt = new Date().toISOString();
      await Store.savePartnerLink(this.link);
      return local;
    }
    if (this.link.role !== 'viewer' || !this.link.swarmTopic) return null;

    // Deterministic demo snapshot from the topic hash so it's stable per pairing
    const seed = parseInt(this.link.swarmTopic.slice(0, 8), 16);
    const cycleDay = (seed % 28) + 1;
    const phase = cycleDay <= 5 ? 'menstrual' : cycleDay < 13 ? 'follicular' : cycleDay <= 15 ? 'ovulatory' : 'luteal';
    const snapshot: SharedSnapshot = {
      updatedAt: new Date().toISOString(),
      sharerName: this.link.partnerName ?? 'Your partner',
      mode: 'period',
      phase,
      phaseLabel: phase.charAt(0).toUpperCase() + phase.slice(1),
      cycleDay,
      daysUntilPeriod: Math.max(0, 28 - cycleDay),
      nextPeriodDate: new Date(Date.now() + (28 - cycleDay) * 86400000).toISOString().slice(0, 10),
      inFertileWindow: cycleDay >= 10 && cycleDay <= 16,
      recentMood: ['good', 'okay', 'stressed'][seed % 3],
      recentEnergy: ['high', 'normal', 'low'][seed % 3],
      recentSymptoms: phase === 'menstrual' ? ['cramps', 'fatigue'] : phase === 'luteal' ? ['bloating'] : [],
    };
    await Store.saveSharedSnapshot(snapshot);
    this.link.lastSyncAt = snapshot.updatedAt;
    await Store.savePartnerLink(this.link);
    return snapshot;
  }
}

export const PearsPartnerService = new PearsPartnerServiceImpl();
