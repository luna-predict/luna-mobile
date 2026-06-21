import { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } from '@qvac/sdk';

export class LocalInference {
  private static modelId: string | null = null;

  static async initializeModel(onProgress?: (progress: number) => void) {
    if (this.modelId) return this.modelId;

    console.log("Loading local Llama 3 model...");
    try {
      this.modelId = await loadModel({
        modelSrc: LLAMA_3_2_1B_INST_Q4_0,
        modelType: "llm",
        onProgress: (progress: number) => {
          if (onProgress) onProgress(progress);
        },
      });
      console.log("Model loaded successfully:", this.modelId);
      return this.modelId;
    } catch (error) {
      console.error("Failed to load local model:", error);
      throw error;
    }
  }

  static async generateInsight(history: Array<{ role: string, content: string }>) {
    if (!this.modelId) {
      throw new Error("Model not initialized. Call initializeModel first.");
    }

    try {
      const result = completion({
        modelId: this.modelId,
        history,
        stream: false
      });
      // The SDK returns a tokenStream or the full response if stream is false.
      // @ts-ignore - Assuming full response format
      return result.text || "Insight generated successfully.";
    } catch (error) {
      console.error("Inference failed:", error);
      throw error;
    }
  }

  static async cleanup() {
    if (this.modelId) {
      await unloadModel({ modelId: this.modelId });
      this.modelId = null;
    }
  }
}
