import { LogDay, PregnancyStatus, UserProfile } from '../types';
import { addDays, daysBetween, toISODay } from './dates';

/** A8 — pregnancy dating (Naegele: due = LMP + 280). Trimesters per ACOG: T1 ≤ 13w6d, T2 14w0d–27w6d, T3 ≥ 28w0d. */

const BABY_SIZES: [number, string][] = [
  [4, 'a poppy seed'], [6, 'a sweet pea'], [8, 'a raspberry'], [10, 'a strawberry'],
  [12, 'a lime'], [14, 'a lemon'], [16, 'an avocado'], [18, 'a bell pepper'],
  [20, 'a banana'], [24, 'an ear of corn'], [28, 'an aubergine'], [32, 'a squash'],
  [36, 'a honeydew melon'], [40, 'a watermelon'],
];

export function pregnancyLmp(user: UserProfile): LogDay | null {
  if (user.pregnancy?.lmp) return user.pregnancy.lmp;
  if (user.dueDate) return addDays(user.dueDate, -280);
  return null;
}

export function lmpFromWeeks(weeks: number, days: number, now: Date = new Date()): LogDay {
  return addDays(toISODay(now), -(weeks * 7 + days));
}

export function computePregnancyStatus(user: UserProfile, now: Date = new Date()): PregnancyStatus | null {
  const lmp = pregnancyLmp(user);
  if (!lmp) return null;
  const today = toISODay(now);
  const gestationDays = Math.max(0, daysBetween(lmp, today));
  const week = Math.floor(gestationDays / 7);
  const day = gestationDays % 7;
  const trimester: 1 | 2 | 3 = gestationDays < 14 * 7 ? 1 : gestationDays < 28 * 7 ? 2 : 3;
  const dueDate = addDays(lmp, 280);
  const babySize = (BABY_SIZES.find(([w]) => week <= w) ?? BABY_SIZES[BABY_SIZES.length - 1])[1];
  return {
    week,
    day,
    gestationDays,
    label: `${week}w ${day}d`,
    trimester,
    lmp,
    dueDate,
    daysUntilDue: Math.max(0, daysBetween(today, dueDate)),
    postDates: gestationDays > 280,
    babySize,
  };
}
