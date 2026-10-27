import { LogDay, SymptomLog } from '../../types';
import { daysBetween } from '../dates';
import { BLEEDING_FLOWS } from '../logs';

/**
 * A1 — period start detection.
 * Bleeding = light/medium/heavy flow or an explicit "period started" mark. Spotting never
 * starts a period. Bleeding days ≤ 2 days apart merge into one episode, so a single missed
 * log doesn't split a period.
 */

export interface Episode {
  start: LogDay;
  end: LogDay;
  length: number;
  explicitStart: boolean;
  heavyDays: number;
  /** false when the episode began < 15 days after the previous cycle start (intermenstrual) */
  startsCycle: boolean;
}

const MERGE_GAP_DAYS = 2;
export const MIN_CYCLE_DAYS = 15;

export function buildEpisodes(logs: SymptomLog[]): Episode[] {
  const days = [...logs]
    .filter(l => l.periodStart || l.periodEnd || (l.flow && BLEEDING_FLOWS.has(l.flow)))
    .sort((a, b) => a.day.localeCompare(b.day));

  const episodes: Episode[] = [];
  let cur: (Episode & { closed: boolean }) | null = null;

  for (const log of days) {
    const bleeding = !!log.periodStart || (!!log.flow && BLEEDING_FLOWS.has(log.flow));
    const heavy = log.flow === 'heavy' ? 1 : 0;

    if (log.periodEnd && cur && !cur.closed && daysBetween(cur.end, log.day) <= MERGE_GAP_DAYS + 1) {
      if (log.day > cur.end) cur.end = log.day;
      cur.heavyDays += heavy;
      cur.closed = true;
      continue;
    }
    if (!bleeding) continue;

    const startsNew =
      !cur ||
      cur.closed ||
      daysBetween(cur.end, log.day) > MERGE_GAP_DAYS ||
      (log.periodStart && log.day > cur.end);

    if (startsNew) {
      if (cur) episodes.push(finish(cur));
      cur = { start: log.day, end: log.day, length: 1, explicitStart: !!log.periodStart, heavyDays: heavy, startsCycle: true, closed: false };
    } else if (cur) {
      if (log.periodStart && log.day > cur.start) {
        // Explicit start inside a run: earlier days were pre-period bleeding
        cur.start = log.day;
        cur.explicitStart = true;
      }
      if (log.day > cur.end) cur.end = log.day;
      cur.heavyDays += heavy;
    }
  }
  if (cur) episodes.push(finish(cur));

  // Mark which episodes start a new cycle
  let lastStart: LogDay | null = null;
  for (const ep of episodes) {
    if (!lastStart || ep.explicitStart || daysBetween(lastStart, ep.start) >= MIN_CYCLE_DAYS) {
      ep.startsCycle = true;
      lastStart = ep.start;
    } else {
      ep.startsCycle = false;
    }
  }
  return episodes;
}

function finish(e: Episode & { closed: boolean }): Episode {
  const { closed: _closed, ...rest } = e;
  return { ...rest, length: daysBetween(e.start, e.end) + 1 };
}
