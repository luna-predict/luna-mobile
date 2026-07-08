import { CycleStatus, CyclePhase, PregnancyStatus, SymptomLog, UserProfile } from '../types';

/**
 * Deterministic on-device cycle prediction engine.
 * Learns from logged flow data; falls back to onboarding seed values until
 * enough real cycles are observed. All math stays local — nothing leaves the device.
 */

const DAY_MS = 86400000;
const LUTEAL_LENGTH = 14;          // days from ovulation to next period
const FERTILE_BEFORE_OVULATION = 5;
const NEW_CYCLE_GAP_DAYS = 14;     // flow after this many flow-free days = new cycle

export function toISODay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Extract period start dates from logs (days with flow, grouped into episodes). */
export function detectPeriodStarts(logs: SymptomLog[]): Date[] {
  const flowDays = logs
    .filter(l => l.flow && l.flow !== 'none')
    .map(l => parseISODay(l.date))
    .sort((a, b) => a.getTime() - b.getTime());

  const starts: Date[] = [];
  let prev: Date | null = null;
  for (const day of flowDays) {
    if (!prev || daysBetween(prev, day) > NEW_CYCLE_GAP_DAYS) {
      starts.push(day);
    }
    prev = day;
  }
  return starts;
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

function phaseForDay(cycleDay: number, cycleLength: number, periodLength: number): CyclePhase {
  const ovulationDay = cycleLength - LUTEAL_LENGTH;
  if (cycleDay <= periodLength) return 'menstrual';
  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) return 'ovulatory';
  if (cycleDay < ovulationDay) return 'follicular';
  return 'luteal';
}

/**
 * Compute full cycle status for "today".
 * Uses observed cycle starts when available; otherwise the onboarding seed.
 */
export function computeCycleStatus(user: UserProfile, logs: SymptomLog[], today = new Date()): CycleStatus {
  const observedStarts = detectPeriodStarts(logs);
  const seedStart = user.lastPeriodStart ? parseISODay(user.lastPeriodStart) : null;

  // Merge the seed start in if it predates all observed data
  const starts = [...observedStarts];
  if (seedStart && !starts.some(s => Math.abs(daysBetween(s, seedStart)) < 5)) {
    starts.push(seedStart);
    starts.sort((a, b) => a.getTime() - b.getTime());
  }

  // Cycle length: average of observed gaps (guarding against outliers), else seed value
  let cycleLength = user.avgCycleLength || 28;
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1], starts[i]);
    if (gap >= 15 && gap <= 60) gaps.push(gap);
  }
  if (gaps.length > 0) {
    cycleLength = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  const periodLength = user.avgPeriodLength || 5;
  const confidence: CycleStatus['confidence'] =
    gaps.length >= 3 ? 'established' : gaps.length >= 1 ? 'learning' : 'seed';

  // Anchor: most recent start on/before today; if none, assume a cycle started today
  const todayMid = parseISODay(toISODay(today));
  let anchor = starts.filter(s => s.getTime() <= todayMid.getTime()).pop() ?? todayMid;
  // Roll the anchor forward through any fully elapsed predicted cycles
  while (daysBetween(anchor, todayMid) >= cycleLength) {
    anchor = addDays(anchor, cycleLength);
  }

  const cycleDay = daysBetween(anchor, todayMid) + 1;
  const nextPeriod = addDays(anchor, cycleLength);
  const ovulation = addDays(nextPeriod, -LUTEAL_LENGTH);
  const fertileStart = addDays(ovulation, -FERTILE_BEFORE_OVULATION);
  const fertileEnd = addDays(ovulation, 1);

  const periodDates: string[] = [];
  for (let c = 0; c < 2; c++) {
    const start = addDays(anchor, c * cycleLength);
    for (let d = 0; d < periodLength; d++) periodDates.push(toISODay(addDays(start, d)));
  }
  const fertileDates: string[] = [];
  for (let c = 0; c < 2; c++) {
    const ov = addDays(anchor, c * cycleLength + cycleLength - LUTEAL_LENGTH);
    for (let d = -FERTILE_BEFORE_OVULATION; d <= 1; d++) fertileDates.push(toISODay(addDays(ov, d)));
  }

  const inFertileWindow = todayMid >= fertileStart && todayMid <= fertileEnd;
  const phase = phaseForDay(cycleDay, cycleLength, periodLength);

  return {
    cycleDay,
    cycleLength,
    phase,
    phaseLabel: PHASE_LABELS[phase],
    nextPeriodDate: toISODay(nextPeriod),
    daysUntilPeriod: Math.max(0, daysBetween(todayMid, nextPeriod)),
    ovulationDate: toISODay(ovulation),
    daysUntilOvulation: Math.max(0, daysBetween(todayMid, ovulation)),
    fertileWindowStart: toISODay(fertileStart),
    fertileWindowEnd: toISODay(fertileEnd),
    inFertileWindow,
    periodDates,
    fertileDates,
    confidence,
  };
}

const BABY_SIZES: [number, string][] = [
  [4, 'a poppy seed 🌱'], [6, 'a sweet pea 🫛'], [8, 'a raspberry 🫐'],
  [10, 'a strawberry 🍓'], [12, 'a lime 🍋'], [14, 'a lemon 🍋'],
  [16, 'an avocado 🥑'], [18, 'a bell pepper 🫑'], [20, 'a banana 🍌'],
  [24, 'an ear of corn 🌽'], [28, 'an eggplant 🍆'], [32, 'a squash 🎃'],
  [36, 'a honeydew melon 🍈'], [40, 'a watermelon 🍉'],
];

export function computePregnancyStatus(user: UserProfile, today = new Date()): PregnancyStatus | null {
  if (!user.dueDate) return null;
  const due = parseISODay(user.dueDate);
  const todayMid = parseISODay(toISODay(today));
  const daysUntilDue = daysBetween(todayMid, due);
  const gestationDays = Math.min(280, Math.max(0, 280 - daysUntilDue));
  const week = Math.floor(gestationDays / 7);
  const day = gestationDays % 7;
  const trimester: 1 | 2 | 3 = week < 13 ? 1 : week < 27 ? 2 : 3;
  const babySize = (BABY_SIZES.find(([w]) => week <= w) ?? BABY_SIZES[BABY_SIZES.length - 1])[1];
  return { week: Math.max(1, week), day, trimester, dueDate: user.dueDate, daysUntilDue: Math.max(0, daysUntilDue), babySize };
}

/** Per-mode summary line used on dashboards and partner insights */
export function phaseInsight(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Rest and nurture yourself';
    case 'follicular': return 'Energy is rising!';
    case 'ovulatory': return 'Peak energy & fertility';
    case 'luteal': return 'Wind down and reflect';
  }
}

/** Supportive tip for a linked partner based on the sharer's phase */
export function partnerTip(phase: CyclePhase | undefined): string {
  switch (phase) {
    case 'menstrual': return 'Cramps and low energy are common right now. A heating pad, her favorite snack, or taking a chore off her plate goes a long way.';
    case 'follicular': return 'Energy is climbing — a great window to plan something active or social together. 🌱';
    case 'ovulatory': return 'Peak energy days. If you are trying to conceive, these are the most important days of the month. ✨';
    case 'luteal': return 'PMS can surface — extra patience, comfort food, and low-key evenings are appreciated. 🌙';
    default: return 'Link with your partner to see supportive, phase-aware tips here.';
  }
}
