import { triage, strictest, emergencyCard } from '../../src/ai/coach/SafetyTriage';
import { buildMessages, numbersPreserved, womanSystemPrompt } from '../../src/ai/coach/PromptBuilder';
import { buildWomanFacts } from '../../src/ai/coach/ContextRetriever';
import { computeCycleStatus } from '../../src/domain';
import { ChatMessage } from '../../src/types';
import { user, flow, log, on } from '../domain/fixtures';

describe('safety triage', () => {
  test.each([
    'I have chest pain and feel dizzy',
    "I can't breathe properly",
    'I want to kill myself',
    "I'm 30 weeks pregnant and bleeding heavily",
    'I am soaking a pad every hour',
    'Nina maumivu ya kifua',
    'Natokwa na damu nyingi',
    'mtoto hachezi tangu jana',
  ])('emergency: %s', q => expect(triage(q).level).toBe('emergency'));

  test.each([
    'Why am I so tired?',
    'What helps with cramps?',
    'Heavy flow on day 1, is that normal for me?',
    'When is my next period?',
    'Kwa nini nimechoka sana?',
  ])('no false alarm: %s', q => expect(['ok', 'caution']).toContain(triage(q).level));

  test('medication questions get a caution note', () => {
    expect(triage('Can I take ibuprofen for cramps?').level).toBe('caution');
  });

  test('reduced movement is urgent, not ignored', () => {
    expect(triage('The baby is moving less today').level).toBe('urgent');
  });

  test('stricter of original and translation wins', () => {
    expect(strictest({ level: 'ok' }, { level: 'emergency' }).level).toBe('emergency');
  });

  test('emergency card is human-written in both languages', () => {
    expect(emergencyCard('en')).toContain('999');
    expect(emergencyCard('sw')).toContain('999');
  });
});

describe('prompt builder', () => {
  test('facts come from the engine, including late status', () => {
    const logs = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23'].map(d => flow(d));
    const u = user();
    const cycle = computeCycleStatus(u, logs, on('2026-10-27'));
    const facts = buildWomanFacts({ user: u, today: '2026-10-27', cycle, pregnancy: null, peri: null, flags: [], logs, question: 'is my period late?' });
    expect(facts).toContain('6 days LATE');
    expect(womanSystemPrompt('Amani', 'period', facts)).toContain('Never invent dates');
  });

  test('history keeps whole recent turns within budget and starts with a user turn', () => {
    const history: ChatMessage[] = [];
    for (let i = 0; i < 40; i++) {
      history.push({ id: `u${i}`, role: 'user', content: `question ${i} `.repeat(20) });
      history.push({ id: `a${i}`, role: 'assistant', content: `answer ${i} `.repeat(20) });
    }
    const msgs = buildMessages('SYSTEM', history, 'latest?', 2048);
    expect(msgs[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(msgs[1].role).toBe('user');
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'latest?' });
    expect(msgs.length).toBeLessThan(20);
  });

  test('translated history is sent to the model in English', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'habari' },
      { id: '2', role: 'assistant', content: 'Jibu kwa Kiswahili', original: 'Answer in English' },
    ];
    const msgs = buildMessages('S', history, 'q', 4096);
    expect(msgs.map(m => m.content)).toContain('Answer in English');
  });

  test('numbers check catches a changed date', () => {
    expect(numbersPreserved('Your period is due on 21 October, in 6 days.', 'Hedhi yako inatarajiwa 21 Oktoba, baada ya siku 6.')).toBe(true);
    expect(numbersPreserved('Take 200 mg', 'Chukua 2000 mg')).toBe(false);
  });

  test('relevant logs are included in facts', () => {
    const u = user();
    const logs = [log('2026-10-25', { symptoms: ['fatigue'], notes: 'long shift' })];
    const facts = buildWomanFacts({ user: u, today: '2026-10-27', cycle: null, pregnancy: null, peri: null, flags: [], logs, question: 'why fatigue lately' });
    expect(facts).toContain('long shift');
  });
});
