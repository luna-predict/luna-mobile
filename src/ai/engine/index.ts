import { AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import { getQvac, registryModel, errorMessage } from '../qvac';
import { catalogEntry } from '../catalog';
import { ModelManager } from '../../services/ModelManager';
import { CoachLanguage } from '../../types';
import { ChatTurn, EngineEvent, GenParams, GenerateResult, RunHandle, StopReason } from './types';
import { demoReply } from './demo';

export * from './types';

/**
 * One facade over on-device inference. With the native QVAC runtime it loads models via
 * @qvac/sdk and streams real tokens; without it (Expo Go) it runs the labelled demo engine.
 *
 * Memory policy (04 §4.11): models load lazily, the coach model unloads after 5 idle minutes,
 * everything unloads 60 s after the app goes to the background. Whisper unloads right after use.
 */

const IDLE_UNLOAD_MS = 5 * 60_000;
const BACKGROUND_UNLOAD_MS = 60_000;
const GB = 1024 ** 3;

type SdkLike = NonNullable<ReturnType<typeof getQvac>>;

class CoachEngine {
  private loaded = new Map<string, string>();               // catalog id → SDK model id
  private loading = new Map<string, Promise<string>>();
  private asrLanguage: string | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private demoCancelled = new Set<string>();
  private pendingCancels = new Set<string>();
  private lastStats: { loadMs?: number; tokensPerSecond?: number; ttftMs?: number } = {};

  constructor() {
    AppState.addEventListener('change', (s: AppStateStatus) => this.onAppState(s));
  }

  kind(): 'qvac' | 'demo' {
    return getQvac() ? 'qvac' : 'demo';
  }

  stats() {
    return { ...this.lastStats, loadedModels: [...this.loaded.keys()] };
  }

  isLoaded(catalogId: string): boolean {
    return this.loaded.has(catalogId);
  }

  private onAppState(state: AppStateStatus) {
    if (state === 'active') {
      if (this.bgTimer) clearTimeout(this.bgTimer);
      this.bgTimer = null;
    } else if (state === 'background' && this.loaded.size > 0) {
      this.bgTimer = setTimeout(() => { this.unloadAll().catch(() => {}); }, BACKGROUND_UNLOAD_MS);
    }
  }

  private touch(catalogId: string) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.unloadModel(catalogId).catch(() => {}); }, IDLE_UNLOAD_MS);
  }

  private ctxSize(catalogId: string): number {
    const model = catalogEntry(catalogId);
    if (model?.role === 'translator') return 2048;
    const ram = Device.totalMemory ?? 0;
    return ram >= 6 * GB ? 4096 : 2048;
  }

  /** Load (or reuse) a downloaded model. Returns the SDK model id. */
  async ensureLoaded(catalogId: string, opts: { language?: string } = {}): Promise<string> {
    const sdk = getQvac();
    if (!sdk) throw new Error('DEMO');
    const model = catalogEntry(catalogId);
    if (!model) throw new Error(`Unknown model ${catalogId}`);
    if (!ModelManager.isDownloaded(catalogId)) throw new Error(`${model.name} is not downloaded`);

    // Whisper's language is a load-time setting: reload if it changed
    if (model.role === 'asr' && this.loaded.has(catalogId) && opts.language && opts.language !== this.asrLanguage) {
      await this.unloadModel(catalogId);
    }
    const existing = this.loaded.get(catalogId);
    if (existing) return existing;
    const pending = this.loading.get(catalogId);
    if (pending) return pending;

    const started = Date.now();
    const promise = (async () => {
      const modelConfig = model.sdkModelType === 'llamacpp-completion'
        ? { ctx_size: this.ctxSize(catalogId), device: 'gpu' }
        : { language: opts.language ?? 'en' };
      const id = await sdk.loadModel({
        modelSrc: registryModel(sdk, model.sdkConstant),
        modelType: model.sdkModelType,
        modelConfig,
      } as never);
      if (model.role === 'asr') this.asrLanguage = opts.language ?? 'en';
      this.loaded.set(catalogId, id);
      this.lastStats.loadMs = Date.now() - started;
      return id;
    })();
    this.loading.set(catalogId, promise);
    try {
      return await promise;
    } finally {
      this.loading.delete(catalogId);
    }
  }

  async unloadModel(catalogId: string): Promise<void> {
    const id = this.loaded.get(catalogId);
    const sdk = getQvac();
    if (!id || !sdk) return;
    this.loaded.delete(catalogId);
    await sdk.unloadModel({ modelId: id, clearStorage: false } as never);
  }

  async unloadAll(): Promise<void> {
    for (const id of [...this.loaded.keys()]) await this.unloadModel(id);
  }

  /**
   * Stream a chat completion from the active coach model. Thinking (if any) is captured
   * separately and never shown; `onEvent` receives visible deltas only.
   */
  generate(catalogId: string, messages: ChatTurn[], params: GenParams, onEvent: (e: EngineEvent) => void, demoContext?: { fallback: string }): RunHandle {
    const sdk = getQvac();
    if (!sdk) return this.generateDemo(demoContext?.fallback ?? '', onEvent);

    let requestId = `pending-${Date.now()}`;
    const handle: RunHandle = { requestId, done: Promise.resolve({ text: '', stopReason: 'error' as StopReason }) };
    handle.done = (async (): Promise<GenerateResult> => {
      try {
        if (!this.loaded.has(catalogId)) onEvent({ type: 'loading', modelName: catalogEntry(catalogId)?.name ?? 'model' });
        const modelId = await this.ensureLoaded(catalogId);
        this.touch(catalogId);
        const started = Date.now();
        let firstToken = 0;
        const run = sdk.completion({
          modelId,
          history: messages,
          stream: true,
          captureThinking: true,
          generationParams: params,
        } as never) as unknown as {
          requestId: string;
          events: AsyncIterable<{ type: string; text?: string; stopReason?: string; stats?: { tokensPerSecond?: number }; error?: { message: string } }>;
        };
        const pendingId = requestId;
        requestId = run.requestId;
        handle.requestId = run.requestId;
        // Stop tapped while the model was still loading
        if (this.pendingCancels.delete(pendingId)) sdk.cancel({ requestId: run.requestId } as never).catch(() => {});

        let text = '';
        let stopReason: StopReason = 'eos';
        let tps: number | undefined;
        let thinkingAnnounced = false;
        for await (const ev of run.events) {
          if (ev.type === 'thinkingDelta' && !thinkingAnnounced) {
            thinkingAnnounced = true;
            onEvent({ type: 'thinking' });
          } else if (ev.type === 'contentDelta' && ev.text) {
            if (!firstToken) firstToken = Date.now();
            text += ev.text;
            onEvent({ type: 'delta', text: ev.text });
          } else if (ev.type === 'completionStats') {
            tps = ev.stats?.tokensPerSecond;
          } else if (ev.type === 'completionDone') {
            stopReason = ev.stopReason === 'length' ? 'length' : ev.stopReason === 'cancelled' ? 'cancelled' : ev.stopReason === 'error' ? 'error' : 'eos';
            if (ev.stopReason === 'error') throw new Error(ev.error?.message ?? 'Generation failed');
          }
        }
        this.lastStats.tokensPerSecond = tps;
        this.lastStats.ttftMs = firstToken ? firstToken - started : undefined;
        const result: GenerateResult = { text: stripThinking(text), stopReason, tokensPerSecond: tps };
        onEvent({ type: 'done', stopReason, tokensPerSecond: tps });
        return result;
      } catch (e) {
        const message = errorMessage(e);
        onEvent({ type: 'done', stopReason: 'error' });
        return { text: '', stopReason: 'error', error: message };
      }
    })();
    return {
      get requestId() { return handle.requestId; },
      done: handle.done,
    };
  }

  async cancel(requestId: string): Promise<void> {
    if (requestId.startsWith('demo-')) {
      this.demoCancelled.add(requestId);
      return;
    }
    if (requestId.startsWith('pending-')) {
      this.pendingCancels.add(requestId);
      return;
    }
    const sdk = getQvac();
    if (sdk) await sdk.cancel({ requestId } as never).catch(() => {});
  }

  /** Translate with TranslatePsy (the SDK applies the model's own prompt and greedy params). */
  async translate(text: string, from: CoachLanguage | 'en', to: CoachLanguage | 'en', onDelta?: (t: string) => void): Promise<string> {
    if (from === to || !text.trim()) return text;
    const sdk = getQvac();
    const translator = ModelManager.getModelForRole('translator');
    if (!sdk || !translator) throw new Error('TRANSLATOR_MISSING');
    const modelId = await this.ensureLoaded(translator.id);
    const code = (l: string) => (l === 'sw' ? 'swh_Latn' : 'en');
    const run = sdk.translate({ modelId, text, from: code(from), to: code(to), modelType: 'llm', stream: true } as never) as unknown as {
      tokenStream?: AsyncIterable<string>;
      text?: Promise<string>;
    };
    if (run.tokenStream) {
      let out = '';
      for await (const tok of run.tokenStream) {
        out += tok;
        onDelta?.(tok);
      }
      return out.trim();
    }
    return ((await run.text) ?? '').trim();
  }

  /** Speech → text with Whisper. The model is unloaded afterwards to free memory. */
  async transcribe(audioUri: string, language: CoachLanguage | 'en'): Promise<string> {
    const sdk = getQvac();
    const asr = ModelManager.getModelForRole('asr');
    if (!sdk || !asr) throw new Error('ASR_MISSING');
    const modelId = await this.ensureLoaded(asr.id, { language });
    try {
      const path = audioUri.replace(/^file:\/\//, '');
      const text = await sdk.transcribe({ modelId, audioChunk: path } as never);
      return String(text).trim();
    } finally {
      const ram = Device.totalMemory ?? 0;
      if (ram < 8 * GB) await this.unloadModel(asr.id).catch(() => {});
    }
  }

  /** Demo engine: streams the deterministic composer reply word by word. */
  private generateDemo(reply: string, onEvent: (e: EngineEvent) => void): RunHandle {
    const requestId = `demo-${Date.now()}`;
    const done = (async (): Promise<GenerateResult> => {
      onEvent({ type: 'thinking' });
      await sleep(500);
      const words = (reply || demoReply()).split(' ');
      let text = '';
      for (const w of words) {
        if (this.demoCancelled.delete(requestId)) {
          onEvent({ type: 'done', stopReason: 'cancelled' });
          return { text, stopReason: 'cancelled' };
        }
        const chunk = (text ? ' ' : '') + w;
        text += chunk;
        onEvent({ type: 'delta', text: chunk });
        await sleep(28);
      }
      onEvent({ type: 'done', stopReason: 'eos' });
      return { text, stopReason: 'eos' };
    })();
    return { requestId, done };
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Defensive: if a model emits raw <think> tags in content, drop them. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>/, '').trim();
}

export const coachEngine = new CoachEngine();
