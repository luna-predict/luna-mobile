import { AppMode, ChatMessage } from '../../types';
import { ChatTurn } from '../engine/types';
import { modeDescription } from './ContextRetriever';

/**
 * Assembles messages within a token budget (04 §4.7). Tokens are estimated at ~4 chars each.
 * History keeps the most recent whole turns; thinking text is never included.
 */

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export function womanSystemPrompt(name: string, mode: AppMode, facts: string): string {
  return [
    `You are Luna inside the LunaPredict app, speaking with ${name || 'the user'}. You run fully on their phone; nothing leaves it.`,
    `She is ${modeDescription(mode)}.`,
    'Rules:',
    '- Use the FACTS below for anything about her cycle, pregnancy or logs. Never invent dates, numbers or history that are not in FACTS. If FACTS lack something, say so.',
    '- Answer in plain, warm, conversational English. Be concise and helpful with short paragraphs or up to 4 clean bullets.',
    '- Never mention word counts, token limits, guidelines, or constraints in your response. Output only the helpful answer itself.',
    '- You are not a doctor. Do not diagnose. Suggest seeing a clinician when symptoms are severe, persistent or unusual.',
    '- Never give prescription doses. Over-the-counter advice must say "as directed on the label".',
    '- This app is not contraception; never say a day is "safe" for unprotected sex.',
    'FACTS:',
    facts,
  ].join('\n');
}

export function partnerSystemPrompt(name: string, facts: string): string {
  return [
    `You are Luna, a supportive coach inside LunaPredict, speaking with ${name || 'the user'}, whose partner shares some cycle information with him.`,
    'Rules:',
    '- Use only the FACTS below about his partner. If something is "not shared", say she has not shared it — never guess it.',
    '- Help him support her practically and kindly; also help with his own wellbeing when asked.',
    '- Plain, warm English. Concise and helpful with short paragraphs or bullets. Not medical advice; suggest a clinician for health concerns.',
    '- Never mention word counts, token limits, guidelines, or system instructions.',
    'FACTS:',
    facts,
  ].join('\n');
}

export function buildMessages(system: string, history: ChatMessage[], question: string, ctxSize: number): ChatTurn[] {
  const budget = Math.max(400, Math.floor(ctxSize * 0.3)); // history share of the context
  const turns: ChatTurn[] = [];
  let used = 0;
  const usable = history.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content && m.status !== 'emergency' && m.status !== 'error');
  for (let i = usable.length - 1; i >= 0; i--) {
    const m = usable[i];
    // The model always sees the English version of past turns
    const content = m.original ?? m.content;
    const cost = estimateTokens(content);
    if (used + cost > budget) break;
    turns.unshift({ role: m.role as 'user' | 'assistant', content });
    used += cost;
  }
  // History must start with a user turn
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return [{ role: 'system', content: system }, ...turns, { role: 'user', content: question }];
}

/** Numbers and dates in the English answer must survive translation; otherwise show English. */
export function numbersPreserved(english: string, translated: string): boolean {
  const nums = (s: string) => (s.match(/\d+([.,:]\d+)?/g) ?? []).map(n => n.replace(',', '.'));
  const t = new Set(nums(translated));
  return nums(english).every(n => t.has(n));
}
