import { LogDay, OvulationEvidence, SymptomLog } from '../types';
import { addDays, daysBetween } from './dates';

/**
 * A6 — ovulation evidence from logs within one cycle.
 * Priority: BBT thermal shift (confirmed) > OPK surge (likely) > mucus peak (likely).
 */

/** Marshall "3-over-6": three consecutive temps above the highest of the previous six, third ≥ coverline + 0.2 °C. */
export function detectBbtShift(logs: SymptomLog[], cycleStart: LogDay): LogDay | null {
  const readings = logs
    .filter(l => typeof l.bbt === 'number' && daysBetween(cycleStart, l.day) >= 4)
    .map(l => ({ day: l.day, t: l.bbt as number }))
    .sort((a, b) => a.day.localeCompare(b.day));

  for (let i = 6; i + 2 < readings.length; i++) {
    const prev6 = readings.slice(i - 6, i);
    const coverline = Math.max(...prev6.map(r => r.t)) + 0.05;
    const [a, b, c] = [readings[i], readings[i + 1], readings[i + 2]];
    const consecutive = daysBetween(a.day, b.day) === 1 && daysBetween(b.day, c.day) === 1;
    if (!consecutive) continue;
    if (a.t > coverline && b.t > coverline && c.t >= coverline + 0.2 - 1e-9) {
      return addDays(a.day, -1);
    }
  }
  return null;
}

export function detectOpkSurge(logs: SymptomLog[]): LogDay | null {
  const tests = logs.filter(l => l.opkResult).sort((a, b) => a.day.localeCompare(b.day));
  const firstPositive = tests.find(l => l.opkResult === 'positive');
  return firstPositive ? addDays(firstPositive.day, 1) : null;
}

export function detectMucusPeak(logs: SymptomLog[]): LogDay | null {
  const obs = logs.filter(l => l.cervicalMucus).sort((a, b) => a.day.localeCompare(b.day));
  for (let i = obs.length - 2; i >= 0; i--) {
    if (obs[i].cervicalMucus === 'eggwhite' && obs[i + 1].cervicalMucus !== 'eggwhite') return obs[i].day;
  }
  return null;
}

/** Best ovulation evidence for the cycle that started on `cycleStart` (logs already limited to that cycle). */
export function detectOvulation(cycleLogs: SymptomLog[], cycleStart: LogDay): OvulationEvidence | null {
  const bbt = detectBbtShift(cycleLogs, cycleStart);
  if (bbt) return { day: bbt, source: 'bbt', status: 'confirmed' };
  const opk = detectOpkSurge(cycleLogs);
  if (opk) return { day: opk, source: 'opk', status: 'likely' };
  const mucus = detectMucusPeak(cycleLogs);
  if (mucus) return { day: mucus, source: 'mucus', status: 'likely' };
  return null;
}
