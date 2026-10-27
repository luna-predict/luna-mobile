import {
  AppMode, CycleStatus, HealthFlag, LogDay, MenCheckIn, PeriStatus, PregnancyStatus, SharedSnapshot,
  SymptomLog, UserProfile,
} from '../../types';
import { addDays, daysBetween } from '../../domain';

/**
 * Builds the FACTS block from domain outputs (never from model output), so the coach and the
 * dashboard always agree. v1 uses structured retrieval rather than embeddings (04 §4.13).
 */

const MODE_DESCRIPTION: Record<AppMode, string> = {
  period: 'tracking her menstrual cycle',
  conceive: 'trying to conceive',
  pregnancy: 'pregnant',
  perimenopause: 'going through perimenopause',
};

export function modeDescription(mode: AppMode): string {
  return MODE_DESCRIPTION[mode];
}

function count<T>(items: T[], key: (t: T) => string | null | undefined): string {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.replace(/_/g, ' ')} ×${n}`).join(', ');
}

/** Up to `limit` logs most relevant to the question: keyword hits ×2 + recency (60-day decay). */
export function relevantLogs(question: string, logs: SymptomLog[], mode: AppMode, today: LogDay, limit = 5): SymptomLog[] {
  const terms = question.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  return logs
    .filter(l => l.mode === mode && l.day <= today)
    .map(l => {
      const hay = [...l.symptoms, l.mood ?? '', l.energy ?? '', l.flow ?? '', l.notes, l.sleepQuality ?? ''].join(' ').toLowerCase();
      const hits = terms.filter(t => hay.includes(t)).length;
      const age = Math.max(0, daysBetween(l.day, today));
      return { l, score: hits * 2 + Math.max(0, 1 - age / 60) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.l)
    .sort((a, b) => a.day.localeCompare(b.day));
}

function describeLog(l: SymptomLog): string {
  const parts = [
    l.symptoms.length ? `symptoms ${l.symptoms.map(s => s.replace(/_/g, ' ')).join(', ')}` : null,
    l.flow ? `flow ${l.flow}` : null,
    l.mood ? `mood ${l.mood}` : null,
    l.energy ? `energy ${l.energy}` : null,
    l.sleepQuality ? `sleep ${l.sleepQuality}` : null,
    l.bbt != null ? `BBT ${l.bbt}°C` : null,
    l.opkResult ? `ovulation test ${l.opkResult}` : null,
    l.hotFlashCount ? `hot flashes ${l.hotFlashCount}` : null,
    l.notes ? `notes "${l.notes.slice(0, 120)}"` : null,
  ].filter(Boolean);
  return `- ${l.day}: ${parts.join('; ') || 'no details'}`;
}

export interface WomanFacts {
  user: UserProfile;
  today: LogDay;
  cycle: CycleStatus | null;
  pregnancy: PregnancyStatus | null;
  peri: PeriStatus | null;
  flags: HealthFlag[];
  logs: SymptomLog[];
  question: string;
}

export function buildWomanFacts(f: WomanFacts): string {
  const lines: string[] = [`today: ${f.today}`];
  const { cycle, pregnancy, peri } = f;
  if (cycle) {
    const conf = cycle.confidence === 'seed' ? 'estimated from onboarding answers'
      : `learned from ${cycle.cyclesTracked} logged cycle${cycle.cyclesTracked === 1 ? '' : 's'}${cycle.confidence === 'irregular' ? ', irregular' : ''}`;
    if (cycle.status === 'late' || cycle.status === 'overdue_long') {
      lines.push(`cycle: day ${cycle.cycleDay}; period is ${cycle.daysLate} days LATE (expected ${cycle.nextPeriodDate}); usual length ${cycle.cycleLength} days (${conf})`);
    } else {
      lines.push(`cycle: day ${cycle.cycleDay} of about ${cycle.cycleLength} (${conf}); phase ${cycle.phaseLabel.toLowerCase()}`);
      lines.push(`next period: ${cycle.nextPeriodDate} (likely between ${cycle.nextPeriodRange.start} and ${cycle.nextPeriodRange.end})`);
    }
    lines.push(`ovulation: ${cycle.ovulationDate} (${cycle.ovulationStatus}${cycle.ovulationSource !== 'calendar' ? `, from ${cycle.ovulationSource}` : ''}); fertile window ${cycle.fertileWindowStart} to ${cycle.fertileWindowEnd}`);
  }
  if (pregnancy) {
    lines.push(`pregnancy: ${pregnancy.label} (trimester ${pregnancy.trimester}); due ${pregnancy.dueDate}; baby about the size of ${pregnancy.babySize}`);
  }
  if (peri) {
    lines.push(`perimenopause stage: ${peri.stageLabel}${peri.daysSinceLastBleed != null ? `; ${peri.daysSinceLastBleed} days since last period` : ''}`);
    if (peri.hotFlashAvg7 != null) lines.push(`hot flashes: ${peri.hotFlashAvg7}/day this week (30-day average ${peri.hotFlashAvg30 ?? 'n/a'})`);
  }
  lines.push(`health flags: ${f.flags.length ? f.flags.map(fl => fl.title).join('; ') : 'none'}`);

  const week = f.logs.filter(l => l.day > addDays(f.today, -7) && l.day <= f.today);
  if (week.length) {
    lines.push(`last 7 days: ${week.length} logs; symptoms ${count(week.flatMap(l => l.symptoms), s => s) || 'none'}; mood ${count(week, l => l.mood) || 'n/a'}; energy ${count(week, l => l.energy) || 'n/a'}`);
  } else {
    lines.push('last 7 days: nothing logged');
  }
  const rel = relevantLogs(f.question, f.logs, f.user.mode, f.today);
  if (rel.length) lines.push('relevant logs:', ...rel.map(describeLog));
  return lines.join('\n');
}

export function buildPartnerFacts(snapshot: SharedSnapshot | null, checkIns: MenCheckIn[], today: LogDay): string {
  const lines: string[] = [`today: ${today}`];
  if (!snapshot) {
    lines.push('partner data: not linked yet — nothing shared');
  } else {
    lines.push(`partner name: ${snapshot.sharerName}${snapshot.synthetic ? ' (DEMO data, not her real data)' : ''}`);
    lines.push(snapshot.phase ? `her phase: ${snapshot.phaseLabel} (cycle day ${snapshot.cycleDay})` : 'her phase: not shared');
    lines.push(snapshot.daysUntilPeriod != null ? `days until her next period: ${snapshot.daysUntilPeriod}; fertile window now: ${snapshot.inFertileWindow ? 'yes' : 'no'}` : 'predictions: not shared');
    if (snapshot.pregnancyWeek != null) lines.push(`pregnancy: week ${snapshot.pregnancyWeek}`);
    lines.push(snapshot.recentMood ? `her recent mood: ${snapshot.recentMood}, energy ${snapshot.recentEnergy ?? 'n/a'}` : 'mood: not shared');
    lines.push(snapshot.recentSymptoms?.length ? `her recent symptoms: ${snapshot.recentSymptoms.join(', ')}` : 'symptoms: not shared');
  }
  const mine = checkIns.filter(c => c.day > addDays(today, -7));
  lines.push(mine.length ? `his own last 7 days: stress ${count(mine, c => c.stress) || 'n/a'}; energy ${count(mine, c => c.energy) || 'n/a'}` : 'his own check-ins: none this week');
  return lines.join('\n');
}
