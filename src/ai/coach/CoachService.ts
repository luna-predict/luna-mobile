import * as Device from 'expo-device';
import { ChatMessage, CoachLanguage, HealthFlag, MenCheckIn, SharedSnapshot } from '../../types';
import { coachEngine, COACH_PARAMS, GenParams } from '../engine';
import { ModelManager } from '../../services/ModelManager';
import { triage, strictest, emergencyCard, urgentNote, cautionNote, TriageResult } from './SafetyTriage';
import { buildWomanFacts, buildPartnerFacts, relevantLogs, WomanFacts } from './ContextRetriever';
import { womanSystemPrompt, partnerSystemPrompt, buildMessages, numbersPreserved } from './PromptBuilder';
import { composeReply, composePartnerReply } from '../InsightComposer';

/**
 * One coach turn: triage → (translate in) → facts + prompt → generate → (translate out) → notes.
 * Pipeline: docs/archi-docs/04-local-ai-qvac.md §4.6 and 08-voice-and-languages.md §8.3.
 */

export type CoachStage = 'translating_in' | 'loading' | 'thinking' | 'answering' | 'translating_out';

export interface AskCallbacks {
  onStage: (stage: CoachStage, detail?: string) => void;
  onText: (text: string) => void;
}

export interface AskInput {
  question: string;
  language: CoachLanguage;
  history: ChatMessage[];
  flags: HealthFlag[];
  userName: string;
  woman?: Omit<WomanFacts, 'question'>;
  partner?: { snapshot: SharedSnapshot | null; checkIns: MenCheckIn[]; today: string };
  params?: Partial<GenParams>;
}

export interface CoachRun {
  cancel: () => void;
  done: Promise<ChatMessage>;
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function message(content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: id(), role: 'assistant', content, timestamp: new Date().toISOString(), engine: coachEngine.kind(), ...extra };
}

export function ask(input: AskInput, cb: AskCallbacks): CoachRun {
  let cancelled = false;
  let current: { requestId: string } | null = null;
  const lang = input.language;

  const done = (async (): Promise<ChatMessage> => {
    let tri: TriageResult = triage(input.question, input.flags);
    if (tri.level === 'emergency') return message(emergencyCard(lang), { status: 'emergency', language: lang });

    const engineKind = coachEngine.kind();
    let questionEn = input.question;
    let translateOut = false;

    if (lang === 'sw' && engineKind === 'qvac') {
      if (!ModelManager.getModelForRole('translator')) {
        return message('To chat in Kiswahili, download the Kiswahili pack (TranslatePsy) on the AI Models screen first.', { status: 'error', language: 'en' });
      }
      cb.onStage('translating_in');
      try {
        questionEn = await coachEngine.translate(input.question, 'sw', 'en');
      } catch {
        return message('Sorry — I could not translate that. Please try again, or switch Luna to English.', { status: 'error', language: 'en' });
      }
      tri = strictest(tri, triage(questionEn, input.flags));
      if (tri.level === 'emergency') return message(emergencyCard(lang), { status: 'emergency', language: lang });
      translateOut = true;
    }
    if (cancelled) return message('', { status: 'stopped' });

    const active = ModelManager.getActiveModel();
    if (engineKind === 'qvac' && !active) {
      return message('No coach model is downloaded yet. Open AI Models and download MedPsy 1.7B to chat offline.', { status: 'error', language: 'en' });
    }

    // Prompt
    const ctx = (Device.totalMemory ?? 0) >= 6 * 1024 ** 3 ? 4096 : 2048;
    let system: string;
    let fallback: string;
    if (input.partner) {
      system = partnerSystemPrompt(input.userName, buildPartnerFacts(input.partner.snapshot, input.partner.checkIns, input.partner.today));
      fallback = composePartnerReply(questionEn, input.partner.snapshot?.phase, input.partner.snapshot?.sharerName ?? 'your partner');
    } else {
      const w = input.woman!;
      system = womanSystemPrompt(input.userName, w.user.mode, buildWomanFacts({ ...w, question: questionEn }));
      fallback = composeReply({
        mode: w.user.mode, question: questionEn, cycle: w.cycle, depth: 'compact',
        recentLogs: relevantLogs(questionEn, w.logs, w.user.mode, w.today),
      });
    }
    if (tri.level === 'urgent') system += '\nIMPORTANT: this may need same-day care. Tell them clearly to contact a clinician, midwife or clinic today.';
    const messages = buildMessages(system, input.history, questionEn, ctx);

    // Generate
    let english = '';
    const handle = coachEngine.generate(
      active?.id ?? 'demo',
      messages,
      { ...COACH_PARAMS, ...input.params },
      ev => {
        if (ev.type === 'loading') cb.onStage('loading', ev.modelName);
        else if (ev.type === 'thinking') cb.onStage('thinking');
        else if (ev.type === 'delta') {
          if (!english) cb.onStage('answering');
          english += ev.text;
          if (!translateOut) cb.onText(english.trimStart());
        }
      },
      { fallback },
    );
    current = handle;
    if (cancelled) coachEngine.cancel(handle.requestId).catch(() => {});
    const result = await handle.done;
    current = null;

    if (result.stopReason === 'error') {
      const reason = result.error?.toLowerCase() ?? '';
      const text = reason.includes('memory') || reason.includes('oom')
        ? 'Not enough free memory to run the model. Close other apps, or switch to the smaller model on the AI Models screen.'
        : 'Sorry — the on-device model hit a problem. Please try again.';
      return message(text, { status: 'error', language: 'en' });
    }

    let content = result.text;
    let original: string | undefined;
    let outLang: CoachLanguage = 'en';
    if (translateOut && content && result.stopReason !== 'cancelled' && !cancelled) {
      cb.onStage('translating_out');
      try {
        let sw = '';
        const translated = await coachEngine.translate(content, 'en', 'sw', d => { sw += d; cb.onText(sw.trimStart()); });
        if (numbersPreserved(content, translated)) {
          original = content;
          content = translated;
          outLang = 'sw';
        } else {
          content = `${content}\n\n(Shown in English: the translation changed a number or date.)`;
        }
      } catch {
        content = `${content}\n\n(Shown in English: translation failed.)`;
      }
    }

    const notes: string[] = [];
    if (tri.level === 'urgent') notes.unshift(urgentNote(outLang));
    if (tri.level === 'caution') notes.push(cautionNote(outLang));
    const finalText = tri.level === 'urgent'
      ? `${notes[0]}\n\n${content}`
      : notes.length ? `${content}\n\n${notes.join(' ')}` : content;

    return message(finalText, {
      status: result.stopReason === 'cancelled' || cancelled ? 'stopped' : result.stopReason === 'length' ? 'cut_short' : 'done',
      original,
      language: outLang,
      tokensPerSecond: result.tokensPerSecond,
    });
  })();

  return {
    cancel: () => {
      cancelled = true;
      if (current) coachEngine.cancel(current.requestId).catch(() => {});
    },
    done,
  };
}
