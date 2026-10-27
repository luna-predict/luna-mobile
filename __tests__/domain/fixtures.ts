import { AppMode, SymptomLog, UserProfile } from '../../src/types';

export function user(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1', name: 'Amani', birthYear: 1995, sex: 'female', mode: 'period',
    onboardingComplete: true, createdAt: '2026-01-01T00:00:00.000Z',
    avgCycleLength: 28, avgPeriodLength: 5,
    notifications: { periodReminders: true, dailyCheckIn: true, insights: true },
    sharing: { sharePhase: true, sharePredictions: true, shareMood: true, shareSymptoms: false },
    ...over,
  };
}

export function log(day: string, over: Partial<SymptomLog> = {}, mode: AppMode = 'period'): SymptomLog {
  return {
    id: day, day, date: day, loggedAt: `${day}T08:00:00.000Z`,
    symptoms: [], mood: null, energy: null, flow: null, notes: '', mode,
    ...over,
  };
}

export const flow = (day: string, f = 'medium', mode: AppMode = 'period') => log(day, { flow: f }, mode);

/** Local-time Date for a 'YYYY-MM-DD' day (noon, to stay clear of DST edges). */
export function on(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
