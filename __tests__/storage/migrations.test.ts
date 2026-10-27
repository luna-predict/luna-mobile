import { migrateLogsToV2, migrateCheckInsToV2 } from '../../src/storage/migrations';

describe('schema v2 migration', () => {
  test('a UTC instant saved at 01:30 local becomes that local day', () => {
    const instant = new Date(2026, 9, 27, 1, 30).toISOString();
    const [l] = migrateLogsToV2([{ id: '1', date: instant, symptoms: [], mood: null, energy: null, flow: null, notes: '', mode: 'period' }]);
    expect(l.day).toBe('2026-10-27');
    expect(l.date).toBe('2026-10-27');
    expect(l.loggedAt).toBe(instant);
  });

  test('duplicates for the same day and mode collapse to the newest', () => {
    const a = new Date(2026, 9, 27, 9, 0).toISOString();
    const b = new Date(2026, 9, 27, 21, 0).toISOString();
    const base = { symptoms: [], energy: null, flow: null, notes: '', mode: 'period' as const };
    const out = migrateLogsToV2([
      { ...base, id: 'a', date: a, mood: 'down' },
      { ...base, id: 'b', date: b, mood: 'good' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].mood).toBe('good');
  });

  test('already-migrated logs pass through unchanged', () => {
    const log = { id: 'x', day: '2026-10-01', date: '2026-10-01', loggedAt: '2026-10-01T10:00:00.000Z', symptoms: [], mood: null, energy: null, flow: 'medium', notes: '', mode: 'period' as const };
    expect(migrateLogsToV2([log])[0]).toEqual(log);
  });

  test('check-ins get a local day too', () => {
    const instant = new Date(2026, 9, 27, 0, 15).toISOString();
    const [c] = migrateCheckInsToV2([{ id: 'c', date: instant, mood: 'good', energy: null, stress: null, notes: '' }]);
    expect(c.day).toBe('2026-10-27');
  });
});
