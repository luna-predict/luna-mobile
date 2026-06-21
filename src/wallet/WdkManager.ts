// Tether WDK Integration for QVAC Pay-Per-Token
export class WdkManager {
  // Start with 0.05 USDt to demonstrate a depletion scenario if desired, 
  // or a healthy 5.00 for normal use. Let's use 5.00 for a smooth UI demo.
  private balanceUsdt: number = 5.00;
  private onBalanceUpdate?: (newBalance: number) => void;

  constructor(onBalanceUpdate?: (newBalance: number) => void) {
    this.onBalanceUpdate = onBalanceUpdate;
  }

  async initializeWallet() {
    console.log("[WDK] Initializing non-custodial local wallet state channels...");
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("[WDK] Ready. Current balance:", this.balanceUsdt, "USDt");
    this.notifyBalance();
  }

  // Called during inference streaming to settle micro-payments
  async payForComputeStream(tokensGenerated: number, peerId: string): Promise<boolean> {
    // 0.0001 USDt per token (10 tokens = 0.001 USDt)
    const cost = tokensGenerated * 0.0001;
    
    if (this.balanceUsdt >= cost) {
      this.balanceUsdt -= cost;
      
      // Fix floating point math issues for UI display
      this.balanceUsdt = Math.round(this.balanceUsdt * 10000) / 10000;
      
      console.log(`[WDK] Authorized micro-payment of ${cost} USDt to ${peerId} for ${tokensGenerated} tokens.`);
      this.notifyBalance();
      return true;
    } else {
      console.error("[WDK] Payment channel failed: Insufficient funds.");
      return false;
    }
  }

  getBalance() {
    return this.balanceUsdt;
  }

  private notifyBalance() {
    if (this.onBalanceUpdate) {
      this.onBalanceUpdate(this.balanceUsdt);
    }
  }
}
