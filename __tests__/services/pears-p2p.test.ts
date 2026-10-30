import { PearsPartnerService, formatInviteCode, isValidInviteCode, topicFromCode, buildSnapshot } from '../../src/services/PearsPartnerService';
import { PearsTransport } from '../../src/services/PearsTransport';
import { Store } from '../../src/storage/Store';
import { UserProfile, CycleStatus, SymptomLog } from '../../src/types';

describe('Pears P2P Partner Sharing Service', () => {
  beforeEach(async () => {
    PearsPartnerService.reset();
    await Store.savePartnerLink(null);
    await Store.saveSharedSnapshot(null);
  });

  test('generates valid 12-char z-base-32 invite codes formatted as xxxx-xxxx-xxxx', async () => {
    const code = await PearsPartnerService.generateInvite('Alice');
    expect(isValidInviteCode(code)).toBe(true);
    expect(code).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);

    const link = PearsPartnerService.getLink();
    expect(link?.role).toBe('sharer');
    expect(link?.swarmTopic).toBeDefined();
    expect(link?.swarmTopic?.length).toBe(52);
  });

  test('validates valid and invalid invite codes', () => {
    expect(isValidInviteCode('ybnd-rfg8-ejkm')).toBe(true);
    expect(isValidInviteCode('ybndrfg8ejkm')).toBe(true);
    expect(isValidInviteCode('invalid-code!!')).toBe(false);
    expect(isValidInviteCode('123')).toBe(false);
  });

  test('derives deterministic topic hash from pairing code', async () => {
    const topic1 = await topicFromCode('ybnd-rfg8-ejkm');
    const topic2 = await topicFromCode('ybndrfg8ejkm');
    expect(topic1).toBe(topic2);
    expect(topic1.length).toBe(52);
  });

  test('buildSnapshot filters data strictly per user sharing preferences', () => {
    const mockUser: UserProfile = {
      id: 'u1',
      name: 'Alice',
      birthYear: 1995,
      sex: 'female',
      mode: 'period',
      onboardingComplete: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      sharing: {
        sharePhase: true,
        sharePredictions: false,
        shareMood: false,
        shareSymptoms: false,
      },
      notifications: { periodReminders: true, dailyCheckIn: false, insights: false },
    };

    const mockCycle: CycleStatus = {
      phase: 'follicular',
      phaseLabel: 'Follicular',
      cycleDay: 8,
      cycleLength: 28,
      periodLength: 5,
      daysUntilPeriod: 20,
      nextPeriodDate: '2026-05-20',
      inFertileWindow: false,
      isLate: false,
      daysLate: 0,
      variability: 'regular',
      predictedPeriods: [],
      mode: 'period',
    };

    const snapshot = buildSnapshot(mockUser, mockCycle, null, [], '2026-05-01');

    expect(snapshot.sharerName).toBe('Alice');
    expect(snapshot.phase).toBe('follicular');
    expect(snapshot.cycleDay).toBe(8);
    // Predictions turned off
    expect(snapshot.daysUntilPeriod).toBeUndefined();
    expect(snapshot.nextPeriodDate).toBeUndefined();
  });

  test('partner viewer links with code and fetches synthetic fallback when offline', async () => {
    await PearsPartnerService.linkWithCode('ybnd-rfg8-ejkm', 'Bob');
    const link = PearsPartnerService.getLink();
    expect(link?.linked).toBe(true);
    expect(link?.role).toBe('viewer');
    expect(link?.partnerName).toBe('Bob');

    const snapshot = await PearsPartnerService.fetchSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.synthetic).toBe(true);
    expect(snapshot?.sharerName).toBe('Bob');
  });

  test('woman links, publishes snapshot, and unlinks cleanly', async () => {
    await PearsPartnerService.generateInvite('Alice');
    await PearsPartnerService.confirmPartnerJoined('Bob');
    const link = PearsPartnerService.getLink();
    expect(link?.linked).toBe(true);
    expect(link?.partnerName).toBe('Bob');

    const mockUser: UserProfile = {
      id: 'u1',
      name: 'Alice',
      birthYear: 1995,
      sex: 'female',
      mode: 'period',
      onboardingComplete: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      sharing: {
        sharePhase: true,
        sharePredictions: true,
        shareMood: true,
        shareSymptoms: true,
      },
      notifications: { periodReminders: true, dailyCheckIn: false, insights: false },
    };

    const published = await PearsPartnerService.publishSnapshot(mockUser, null, null, [], '2026-05-01');
    expect(published).toBeDefined();
    expect(published?.sharerName).toBe('Alice');

    await PearsPartnerService.unlink();
    const unlinked = PearsPartnerService.getLink();
    expect(unlinked?.linked).toBe(false);
    expect(unlinked?.role).toBeNull();
  });
});
