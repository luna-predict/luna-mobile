import * as Device from 'expo-device';
import { ModelInfo, ModelRegistryEntry, ModelDownloadState } from '../types';
import { Store } from '../storage/Store';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/**
 * QVAC model catalog for LunaPredict.
 * Sizes/RAM requirements follow the QVAC model guide (GGUF Q4 quantization).
 * Download is simulated at realistic pace; production swaps `startDownload`
 * for @qvac/sdk loadModel({ onProgress }) which streams from the QVAC registry.
 */
export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: 'medpsy-1.7b-gguf',
    name: 'MedPsy 1.7B',
    family: 'QVAC MedPsy',
    category: 'llm',
    parameters: '1.7B',
    quantization: 'Q4_0 GGUF',
    sizeBytes: 1.1 * GB,
    minRamBytes: 2 * GB,
    description: 'Tether\'s medical foundation model. Beats MedGemma 4B across 7 medical benchmarks at half the size. The default Luna coach brain.',
    capabilities: ['Health chat', 'Cycle insights', 'Symptom triage', 'Clinical reasoning'],
  },
  {
    id: 'medpsy-4b-gguf',
    name: 'MedPsy 4B',
    family: 'QVAC MedPsy',
    category: 'llm',
    parameters: '4B',
    quantization: 'Q4_K_M GGUF',
    sizeBytes: 2.4 * GB,
    minRamBytes: 3.5 * GB,
    description: 'Deeper clinical reasoning — outperforms MedGemma 27B despite being 7x smaller. For flagship phones, or via P2P delegation to your desktop.',
    capabilities: ['Deep health insights', 'Multi-symptom analysis', 'Long-context RAG'],
  },
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    family: 'OpenAI Whisper',
    category: 'speech',
    parameters: '244M',
    quantization: 'GGML',
    sizeBytes: 466 * MB,
    minRamBytes: 1 * GB,
    description: 'On-device speech-to-text. Powers voice logging: "Luna, log day 14, mild cramps" — audio never leaves your phone.',
    capabilities: ['Voice logging', 'Transcription'],
  },
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B',
    family: 'Meta Llama',
    category: 'llm',
    parameters: '1B',
    quantization: 'Q4_0 GGUF',
    sizeBytes: 0.7 * GB,
    minRamBytes: 1.5 * GB,
    description: 'Ultra-light general chat fallback for low-RAM devices. Fast, but without MedPsy\'s medical depth.',
    capabilities: ['General chat', 'Quick answers'],
  },
  {
    id: 'bergamot-nmt',
    name: 'Bergamot NMT',
    family: 'Bergamot',
    category: 'translation',
    parameters: '—',
    quantization: 'ONNX',
    sizeBytes: 120 * MB,
    minRamBytes: 0.5 * GB,
    description: 'Offline neural translation between 30+ languages, for using Luna in your language.',
    capabilities: ['Offline translation'],
  },
];

export interface DeviceCapability {
  deviceName: string;
  modelName: string;
  osName: string;
  osVersion: string;
  totalRamBytes: number | null;
  isPhysicalDevice: boolean;
  /** Which catalog models this device can run locally */
  runnableModelIds: string[];
  recommendedModelId: string | null;
}

export function getDeviceCapability(): DeviceCapability {
  const totalRam = Device.totalMemory; // bytes, null on web
  const runnable = MODEL_CATALOG
    .filter(m => totalRam == null || totalRam >= m.minRamBytes)
    .map(m => m.id);

  // Recommend the strongest MedPsy the device can hold with headroom
  let recommended: string | null = null;
  if (totalRam != null && totalRam >= 5 * GB) recommended = 'medpsy-4b-gguf';
  else if (totalRam == null || totalRam >= 2 * GB) recommended = 'medpsy-1.7b-gguf';
  else recommended = 'llama-3.2-1b';

  return {
    deviceName: Device.deviceName ?? 'This device',
    modelName: Device.modelName ?? 'Unknown model',
    osName: Device.osName ?? 'Unknown OS',
    osVersion: Device.osVersion ?? '',
    totalRamBytes: totalRam,
    isPhysicalDevice: Device.isDevice,
    runnableModelIds: runnable,
    recommendedModelId: recommended,
  };
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}

type ProgressListener = (modelId: string, state: ModelDownloadState) => void;

/**
 * Download manager with persisted registry. Singleton so downloads survive
 * screen unmounts (they run on the JS timer loop while the app is foregrounded).
 */
class ModelManagerImpl {
  private registry: ModelRegistryEntry[] = [];
  private listeners = new Set<ProgressListener>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private loaded = false;

  async init(): Promise<ModelRegistryEntry[]> {
    if (!this.loaded) {
      this.registry = await Store.getModelRegistry();
      // Downloads interrupted by an app restart reset to not_downloaded
      let dirty = false;
      for (const entry of this.registry) {
        if (entry.state.status === 'downloading') {
          entry.state = { status: 'not_downloaded' };
          dirty = true;
        }
      }
      if (dirty) await Store.saveModelRegistry(this.registry);
      this.loaded = true;
    }
    return this.registry;
  }

  getEntry(modelId: string): ModelRegistryEntry | undefined {
    return this.registry.find(e => e.modelId === modelId);
  }

  getActiveModel(): ModelInfo | null {
    const active = this.registry.find(e => e.active && e.state.status === 'downloaded');
    return active ? MODEL_CATALOG.find(m => m.id === active.modelId) ?? null : null;
  }

  subscribe(fn: ProgressListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(modelId: string, state: ModelDownloadState) {
    this.listeners.forEach(fn => fn(modelId, state));
  }

  private async upsert(modelId: string, state: ModelDownloadState, active?: boolean) {
    let entry = this.getEntry(modelId);
    if (!entry) {
      entry = { modelId, state, active: active ?? false };
      this.registry.push(entry);
    } else {
      entry.state = state;
      if (active !== undefined) entry.active = active;
    }
    await Store.saveModelRegistry(this.registry);
    this.emit(modelId, state);
  }

  /**
   * Begin downloading a model from the QVAC distributed registry.
   * Simulated at ~40 MB/s of "progress"; production: @qvac/sdk loadModel onProgress.
   */
  async startDownload(modelId: string): Promise<void> {
    const model = MODEL_CATALOG.find(m => m.id === modelId);
    if (!model) throw new Error(`Unknown model ${modelId}`);
    const existing = this.getEntry(modelId);
    if (existing?.state.status === 'downloading' || existing?.state.status === 'downloaded') return;

    console.log(`[QVAC] Fetching ${model.name} from distributed model registry...`);
    await this.upsert(modelId, { status: 'downloading', progress: 0 });

    const tickMs = 300;
    const bytesPerTick = 40 * MB * (tickMs / 1000);
    let downloaded = 0;

    const timer = setInterval(async () => {
      downloaded += bytesPerTick * (0.7 + Math.random() * 0.6); // jitter like a real network
      const progress = Math.min(1, downloaded / model.sizeBytes);
      if (progress >= 1) {
        clearInterval(timer);
        this.timers.delete(modelId);
        const noActive = !this.registry.some(e => e.active && e.state.status === 'downloaded');
        await this.upsert(modelId, {
          status: 'downloaded',
          downloadedAt: new Date().toISOString(),
          path: `qvac://models/${modelId}`,
        }, noActive && model.category === 'llm' ? true : undefined);
        console.log(`[QVAC] ${model.name} ready at qvac://models/${modelId}`);
      } else {
        await this.upsert(modelId, { status: 'downloading', progress });
      }
    }, tickMs);
    this.timers.set(modelId, timer);
  }

  async cancelDownload(modelId: string): Promise<void> {
    const timer = this.timers.get(modelId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(modelId);
    }
    await this.upsert(modelId, { status: 'not_downloaded' });
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.cancelDownload(modelId);
    await this.upsert(modelId, { status: 'not_downloaded' }, false);
    console.log(`[QVAC] Unloaded and removed ${modelId} from device storage.`);
  }

  /** Mark a downloaded LLM as the active local coach brain */
  async setActive(modelId: string): Promise<void> {
    for (const entry of this.registry) {
      entry.active = entry.modelId === modelId && entry.state.status === 'downloaded';
    }
    await Store.saveModelRegistry(this.registry);
    const entry = this.getEntry(modelId);
    if (entry) this.emit(modelId, entry.state);
  }
}

export const ModelManager = new ModelManagerImpl();
