import { CoachLanguage, HealthFlag } from '../../types';

/**
 * Runs BEFORE the model, in plain code; the model can't override it (04 §4.10, 08 §8.8).
 * Swahili terms are a DRAFT and must be reviewed by a native speaker before release.
 */

export type TriageLevel = 'emergency' | 'urgent' | 'caution' | 'ok';

export interface TriageResult {
  level: TriageLevel;
  matched?: string;
}

const EMERGENCY_EN: RegExp[] = [
  /chest pain|pain in (my )?chest/i,
  /can'?t breathe|cannot breathe|trouble breathing|short(ness)? of breath/i,
  /faint(ed|ing)?|passed out|unconscious|collapse/i,
  /suicid|kill myself|end my life|want to die|hurt myself|self[- ]harm/i,
  /soak(ing|ed)? (a|one|my)? ?pad (every|each) hour|bleeding (very )?heavily.*(pregnan|weeks)|pregnan.*bleeding (very )?heavily/i,
  /severe headache.*(vision|blurr|see)|(vision|blurr).*severe headache/i,
  /seizure|convulsion|fit(s)? while pregnant/i,
  /(water|waters) broke.*(green|brown|blood)|baby (is )?not moving|no (baby )?movement/i,
];

const EMERGENCY_SW: RegExp[] = [
  /maumivu (makali )?ya kifua/i,          // chest pain
  /siwezi kupumua|kushindwa kupumua/i,    // can't breathe
  /kuzimia|nimezimia/i,                   // fainting
  /kujiua|kujidhuru|nataka kufa/i,        // suicide / self-harm / want to die
  /damu nyingi/i,                         // heavy bleeding
  /mtoto hachezi|mtoto hasogei/i,         // baby not moving
  /degedege|kifafa/i,                     // convulsions
];

const URGENT: RegExp[] = [
  /one[- ]sided (pelvic|lower|belly|abdominal) pain|sharp pain on one side/i,
  /fever.*(pelvic|lower (belly|abdomen)|discharge)|(pelvic|lower belly).*fever/i,
  /(less|fewer|reduced|decreased) (baby )?movement|baby (is )?moving less/i,
  /bleed(ing)? after menopause|postmenopausal bleeding/i,
  /bleed(ing)?.*pregnan|pregnan.*bleed(ing)?|spotting.*pregnan/i,
  /homa.*(tumbo|nyonga)/i,
];

const CAUTION: RegExp[] = [
  /\b(dose|dosage|mg|milligram|how (much|many) (pills|tablets))\b/i,
  /\b(ibuprofen|paracetamol|acetaminophen|aspirin|antibiotic|pill|medication|medicine|supplement|contracepti)/i,
  /is it safe|can i take/i,
  /dawa|vidonge/i,
];

export function triage(text: string, flags: HealthFlag[] = []): TriageResult {
  for (const re of [...EMERGENCY_EN, ...EMERGENCY_SW]) {
    const m = text.match(re);
    if (m) return { level: 'emergency', matched: m[0] };
  }
  for (const re of URGENT) {
    const m = text.match(re);
    if (m) return { level: 'urgent', matched: m[0] };
  }
  if (flags.some(f => f.severity === 'urgent')) return { level: 'urgent', matched: 'active urgent flag' };
  for (const re of CAUTION) {
    const m = text.match(re);
    if (m) return { level: 'caution', matched: m[0] };
  }
  return { level: 'ok' };
}

/** Combine triage of the original text and its English translation: the stricter wins. */
export function strictest(a: TriageResult, b: TriageResult): TriageResult {
  const rank: Record<TriageLevel, number> = { emergency: 3, urgent: 2, caution: 1, ok: 0 };
  return rank[a.level] >= rank[b.level] ? a : b;
}

/** Human-written emergency card. Never machine-translated. */
export function emergencyCard(language: CoachLanguage): string {
  if (language === 'sw') {
    return 'Hii inaweza kuwa dharura. Piga simu ya dharura sasa hivi: 999 au 112 (Kenya), au nambari ya dharura ya eneo lako. '
      + 'Kama uko na mtu, mwambie akae nawe. Usisubiri jibu la AI.';
  }
  return 'This could be an emergency. Call emergency services now: 999 or 112 in Kenya, or your local emergency number. '
    + 'If someone is with you, ask them to stay with you. Please don\'t wait for an AI answer.';
}

export function urgentNote(language: CoachLanguage): string {
  return language === 'sw'
    ? 'Tafadhali wasiliana na daktari au kituo cha afya leo.'
    : 'Please contact a doctor, midwife or clinic today.';
}

export function cautionNote(language: CoachLanguage): string {
  return language === 'sw'
    ? 'Muulize mfamasia au daktari kabla ya kutumia dawa yoyote.'
    : 'Check with a pharmacist or clinician before taking anything.';
}
