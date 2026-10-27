import { LogDay, PeriStage, PeriStatus, SymptomLog, UserProfile } from '../types';
import { addDays, daysBetween, toISODay } from './dates';
import { buildEpisodes } from './cycle/episodes';
import { BLEEDING_FLOWS } from './logs';

/** A9 — perimenopause staging after STRAW+10 (Harlow et al. 2012). No date predictions. */

const STAGE_LABELS: Record<PeriStage, string> = {
  not_enough_data: 'Not enough data yet',
  no_transition_signs: 'No transition signs yet',
  early_transition: 'Early transition',
  late_transition: 'Late transition',
  postmenopause: 'Postmenopause',
};

function average(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

export function computePeriStatus(user: UserProfile, logs: SymptomLog[], now: Date = new Date()): PeriStatus {
  const today = toISODay(now);
  const past = logs.filter(l => l.day <= today && l.mode !== 'pregnancy');
  const bleedDays = past
    .filter(l => l.periodStart || (l.flow && BLEEDING_FLOWS.has(l.flow)))
    .map(l => l.day);
  if (user.lastPeriodStart) bleedDays.push(user.lastPeriodStart);
  bleedDays.sort();
  const lastBleedDay: LogDay | null = bleedDays.length ? bleedDays[bleedDays.length - 1] : null;
  const daysSince = lastBleedDay ? daysBetween(lastBleedDay, today) : null;

  const starts = buildEpisodes(past).filter(e => e.startsCycle).map(e => e.start);
  if (user.lastPeriodStart && !starts.some(s => Math.abs(daysBetween(s, user.lastPeriodStart!)) < 5)) {
    starts.push(user.lastPeriodStart);
    starts.sort();
  }
  const lengths: number[] = [];
  const gapsLastYear: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const g = daysBetween(starts[i - 1], starts[i]);
    lengths.push(g);
    if (daysBetween(starts[i], today) <= 365) gapsLastYear.push(g);
  }
  const recent = lengths.slice(-10);
  let bigDiffs = 0;
  for (let i = 1; i < recent.length; i++) if (Math.abs(recent[i] - recent[i - 1]) >= 7) bigDiffs++;

  let stage: PeriStage;
  if (daysSince != null && daysSince >= 365) stage = 'postmenopause';
  else if (daysSince != null && daysSince >= 60) stage = 'late_transition';
  else if (gapsLastYear.some(g => g >= 60)) stage = 'late_transition';
  else if (bigDiffs >= 2) stage = 'early_transition';
  else if (lengths.length < 2) stage = 'not_enough_data';
  else stage = 'no_transition_signs';

  const since = (n: number) => addDays(today, -n + 1);
  const flashes = (n: number) => past.filter(l => l.day >= since(n) && typeof l.hotFlashCount === 'number').map(l => l.hotFlashCount as number);
  const poorSleepNights7 = past.filter(l => l.day >= since(7) && l.sleepQuality === 'poor').length;

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    lastBleedDay,
    daysSinceLastBleed: daysSince,
    recentCycleLengths: recent,
    spread: recent.length >= 2 ? Math.max(...recent) - Math.min(...recent) : null,
    hotFlashAvg7: average(flashes(7)),
    hotFlashAvg30: average(flashes(30)),
    poorSleepNights7,
  };
}
