import { extractLog } from '../../src/ai/voice/extractLog';

describe('voice log extraction', () => {
  test('English sentence fills symptoms, energy and flow', () => {
    const e = extractLog('Log mild cramps and low energy, light flow today');
    expect(e.symptoms).toContain('cramps');
    expect(e.energy).toBe('low');
    expect(e.flow).toBe('light');
  });

  test('Kiswahili sentence', () => {
    const e = extractLog('Leo nina maumivu ya tumbo kidogo, nimechoka');
    expect(e.symptoms).toEqual(expect.arrayContaining(['cramps', 'fatigue']));
    expect(e.energy).toBe('low');
  });

  test('temperature and period start', () => {
    const e = extractLog('My period started, temperature 36.7');
    expect(e.periodStart).toBe(true);
    expect(e.bbt).toBe(36.7);
  });

  test('nothing recognisable stays empty', () => {
    const e = extractLog('remind me to buy bread');
    expect(e.symptoms).toEqual([]);
    expect(e.flow).toBeNull();
  });
});
