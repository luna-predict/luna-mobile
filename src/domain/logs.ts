import { LogDay, SymptomLog } from '../types';
import { toISODay } from './dates';

/** The calendar day a log describes. Handles schema v1 logs whose `date` is a UTC instant. */
export function dayOf(log: Pick<SymptomLog, 'date'> & { day?: LogDay }): LogDay {
  if (log.day) return log.day;
  // v1 stored `new Date().toISOString()`; turn the instant back into the local day it was saved on
  if (log.date.length > 10) return toISODay(new Date(log.date));
  return log.date;
}

export const BLEEDING_FLOWS = new Set(['light', 'medium', 'heavy']);

export function isBleeding(log: SymptomLog): boolean {
  return !!log.periodStart || (!!log.flow && BLEEDING_FLOWS.has(log.flow));
}

export function sortByDay<T extends { day: LogDay }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.day.localeCompare(b.day));
}
