/**
 * Rule-based voice logging (08 §8.9): maps a transcript (English or Kiswahili) to log fields.
 * The result only PRE-FILLS the form; the user confirms before anything is saved.
 * Kiswahili synonyms are a draft for native-speaker review.
 */

export interface ExtractedLog {
  symptoms: string[];
  mood: string | null;
  energy: string | null;
  flow: string | null;
  bbt: number | null;
  hotFlashes: number | null;
  periodStart: boolean;
}

const SYMPTOMS: [string, RegExp][] = [
  ['cramps', /cramp|tumbo (linauma|kuuma)|maumivu ya tumbo/i],
  ['headache', /headache|head hurts|kichwa (kinauma|kuuma)|maumivu ya kichwa/i],
  ['bloating', /bloat|tumbo limejaa|kuvimbiwa/i],
  ['fatigue', /tired|fatigue|exhausted|nimechoka|uchovu/i],
  ['backache', /back (pain|ache|hurts)|mgongo/i],
  ['nausea', /nause|sick to my stomach|kichefuchefu/i],
  ['breast_tenderness', /breast|tender (breasts|chest)|matiti/i],
  ['cravings', /craving|tamaa ya chakula/i],
  ['hot_flash', /hot flash|hot flush|joto la ghafla/i],
  ['night_sweats', /night sweat|jasho usiku/i],
  ['morning_sickness', /morning sickness|kutapika asubuhi/i],
  ['heartburn', /heartburn|kiungulia/i],
  ['brain_fog', /brain fog|can'?t focus|siwezi kuzingatia/i],
];

const MOODS: [string, RegExp][] = [
  ['great', /\b(great|amazing|fantastic)\b|furaha sana/i],
  ['good', /\b(good|happy|fine)\b|nina furaha|niko poa|vizuri/i],
  ['okay', /\b(okay|ok|so-so|meh)\b|kawaida/i],
  ['down', /\b(sad|down|low mood|depressed)\b|huzuni|nina huzuni/i],
  ['stressed', /\b(stress|stressed|anxious|worried)\b|wasiwasi|msongo/i],
  ['irritable', /\b(irritable|angry|annoyed|cranky)\b|hasira|nimekasirika/i],
];

export function extractLog(transcript: string): ExtractedLog {
  const t = transcript.toLowerCase();
  const symptoms = SYMPTOMS.filter(([, re]) => re.test(t)).map(([id]) => id);
  const mood = MOODS.find(([, re]) => re.test(t))?.[0] ?? null;

  let energy: string | null = null;
  if (/low energy|no energy|tired|exhausted|nimechoka|nguvu kidogo/.test(t)) energy = 'low';
  else if (/high energy|lots of energy|energetic|nguvu nyingi/.test(t)) energy = 'high';
  else if (/normal energy|energy is (fine|normal)/.test(t)) energy = 'normal';

  let flow: string | null = null;
  if (/spotting|matone ya damu/.test(t)) flow = 'spotting';
  else if (/heavy (flow|bleeding|period)|damu nyingi/.test(t)) flow = 'heavy';
  else if (/light (flow|bleeding|period)|damu kidogo/.test(t)) flow = 'light';
  else if (/medium flow|period|bleeding|hedhi|damu/.test(t)) flow = 'medium';

  const periodStart = /period (started|came|began)|hedhi (imeanza|ilianza)|nimeanza hedhi/.test(t);

  const bbtMatch = t.match(/(?:temp(?:erature)?|bbt|joto)[^\d]{0,12}(3[4-9](?:[.,]\d{1,2})?|4[0-2](?:[.,]\d{1,2})?)/);
  const bbt = bbtMatch ? parseFloat(bbtMatch[1].replace(',', '.')) : null;

  const flashMatch = t.match(/(\d+)\s*hot (flash|flush)/);
  const hotFlashes = flashMatch ? parseInt(flashMatch[1], 10) : null;

  return { symptoms, mood, energy, flow, bbt, hotFlashes, periodStart };
}

export function isEmpty(e: ExtractedLog): boolean {
  return !e.symptoms.length && !e.mood && !e.energy && !e.flow && e.bbt == null && e.hotFlashes == null && !e.periodStart;
}
