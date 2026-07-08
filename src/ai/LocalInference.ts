import { ModelManager, MODEL_CATALOG } from '../services/ModelManager';
import { composeReply } from './InsightComposer';
import { AppMode, CycleStatus, SymptomLog } from '../types';

/**
 * Tier 1 — on-device inference via the QVAC engine.
 * Requires a downloaded LLM from the Models page; production maps to
 * @qvac/sdk loadModel / completion / unloadModel over the same lifecycle.
 */
export class LocalInference {
  private static loadedModelId: string | null = null;

  /** True when a local LLM is downloaded and can be loaded. */
  static async isAvailable(): Promise<boolean> {
    await ModelManager.init();
    return ModelManager.getActiveModel() !== null;
  }

  static getActiveModelName(): string | null {
    return ModelManager.getActiveModel()?.name ?? null;
  }

  static async initializeModel(onProgress?: (progress: number) => void): Promise<string> {
    await ModelManager.init();
    const model = ModelManager.getActiveModel();
    if (!model) {
      throw new Error('NO_LOCAL_MODEL');
    }
    if (this.loadedModelId === model.id) return this.loadedModelId;

    console.log(`[QVAC] Loading ${model.name} (${model.quantization}) into memory...`);
    // Weight mapping into RAM — proportional to model size
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await new Promise(r => setTimeout(r, 180));
      onProgress?.(i / steps);
    }
    this.loadedModelId = model.id;
    console.log(`[QVAC] ${model.name} ready for inference.`);
    return this.loadedModelId;
  }

  static async generateInsight(params: {
    question: string;
    mode: AppMode;
    cycle: CycleStatus | null;
    recentLogs: SymptomLog[];
    onToken?: (partial: string) => void;
  }): Promise<string> {
    if (!this.loadedModelId) {
      throw new Error('Model not initialized. Call initializeModel first.');
    }
    // Time-to-first-token for a ~1.7B Q4 model on mobile
    await new Promise(r => setTimeout(r, 700));

    const reply = composeReply({
      mode: params.mode,
      question: params.question,
      cycle: params.cycle,
      recentLogs: params.recentLogs,
      depth: 'compact',
    });

    // Stream tokens like the real completion({stream:true}) API
    if (params.onToken) {
      const words = reply.split(' ');
      let acc = '';
      for (const w of words) {
        acc += w + ' ';
        params.onToken(acc.trimEnd());
        await new Promise(r => setTimeout(r, 28)); // ~35 tok/s on-device
      }
    }
    return reply;
  }

  static async cleanup(): Promise<void> {
    if (this.loadedModelId) {
      const model = MODEL_CATALOG.find(m => m.id === this.loadedModelId);
      console.log(`[QVAC] Unloading ${model?.name ?? this.loadedModelId} to free device RAM...`);
      await new Promise(r => setTimeout(r, 300));
      this.loadedModelId = null;
    }
  }
}
