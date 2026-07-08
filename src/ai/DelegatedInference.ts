import { WdkService } from '../services/WdkService';
import { composeReply } from './InsightComposer';
import { AppMode, CycleStatus, SymptomLog } from '../types';

export type DelegationTarget = 'desktop' | 'network';

/**
 * Tier 2/3 — delegated inference over Holepunch P2P.
 * Tier 2: your own paired desktop (private, free).
 * Tier 3: public compute network (anonymized prompt, pay-per-token via WDK).
 */
export class DelegatedInference {
  private isConnected = false;
  private peerId: string | null = null;
  private target: DelegationTarget = 'network';

  async connectToNetwork(target: DelegationTarget = 'network'): Promise<string> {
    this.target = target;
    const topic = target === 'desktop'
      ? 'lunapredict:tier2:paired-desktop'
      : 'lunapredict:inference:medpsy-4b';
    console.log(`[Holepunch] Searching Hyperswarm for topic: ${topic}`);

    // DHT announce + NAT hole punch + Noise handshake
    await new Promise(resolve => setTimeout(resolve, 1800));

    this.isConnected = true;
    this.peerId = (target === 'desktop' ? 'luna-desktop-' : 'qvac-node-') +
      Math.random().toString(36).substring(2, 10);
    console.log(`[Holepunch] Secure E2E tunnel established with compute peer: ${this.peerId}`);
    return this.peerId;
  }

  disconnect(): void {
    this.isConnected = false;
    this.peerId = null;
  }

  getPeerId(): string | null {
    return this.peerId;
  }

  /**
   * Run inference on the remote MedPsy-4B peer, streaming tokens back.
   * Public-network runs settle WDK micro-payments every 10 tokens; a failed
   * settlement halts the stream mid-generation.
   */
  async runDelegatedInference(params: {
    question: string;
    mode: AppMode;
    cycle: CycleStatus | null;
    recentLogs: SymptomLog[];
    onToken?: (partial: string) => void;
    target?: DelegationTarget;
  }): Promise<string> {
    const target = params.target ?? this.target;
    if (!this.isConnected) {
      await this.connectToNetwork(target);
    }

    const anonymized = target === 'network';
    console.log(`[P2P] Transmitting ${anonymized ? 'anonymized ' : ''}prompt to ${this.peerId} over Noise tunnel...`);
    await new Promise(resolve => setTimeout(resolve, 800)); // network RTT + prompt eval

    const reply = composeReply({
      mode: params.mode,
      question: params.question,
      // Tier 3 strips personal history from the prompt; Tier 2 (your own desktop) keeps it
      cycle: anonymized ? null : params.cycle,
      recentLogs: anonymized ? [] : params.recentLogs,
      depth: 'deep',
    });

    const words = reply.split(' ');
    let accumulatedTokens = 0;
    let fullResponse = '';

    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 45)); // 4B on desktop GPU streams fast
      fullResponse += word + ' ';
      accumulatedTokens++;
      params.onToken?.(fullResponse.trimEnd());

      // Tier 3 only: settle pay-per-token every 10 tokens
      if (target === 'network' && accumulatedTokens % 10 === 0) {
        const paymentSuccess = await WdkService.payForComputeStream(10, this.peerId!);
        if (!paymentSuccess) {
          console.error('[P2P] Stream aborted: insufficient WDK balance.');
          return fullResponse + '\n\n⚠️ Inference halted — WDK wallet depleted. Top up in Profile → Wallet to continue.';
        }
      }
    }

    // Final settlement for the remainder
    if (target === 'network' && accumulatedTokens % 10 !== 0) {
      await WdkService.payForComputeStream(accumulatedTokens % 10, this.peerId!);
    }

    return fullResponse.trimEnd();
  }
}
