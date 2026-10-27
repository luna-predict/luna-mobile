import { computeCycleStatus, computePregnancyStatus, computePeriStatus, buildEpisodes, detectOvulation, computeFlags } from '../../src/domain';
import { user, log, flow, on } from './fixtures';

/** Test vectors V1–V12 from docs/archi-docs/03-tracking-algorithms.md */

const REGULAR = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23'];

describe('cycle engine', () => {
  test('V1 seed only, last period 14 days ago', () => {
    const s = computeCycleStatus(user({ lastPeriodStart: '2026-10-13' }), [], on('2026-10-27'));
    expect(s.cycleDay).toBe(15);
    expect(s.nextPeriodDate).toBe('2026-11-10');
    expect(s.nextPeriodRange).toEqual({ start: '2026-11-07', end: '2026-11-13' });
    expect(s.confidence).toBe('seed');
    expect(s.status).toBe('on_track');
  });

  test('V2 seed only, 68 days since last period, no flow ever logged → assumed', () => {
    const s = computeCycleStatus(user({ lastPeriodStart: '2026-08-20' }), [], on('2026-10-27'));
    expect(s.status).toBe('assumed');
    expect(s.cycleDay).toBe(13);
  });

  test('V3 regular logger whose period is 6 days late', () => {
    const s = computeCycleStatus(user(), REGULAR.map(d => flow(d)), on('2026-10-27'));
    expect(s.status).toBe('late');
    expect(s.daysLate).toBe(6);
    expect(s.cycleDay).toBe(35);
    expect(s.cycleLength).toBe(28);
    expect(s.confidence).toBe('established');
    expect(s.phaseLabel).toBe('Period late');
    expect(s.inFertileWindow).toBe(false);
  });

  test('V4 mid-cycle spotting does not start a period', () => {
    const logs = [...REGULAR.map(d => flow(d)), flow('2026-10-09', 'spotting')];
    const s = computeCycleStatus(user(), logs, on('2026-10-15'));
    expect(s.cycleLength).toBe(28);
    expect(s.cycleDay).toBe(23);
    expect(s.nextPeriodDate).toBe('2026-10-21');
  });

  test('V5 very irregular cycles are labelled irregular', () => {
    const starts = ['2026-03-01', '2026-04-20', '2026-05-10', '2026-07-15', '2026-08-05'];
    const s = computeCycleStatus(user(), starts.map(d => flow(d, 'heavy')), on('2026-08-20'));
    expect(s.confidence).toBe('irregular');
    expect(s.spread).toBe(46);
  });

  test('V7 v1 UTC timestamps map back to the local day (covered by dayOf)', () => {
    const { dayOf } = require('../../src/domain');
    const instant = new Date(2026, 9, 27, 1, 30).toISOString(); // 01:30 local
    expect(dayOf({ date: instant })).toBe('2026-10-27');
  });

  test('V12 a missed month is not averaged in', () => {
    const starts = ['2026-03-01', '2026-03-29', '2026-04-26', '2026-05-24', '2026-07-19'];
    const s = computeCycleStatus(user(), starts.map(d => flow(d)), on('2026-07-25'));
    expect(s.history.find(h => h.length === 56)?.suspectedMissedLog).toBe(true);
    expect(s.cycleLength).toBe(28);
  });

  test('a multi-day period counts as one episode and sets period length', () => {
    const logs = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'].map(d => flow(d));
    const eps = buildEpisodes(logs);
    expect(eps).toHaveLength(1);
    expect(eps[0].length).toBe(5);
  });

  test('explicit period start overrides the 15-day rule', () => {
    const logs = [flow('2026-10-01'), log('2026-10-12', { flow: 'light', periodStart: true })];
    const eps = buildEpisodes(logs);
    expect(eps.filter(e => e.startsCycle)).toHaveLength(2);
  });
});

describe('ovulation detection', () => {
  test('V8 BBT 3-over-6 confirms ovulation the day before the shift', () => {
    const logs = [];
    for (let d = 8; d <= 15; d++) logs.push(log(`2026-10-${String(d).padStart(2, '0')}`, { bbt: d % 2 ? 36.3 : 36.4 }, 'conceive'));
    logs.push(log('2026-10-16', { bbt: 36.7 }, 'conceive'), log('2026-10-17', { bbt: 36.8 }, 'conceive'), log('2026-10-18', { bbt: 36.75 }, 'conceive'));
    expect(detectOvulation(logs, '2026-10-01')).toEqual({ day: '2026-10-15', source: 'bbt', status: 'confirmed' });
  });

  test('V9 first positive OPK → ovulation next day', () => {
    const logs = [log('2026-10-12', { opkResult: 'negative' }), log('2026-10-13', { opkResult: 'positive' })];
    expect(detectOvulation(logs, '2026-10-01')).toEqual({ day: '2026-10-14', source: 'opk', status: 'likely' });
  });

  test('logged OPK moves the cycle ovulation estimate', () => {
    const logs = [flow('2026-10-01', 'medium', 'conceive'), log('2026-10-12', { opkResult: 'positive' }, 'conceive')];
    const s = computeCycleStatus(user({ mode: 'conceive' }), logs, on('2026-10-13'));
    expect(s.ovulationDate).toBe('2026-10-13');
    expect(s.ovulationStatus).toBe('likely');
  });
});

describe('pregnancy', () => {
  test('V10 post-dates shows 41w 0d and raises a flag', () => {
    const u = user({ mode: 'pregnancy', pregnancy: { lmp: '2026-01-13', dueDate: '2026-10-20', source: 'lmp' } });
    const p = computePregnancyStatus(u, on('2026-10-27'))!;
    expect(p.label).toBe('41w 0d');
    expect(p.postDates).toBe(true);
    const flags = computeFlags({ user: u, logs: [], cycle: null, pregnancy: p, peri: null, now: on('2026-10-27') });
    expect(flags.map(f => f.id)).toContain('post_dates');
  });

  test('V11 13w3d is still trimester 1', () => {
    const p = computePregnancyStatus(user({ dueDate: '2027-05-01' }), on('2026-10-27'))!;
    expect(p.label).toBe('13w 3d');
    expect(p.trimester).toBe(1);
  });

  test('bleeding in pregnancy is an urgent flag', () => {
    const u = user({ mode: 'pregnancy', dueDate: '2027-02-01' });
    const p = computePregnancyStatus(u, on('2026-10-27'))!;
    const flags = computeFlags({ user: u, logs: [flow('2026-10-27', 'light', 'pregnancy')], cycle: null, pregnancy: p, peri: null, now: on('2026-10-27') });
    expect(flags[0]).toMatchObject({ id: 'preg_bleeding', severity: 'urgent' });
  });
});

describe('perimenopause', () => {
  test('V6 six months without a period → late transition, no countdown', () => {
    const s = computePeriStatus(user({ mode: 'perimenopause', lastPeriodStart: '2026-04-27' }), [], on('2026-10-27'));
    expect(s.stage).toBe('late_transition');
    expect(s.daysSinceLastBleed).toBe(183);
  });

  test('12 months without bleeding → postmenopause', () => {
    const s = computePeriStatus(user({ mode: 'perimenopause', lastPeriodStart: '2025-09-01' }), [], on('2026-10-27'));
    expect(s.stage).toBe('postmenopause');
  });
});
