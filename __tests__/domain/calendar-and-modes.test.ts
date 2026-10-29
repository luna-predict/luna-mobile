import {
  computeCycleStatus, computePregnancyStatus, computePeriStatus,
  fertilityLevel, getConceptionInfo, pregnancyStatusOnDay, addDays,
} from '../../src/domain';
import { user, log, flow, on } from './fixtures';

describe('Four modes algorithm & calendar date marking', () => {
  describe('Mode 1: Period Mode', () => {
    test('computes extended predictions across 6 future cycles', () => {
      const u = user({ lastPeriodStart: '2026-10-01', avgCycleLength: 28, avgPeriodLength: 5 });
      const status = computeCycleStatus(u, [flow('2026-10-01')], on('2026-10-15'));

      // Cycle day 15, expected period in 14 days (2026-10-29)
      expect(status.cycleDay).toBe(15);
      expect(status.nextPeriodDate).toBe('2026-10-29');

      // Extended period predictions should cover 6 cycles (approx 168+ days ahead)
      expect(status.periodDates.length).toBeGreaterThanOrEqual(12);
      const lastPredictedPeriodDay = status.periodDates[status.periodDates.length - 1];
      // Should extend well into 2027 (approx 140+ days ahead)
      expect(lastPredictedPeriodDay >= '2027-02-01').toBe(true);

      // Fertile dates should also be extended for future cycles
      expect(status.fertileDates.length).toBeGreaterThanOrEqual(36);
    });

    test('prediction uncertainty range (±sigma)', () => {
      const u = user({ lastPeriodStart: '2026-10-01', avgCycleLength: 28 });
      const status = computeCycleStatus(u, [flow('2026-10-01')], on('2026-10-15'));
      expect(status.nextPeriodRange.start).toBe(addDays(status.nextPeriodDate, -status.sigma));
      expect(status.nextPeriodRange.end).toBe(addDays(status.nextPeriodDate, status.sigma));
    });
  });

  describe('Mode 2: Conceive Mode (Fertility & Conception Probabilities)', () => {
    test('conception chances by cycle day (Wilcox et al. 1995)', () => {
      const u = user({ mode: 'conceive', lastPeriodStart: '2026-10-01' });
      const status = computeCycleStatus(u, [flow('2026-10-01', 'medium', 'conceive')], on('2026-10-10'));

      const ovDay = status.ovulationDate; // e.g. 2026-10-15 (28 - 14 = day 14)
      const peakDay = addDays(ovDay, -1);
      const fertileDay = addDays(ovDay, -4);
      const lowDay = addDays(ovDay, 3); // Luteal

      // Ovulation day: Peak (~33%)
      const ovInfo = getConceptionInfo(status, ovDay);
      expect(ovInfo.level).toBe('peak');
      expect(ovInfo.percentage).toBe('~33%');
      expect(fertilityLevel(status, ovDay)).toBe('peak');

      // Peak day (day -1): Peak (~27-31%)
      const peakInfo = getConceptionInfo(status, peakDay);
      expect(peakInfo.level).toBe('peak');
      expect(fertilityLevel(status, peakDay)).toBe('peak');

      // Fertile window day (day -4): High (~11-15%)
      const fertileInfo = getConceptionInfo(status, fertileDay);
      expect(fertileInfo.level).toBe('high');
      expect(fertilityLevel(status, fertileDay)).toBe('high');

      // Out of fertile window: Low (<3%)
      const lowInfo = getConceptionInfo(status, lowDay);
      expect(lowInfo.level).toBe('low');
      expect(lowInfo.percentage).toBe('<3%');
      expect(fertilityLevel(status, lowDay)).toBe('low');
    });

    test('OPK positive surge day moves ovulation to likely and shifts date', () => {
      const logs = [
        flow('2026-10-01', 'medium', 'conceive'),
        log('2026-10-12', { opkResult: 'positive' }, 'conceive'),
      ];
      const status = computeCycleStatus(user({ mode: 'conceive' }), logs, on('2026-10-13'));
      expect(status.ovulationStatus).toBe('likely');
      expect(status.ovulationSource).toBe('opk');
      expect(status.ovulationDate).toBe('2026-10-13');
    });
  });

  describe('Mode 3: Pregnancy Mode', () => {
    test('computes gestational week, days, and milestones for arbitrary dates', () => {
      const lmp = '2026-05-01';
      // Trimester 2 begins at 14 weeks = 98 days
      const t2Date = addDays(lmp, 98);
      const t2Status = pregnancyStatusOnDay(lmp, t2Date);
      expect(t2Status.week).toBe(14);
      expect(t2Status.day).toBe(0);
      expect(t2Status.trimester).toBe(2);
      expect(t2Status.milestone).toBe('Trimester 2 begins');

      // Halfway milestone at 20 weeks = 140 days
      const halfwayDate = addDays(lmp, 140);
      const halfwayStatus = pregnancyStatusOnDay(lmp, halfwayDate);
      expect(halfwayStatus.week).toBe(20);
      expect(halfwayStatus.milestone).toBe('Halfway (20 weeks)');

      // Trimester 3 begins at 28 weeks = 196 days
      const t3Date = addDays(lmp, 196);
      const t3Status = pregnancyStatusOnDay(lmp, t3Date);
      expect(t3Status.week).toBe(28);
      expect(t3Status.trimester).toBe(3);
      expect(t3Status.milestone).toBe('Trimester 3 begins · Kick counts recommended');

      // Full term at 37 weeks = 259 days
      const fullTermDate = addDays(lmp, 259);
      expect(pregnancyStatusOnDay(lmp, fullTermDate).milestone).toBe('Early term (37 weeks)');

      // Due date at 40 weeks = 280 days
      const dueDate = addDays(lmp, 280);
      const dueStatus = pregnancyStatusOnDay(lmp, dueDate);
      expect(dueStatus.week).toBe(40);
      expect(dueStatus.milestone).toBe('Estimated Due Date (40 weeks)');
    });
  });

  describe('Mode 4: Perimenopause Mode', () => {
    test('tracks days since last bleed and stage transitions', () => {
      const u = user({ mode: 'perimenopause', lastPeriodStart: '2026-08-01' });
      // 87 days since bleed on 2026-10-27 -> Late transition (>= 60 days)
      const p = computePeriStatus(u, [flow('2026-08-01')], on('2026-10-27'));
      expect(p.stage).toBe('late_transition');
      expect(p.daysSinceLastBleed).toBe(87);

      // Hot flash logging
      const logsWithHotFlashes = [
        flow('2026-08-01'),
        log('2026-10-25', { hotFlashCount: 4, sleepQuality: 'poor' }, 'perimenopause'),
        log('2026-10-26', { hotFlashCount: 2 }, 'perimenopause'),
      ];
      const p2 = computePeriStatus(u, logsWithHotFlashes, on('2026-10-27'));
      expect(p2.hotFlashAvg7).toBe(3); // (4 + 2) / 2
      expect(p2.poorSleepNights7).toBe(1);
    });
  });
});
