import { ModelInfo } from '../types';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/**
 * On-device models, all loaded from the QVAC SDK registry (checksum-pinned).
 * Sizes are the published file sizes; the live total comes from download progress.
 * See docs/archi-docs/04-local-ai-qvac.md §4.2 and 08-voice-and-languages.md §8.5.
 */
export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: 'medpsy-1.7b',
    name: 'MedPsy 1.7B',
    family: 'QVAC MedPsy',
    category: 'llm',
    parameters: '1.7B',
    quantization: 'Q4_K_M',
    sizeBytes: 1.28 * GB,
    description: 'Tether\'s medical model, tuned for phones. Luna\'s default brain — answers about your cycle, symptoms and health.',
    capabilities: ['Health chat', 'Cycle insights', 'Symptom questions'],
    sdkConstant: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M',
    sdkModelType: 'llamacpp-completion',
    medical: true,
    role: 'coach',
  },
  {
    id: 'medpsy-4b',
    name: 'MedPsy 4B',
    family: 'QVAC MedPsy',
    category: 'llm',
    parameters: '4B',
    quantization: 'Q4_K_M',
    sizeBytes: 2.72 * GB,
    description: 'Deeper medical reasoning for flagship phones with plenty of memory.',
    capabilities: ['Deeper answers', 'Multi-symptom questions'],
    sdkConstant: 'HEALTHCARE_4B_MEDICAL_Q4_K_M',
    sdkModelType: 'llamacpp-completion',
    medical: true,
    role: 'coach',
  },
  {
    id: 'qwen3-0.6b',
    name: 'Quick answers (Qwen3 0.6B)',
    family: 'Qwen3',
    category: 'llm',
    parameters: '0.6B',
    quantization: 'Q4',
    sizeBytes: 400 * MB,
    description: 'Small and fast general model for low-memory phones. Not medically tuned — MedPsy is better for health questions.',
    capabilities: ['Fast replies', 'Low memory'],
    sdkConstant: 'QWEN3_600M_INST_Q4',
    sdkModelType: 'llamacpp-completion',
    medical: false,
    role: 'coach-light',
  },
  {
    id: 'translatepsy-0.8b',
    name: 'Kiswahili pack (TranslatePsy)',
    family: 'QVAC TranslatePsy-AfriSLM',
    category: 'translation',
    parameters: '0.8B',
    quantization: 'Q4_K_M',
    sizeBytes: 641 * MB,
    description: 'Translates between English and 19 African languages on your phone, so Luna can chat in Kiswahili.',
    capabilities: ['Kiswahili chat', 'Offline translation'],
    sdkConstant: 'TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M',
    sdkModelType: 'llamacpp-completion',
    medical: false,
    role: 'translator',
  },
  {
    id: 'whisper-small',
    name: 'Voice input (Whisper small)',
    family: 'Whisper',
    category: 'speech',
    parameters: '244M',
    quantization: 'Q8_0',
    sizeBytes: 252 * MB,
    description: 'Turns your voice into text on-device. Audio never leaves your phone. Works best in English; Kiswahili is good but not perfect.',
    capabilities: ['Voice questions', 'Voice logging'],
    sdkConstant: 'WHISPER_SMALL_Q8_0',
    sdkModelType: 'whispercpp-transcription',
    medical: false,
    role: 'asr',
  },
];

export function catalogEntry(id: string): ModelInfo | undefined {
  return MODEL_CATALOG.find(m => m.id === id);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}
