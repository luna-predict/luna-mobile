export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type StopReason = 'eos' | 'length' | 'cancelled' | 'error';

export type EngineEvent =
  | { type: 'loading'; modelName: string }
  | { type: 'thinking' }
  | { type: 'delta'; text: string }
  | { type: 'done'; stopReason: StopReason; tokensPerSecond?: number };

export interface GenParams {
  temp: number;
  top_p: number;
  top_k: number;
  predict: number;
  /** 0 = thinking off, -1 = full thinking, n = cap. See docs/archi-docs/04 §4.8. */
  reasoning_budget: number;
}

export interface GenerateResult {
  text: string;
  stopReason: StopReason;
  tokensPerSecond?: number;
  error?: string;
}

export interface RunHandle {
  requestId: string;
  done: Promise<GenerateResult>;
}

export const COACH_PARAMS: GenParams = {
  temp: 0.6,
  top_p: 0.95,
  top_k: 20,
  predict: 512,
  reasoning_budget: 0,
};
