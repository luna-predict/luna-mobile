import { MenCheckIn, SymptomLog } from '../types';
import { dayOf } from '../domain/logs';

/**
 * v1 → v2: logs stored `date` as a UTC instant, but everything read it as a local day.
 * We recover the local day from the instant, add `day` + `loggedAt`, and re-dedupe.
 */

type V1Log = Omit<SymptomLog, 'day' | 'loggedAt'> & { day?: string; loggedAt?: string };
type V1CheckIn = Omit<MenCheckIn, 'day' | 'loggedAt'> & { day?: string; loggedAt?: string };

export function migrateLogsToV2(logs: V1Log[]): SymptomLog[] {
  const byKey = new Map<string, SymptomLog>();
  for (const old of logs) {
    const day = dayOf(old);
    const loggedAt = old.loggedAt ?? (old.date.length > 10 ? old.date : `${day}T12:00:00.000Z`);
    const next: SymptomLog = { ...old, day, date: day, loggedAt } as SymptomLog;
    const key = `${day}|${next.mode}`;
    const existing = byKey.get(key);
    if (!existing || existing.loggedAt < loggedAt) byKey.set(key, next);
  }
  return [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function migrateCheckInsToV2(entries: V1CheckIn[]): MenCheckIn[] {
  const byDay = new Map<string, MenCheckIn>();
  for (const old of entries) {
    const day = dayOf(old);
    const loggedAt = old.loggedAt ?? (old.date.length > 10 ? old.date : `${day}T12:00:00.000Z`);
    const next: MenCheckIn = { ...old, day, date: day, loggedAt } as MenCheckIn;
    const existing = byDay.get(day);
    if (!existing || existing.loggedAt < loggedAt) byDay.set(day, next);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
