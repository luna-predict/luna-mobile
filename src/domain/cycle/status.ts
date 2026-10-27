import {
  CycleConfidence, CyclePhase, CycleRecord, CycleStatus, CycleTrackStatus, LogDay,
  OvulationEvidence, SymptomLog, UserProfile,
} from '../../types';
import { addDays, daysBetween, median, stdev, toISODay } from '../dates';
import { buildEpisodes, Episode } from './episodes';
import { detectOvulation } from '../ovulation';

/**
 * A2–A5, A7 — cycle history, estimate, late state, ovulation, phase.
 * See docs/archi-docs/03-tracking-algorithms.md for the rules and sources.
 */

const DEFAULT_LUTEAL = 14;
const SEED_SIGMA = 3;
const RECENT_CYCLES = 6;

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

interface Start { day: LogDay; periodLength: number | null; seed: boolean; explicit: boolean }

/** Cycle starts from logged episodes, plus the onboarding seed when it isn't near an observed start. */
export function cycleStarts(user: UserProfile, episodes: Episode[]): Start[] {
  const starts: Start[] = episodes
    .filter(e => e.startsCycle)
    .map(e => ({ day: e.start, periodLength: e.length, seed: false, explicit: e.explicitStart }));
  const seed = user.lastPeriodStart;
  if (seed && !starts.some(s => Math.abs(daysBetween(s.day, seed)) < 5)) {
    starts.push({ day: seed, periodLength: null, seed: true, explicit: false });
    starts.sort((a, b) => a.day.localeCompare(b.day));
  }
  return starts;
}

/** A2 + missed-log guard: a gap ≥ 1.6× the median of otherwise regular cycles (and ≥ 45 days) is probably an unlogged period. */
export function cycleRecords(starts: Start[]): CycleRecord[] {
  const raw: CycleRecord[] = [];
  for (let i = 1; i < starts.length; i++) {
    const length = daysBetween(starts[i - 1].day, starts[i].day);
    if (length >= 15 && length <= 90) {
      raw.push({ start: starts[i - 1].day, length, periodLength: starts[i - 1].periodLength, suspectedMissedLog: false });
    }
  }
  for (let i = 0; i < raw.length; i++) {
    const others = raw.filter((_, j) => j !== i).map(r => r.length);
    if (others.length < 3) continue;
    const othersRegular = Math.max(...others) - Math.min(...others) <= 7;
    if (othersRegular && raw[i].length >= 45 && raw[i].length >= 1.6 * median(others)) {
      raw[i].suspectedMissedLog = true;
    }
  }
  return raw;
}

export interface CycleEstimate {
  length: number;
  sigma: number;
  spread: number | null;
  confidence: CycleConfidence;
  cyclesUsed: number;
}

/** A3 — median length, spread and confidence from the last 6 valid cycles. */
export function estimateCycle(user: UserProfile, records: CycleRecord[]): CycleEstimate {
  const recent = records.filter(r => !r.suspectedMissedLog).slice(-RECENT_CYCLES).map(r => r.length);
  if (recent.length === 0) {
    return { length: user.avgCycleLength || 28, sigma: SEED_SIGMA, spread: null, confidence: 'seed', cyclesUsed: 0 };
  }
  const spread = Math.max(...recent) - Math.min(...recent);
  const sigma = recent.length >= 3 ? Math.max(1, Math.round(stdev(recent))) : SEED_SIGMA;
  let confidence: CycleConfidence = 'learning';
  if (recent.length >= 3 && spread <= 7) confidence = 'established';
  else if (recent.length >= 3 && spread > 9) confidence = 'irregular';
  return { length: Math.round(median(recent)), sigma, spread, confidence, cyclesUsed: recent.length };
}

function periodLengthEstimate(user: UserProfile, episodes: Episode[]): number {
  const lengths = episodes.filter(e => e.startsCycle).slice(-RECENT_CYCLES).map(e => e.length).filter(n => n >= 1 && n <= 15);
  if (lengths.length === 0) return user.avgPeriodLength || 5;
  return Math.min(10, Math.max(2, Math.round(median(lengths))));
}

function logsBetween(logs: SymptomLog[], from: LogDay, toExclusive: LogDay | null): SymptomLog[] {
  return logs.filter(l => l.day >= from && (!toExclusive || l.day < toExclusive));
}

/** Personal luteal length from past cycles with BBT-confirmed ovulation (≥ 2 needed). */
function personalLuteal(logs: SymptomLog[], starts: Start[]): number {
  const luteals: number[] = [];
  for (let i = 0; i + 1 < starts.length; i++) {
    const ev = detectOvulation(logsBetween(logs, starts[i].day, starts[i + 1].day), starts[i].day);
    if (ev?.status === 'confirmed') {
      const l = daysBetween(ev.day, starts[i + 1].day);
      if (l >= 7 && l <= 20) luteals.push(l);
    }
  }
  if (luteals.length < 2) return DEFAULT_LUTEAL;
  return Math.min(16, Math.max(10, Math.round(median(luteals))));
}

function phaseFor(cycleDay: number, menstrualDays: number, today: LogDay, ovulation: LogDay): CyclePhase {
  if (cycleDay <= menstrualDays) return 'menstrual';
  const d = daysBetween(ovulation, today);
  if (d >= -1 && d <= 1) return 'ovulatory';
  return d < -1 ? 'follicular' : 'luteal';
}

function range(start: LogDay, days: number): LogDay[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

export function computeCycleStatus(user: UserProfile, allLogs: SymptomLog[], now: Date = new Date()): CycleStatus {
  const today = toISODay(now);
  const logs = allLogs.filter(l => l.mode !== 'pregnancy' && l.day <= today);
  const episodes = buildEpisodes(logs);
  const starts = cycleStarts(user, episodes).filter(s => s.day <= today);
  const records = cycleRecords(starts);
  const est = estimateCycle(user, records);
  const L = est.length;
  const P = periodLengthEstimate(user, episodes);
  const hasLoggedFlow = episodes.length > 0;

  const lastStart = starts.length ? starts[starts.length - 1] : null;
  let anchor: LogDay = lastStart?.day ?? today;
  let status: CycleTrackStatus = lastStart ? 'on_track' : 'no_data';
  let daysLate = 0;

  if (lastStart) {
    const expected = addDays(lastStart.day, L);
    const late = daysBetween(expected, today);
    if (late > 0) {
      if (hasLoggedFlow && late <= Math.max(L, 35)) {
        status = 'late';
        daysLate = late;
      } else if (!hasLoggedFlow) {
        status = 'assumed';
        while (daysBetween(anchor, today) >= L) anchor = addDays(anchor, L);
      } else {
        status = 'overdue_long';
        daysLate = late;
      }
    }
  }

  const isLate = status === 'late' || status === 'overdue_long';
  const cycleDay = daysBetween(anchor, today) + 1;
  const nextPeriod = isLate ? addDays(anchor, L) : addDays(anchor, L);
  const daysUntilPeriod = Math.max(0, daysBetween(today, nextPeriod));

  // Ovulation: logged evidence in the current cycle wins, else calendar estimate
  const luteal = personalLuteal(logs, starts);
  const calendarOv: OvulationEvidence = { day: addDays(nextPeriod, -luteal), source: 'calendar', status: 'predicted' };
  const evidence = detectOvulation(logsBetween(logs, anchor, null), anchor);
  const ov = evidence ?? calendarOv;

  const fertileStart = addDays(ov.day, -5);
  const fertileEnd = ov.day;
  const peakDays = range(addDays(ov.day, -2), 3);
  const inFertileWindow = !isLate && today >= fertileStart && today <= fertileEnd;

  // Current episode length if the anchor is an observed period, else the estimate
  const anchorEpisode = episodes.find(e => e.start === anchor);
  const menstrualDays = anchorEpisode ? Math.max(anchorEpisode.length, daysBetween(anchor, anchorEpisode.end) + 1) : P;
  let phase = phaseFor(cycleDay, menstrualDays, today, ov.day);
  let phaseLabel = PHASE_LABELS[phase];
  if (isLate) {
    phase = 'luteal';
    phaseLabel = 'Period late';
  }

  // Predicted period and fertile days: current cycle (if not observed) + next 2 cycles
  const periodDates: LogDay[] = [];
  const fertileDates: LogDay[] = [];
  if (!anchorEpisode && !isLate) periodDates.push(...range(anchor, P));
  for (let c = 0; c < 3; c++) {
    const start = addDays(nextPeriod, c * L);
    if (c === 0 && isLate) {
      // overdue: no future prediction for this cycle until the period starts
    } else {
      periodDates.push(...range(start, P));
    }
    if (c < 2) {
      const ovDay = addDays(start, L - luteal);
      fertileDates.push(...range(addDays(ovDay, -5), 6));
    }
  }
  if (!isLate) fertileDates.unshift(...range(fertileStart, 6));

  return {
    status,
    daysLate,
    cycleDay,
    cycleLength: L,
    periodLength: P,
    phase,
    phaseLabel,
    lastPeriodStart: lastStart?.day ?? null,
    nextPeriodDate: nextPeriod,
    nextPeriodRange: { start: addDays(nextPeriod, -est.sigma), end: addDays(nextPeriod, est.sigma) },
    daysUntilPeriod,
    ovulationDate: ov.day,
    ovulationSource: ov.source,
    ovulationStatus: ov.status,
    daysUntilOvulation: Math.max(0, daysBetween(today, ov.day)),
    fertileWindowStart: fertileStart,
    fertileWindowEnd: fertileEnd,
    peakDays,
    inFertileWindow,
    periodDates: [...new Set(periodDates)],
    fertileDates: [...new Set(fertileDates)],
    confidence: est.confidence,
    cyclesTracked: est.cyclesUsed,
    spread: est.spread,
    sigma: est.sigma,
    history: records,
  };
}

/** Today's fertility level for conceive mode. */
export function fertilityLevel(cycle: CycleStatus, today: LogDay): 'low' | 'high' | 'peak' {
  if (cycle.peakDays.includes(today)) return 'peak';
  if (cycle.inFertileWindow) return 'high';
  return 'low';
}

export { PHASE_LABELS };
