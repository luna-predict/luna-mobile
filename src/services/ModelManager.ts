import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import { ModelInfo, ModelRegistryEntry, ModelDownloadState } from '../types';
import { Store } from '../storage/Store';
import { MODEL_CATALOG, catalogEntry, formatBytes } from '../ai/catalog';
import { getQvac, registryModel, errorMessage } from '../ai/qvac';

export { MODEL_CATALOG, formatBytes };

/**
 * Real model downloads through the QVAC SDK registry (checksum-verified).
 * Lifecycle: not_downloaded → downloading → (paused) → downloaded | error.
 * See docs/archi-docs/04-local-ai-qvac.md §4.3.
 */

export interface DeviceCapability {
  deviceName: string;
  modelName: string;
  totalRamBytes: number | null;
  freeDiskBytes: number | null;
  isPhysicalDevice: boolean;
}

export function getDeviceCapability(): DeviceCapability {
  let freeDisk: number | null = null;
  try { freeDisk = Paths.availableDiskSpace; } catch { freeDisk = null; }
  return {
    deviceName: Device.deviceName ?? 'This phone',
    modelName: Device.modelName ?? 'Unknown model',
    totalRamBytes: Device.totalMemory ?? null,
    freeDiskBytes: freeDisk,
    isPhysicalDevice: Device.isDevice,
  };
}

export type FitVerdict = 'likely-fits' | 'likely-too-large' | 'unknown';

type Listener = (modelId: string, state: ModelDownloadState) => void;

class ModelManagerImpl {
  private registry: ModelRegistryEntry[] = [];
  private listeners = new Set<Listener>();
  private requests = new Map<string, string>();      // modelId → SDK requestId
  private pausing = new Set<string>();
  private lastEmit = new Map<string, number>();
  private loaded = false;

  async init(): Promise<ModelRegistryEntry[]> {
    if (this.loaded) return this.registry;
    this.registry = (await Store.getModelRegistry()).filter(e => catalogEntry(e.modelId));
    for (const e of this.registry) {
      // A download interrupted by an app restart resumes from where it stopped
      if (e.state.status === 'downloading') e.state = { status: 'paused', progress: e.state.progress };
    }
    this.loaded = true;
    await this.reconcileWithCache();
    await this.persist();
    return this.registry;
  }

  /** Trust the SDK cache over our registry (files may have been cleared by the OS or a reinstall). */
  private async reconcileWithCache() {
    const sdk = getQvac();
    if (!sdk) return;
    for (const model of MODEL_CATALOG) {
      try {
        const info = await sdk.getModelInfo(registryModel(sdk, model.sdkConstant) as never);
        const entry = this.getEntry(model.id);
        if (info.isCached && entry?.state.status !== 'downloaded') {
          this.setState(model.id, { status: 'downloaded', downloadedAt: new Date().toISOString() });
        } else if (!info.isCached && entry?.state.status === 'downloaded') {
          this.setState(model.id, { status: 'not_downloaded' });
        }
      } catch {
        // registry unreachable or constant missing — keep what we have
      }
    }
    this.ensureActiveCoach();
  }

  getEntry(modelId: string): ModelRegistryEntry | undefined {
    return this.registry.find(e => e.modelId === modelId);
  }

  stateFor(modelId: string): ModelDownloadState {
    return this.getEntry(modelId)?.state ?? { status: 'not_downloaded' };
  }

  isDownloaded(modelId: string): boolean {
    return this.stateFor(modelId).status === 'downloaded';
  }

  /** The LLM that answers in the Coach. */
  getActiveModel(): ModelInfo | null {
    const active = this.registry.find(e => e.active && e.state.status === 'downloaded');
    return active ? catalogEntry(active.modelId) ?? null : null;
  }

  /** First downloaded model for a supporting role (translator / asr). */
  getModelForRole(role: ModelInfo['role']): ModelInfo | null {
    return MODEL_CATALOG.find(m => m.role === role && this.isDownloaded(m.id)) ?? null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(modelId: string, state: ModelDownloadState, force = false) {
    // Progress events can arrive many times a second; throttle UI updates to ~5/s
    const now = Date.now();
    if (!force && now - (this.lastEmit.get(modelId) ?? 0) < 200) return;
    this.lastEmit.set(modelId, now);
    this.listeners.forEach(fn => fn(modelId, state));
  }

  private setState(modelId: string, state: ModelDownloadState, active?: boolean) {
    let entry = this.getEntry(modelId);
    if (!entry) {
      entry = { modelId, state, active: active ?? false };
      this.registry.push(entry);
    } else {
      entry.state = state;
      if (active !== undefined) entry.active = active;
    }
  }

  private async update(modelId: string, state: ModelDownloadState, active?: boolean) {
    this.setState(modelId, state, active);
    const final = state.status !== 'downloading';
    if (final) await this.persist();
    this.emit(modelId, state, final);
  }

  async persist(): Promise<void> {
    await Store.saveModelRegistry(this.registry);
  }

  private ensureActiveCoach() {
    if (this.getActiveModel()) return;
    for (const e of this.registry) e.active = false;
    const firstCoach = MODEL_CATALOG.find(m => (m.role === 'coach' || m.role === 'coach-light') && this.isDownloaded(m.id));
    if (firstCoach) this.getEntry(firstCoach.id)!.active = true;
  }

  /** Ask the SDK whether this model should fit in memory (without downloading anything). */
  async assessFit(modelId: string, ctxSize = 2048): Promise<FitVerdict> {
    const sdk = getQvac();
    const model = catalogEntry(modelId);
    if (!sdk || !model) return 'unknown';
    try {
      const result = await sdk.assessModelFit({
        models: [{ modelSrc: registryModel(sdk, model.sdkConstant), modelType: model.sdkModelType, modelConfig: model.sdkModelType === 'llamacpp-completion' ? { ctx_size: ctxSize } : {} }],
        execution: 'sequential',
        policy: 'interactive-v1',
      } as never);
      const r = result as unknown as { verdict?: string; models?: { verdict?: string }[] };
      const verdict = r.models?.[0]?.verdict ?? r.verdict;
      return verdict === 'likely-fits' || verdict === 'likely-too-large' ? verdict : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /** Download (or resume) a model. Resolves when finished, paused or failed. */
  async startDownload(modelId: string): Promise<void> {
    const model = catalogEntry(modelId);
    if (!model) throw new Error(`Unknown model ${modelId}`);
    const sdk = getQvac();
    if (!sdk) throw new Error('On-device AI needs the LunaPredict app build (not Expo Go).');
    const current = this.stateFor(modelId);
    if (current.status === 'downloading' || current.status === 'downloaded') return;

    const startProgress = current.status === 'paused' ? current.progress : 0;
    await this.update(modelId, { status: 'downloading', progress: startProgress });

    try {
      const run = sdk.downloadAsset({
        assetSrc: registryModel(sdk, model.sdkConstant),
        onProgress: (p: { percentage: number; downloaded: number; total: number }) => {
          this.update(modelId, {
            status: 'downloading',
            progress: Math.min(1, Math.max(0, p.percentage / 100)),
            downloadedBytes: p.downloaded,
            totalBytes: p.total,
          });
        },
      } as never);
      this.requests.set(modelId, (run as unknown as { requestId: string }).requestId);
      await run;
      this.requests.delete(modelId);
      const noActiveCoach = !this.getActiveModel();
      const isCoach = model.role === 'coach' || model.role === 'coach-light';
      await this.update(modelId, { status: 'downloaded', downloadedAt: new Date().toISOString() }, isCoach && noActiveCoach ? true : undefined);
    } catch (e) {
      this.requests.delete(modelId);
      const progress = (this.stateFor(modelId) as { progress?: number }).progress ?? 0;
      if (this.pausing.delete(modelId)) {
        await this.update(modelId, { status: 'paused', progress });
      } else {
        await this.update(modelId, { status: 'error', message: friendlyDownloadError(e) });
      }
    }
  }

  /** Pause keeps the partial file so Resume continues where it stopped. */
  async pauseDownload(modelId: string): Promise<void> {
    const requestId = this.requests.get(modelId);
    const sdk = getQvac();
    if (!requestId || !sdk) return;
    this.pausing.add(modelId);
    await sdk.cancel({ requestId } as never);
  }

  /** Stop and throw away the partial file. */
  async cancelDownload(modelId: string): Promise<void> {
    const requestId = this.requests.get(modelId);
    const sdk = getQvac();
    if (requestId && sdk) {
      this.pausing.add(modelId);
      await sdk.cancel({ requestId, clearCache: true } as never).catch(() => {});
    }
    await this.deleteFiles(modelId);
    await this.update(modelId, { status: 'not_downloaded' }, false);
  }

  async deleteModel(modelId: string): Promise<void> {
    const { coachEngine } = await import('../ai/engine');
    await coachEngine.unloadModel(modelId).catch(() => {});
    await this.deleteFiles(modelId);
    await this.update(modelId, { status: 'not_downloaded' }, false);
    this.ensureActiveCoach();
    await this.persist();
    this.emit(modelId, { status: 'not_downloaded' }, true);
  }

  private async deleteFiles(modelId: string) {
    const sdk = getQvac();
    const model = catalogEntry(modelId);
    if (!sdk || !model) return;
    try {
      const info = await sdk.getModelInfo(registryModel(sdk, model.sdkConstant) as never) as unknown as { cacheFiles?: { path: string }[] };
      for (const f of info.cacheFiles ?? []) {
        try {
          const file = new File(f.path.startsWith('file://') ? f.path : `file://${f.path}`);
          if (file.exists) file.delete();
        } catch {
          // already gone
        }
      }
    } catch {
      // nothing cached
    }
  }

  /** Mark a downloaded LLM as the Coach's model. */
  async setActive(modelId: string): Promise<void> {
    const model = catalogEntry(modelId);
    if (!model || (model.role !== 'coach' && model.role !== 'coach-light') || !this.isDownloaded(modelId)) return;
    for (const e of this.registry) e.active = e.modelId === modelId;
    await this.persist();
    this.emit(modelId, this.stateFor(modelId), true);
  }

  /** Delete all data: forget registry; optionally remove model files too. */
  async reset({ deleteFiles }: { deleteFiles: boolean }): Promise<void> {
    if (deleteFiles) {
      for (const m of MODEL_CATALOG) await this.deleteFiles(m.id);
      this.registry = [];
    }
    this.requests.clear();
  }
}

function friendlyDownloadError(e: unknown): string {
  const msg = errorMessage(e).toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('connect')) return 'No connection — tap Resume when you are back online.';
  if (msg.includes('space') || msg.includes('enospc')) return 'Not enough free storage.';
  if (msg.includes('checksum') || msg.includes('sha')) return 'Download was corrupted. Try again.';
  return errorMessage(e);
}

export const ModelManager = new ModelManagerImpl();
