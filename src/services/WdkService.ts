import * as Crypto from 'expo-crypto';
import { WalletState, WalletTx, WalletNetwork } from '../types';
import { Store } from '../storage/Store';
import { SecureVault } from '../storage/SecureVault';

/**
 * Tether WDK integration layer.
 * Wallet state (mnemonic, balance, history) persists locally and drives the
 * pay-per-token compute stream. Production swaps the mnemonic/address logic
 * for @wdk secret-manager + chain modules; the interface stays the same.
 */

// Compact BIP39-style wordlist (production: full 2048-word BIP39 English list via WDK secret-manager)
const WORDLIST = [
  'able', 'acid', 'aged', 'also', 'area', 'army', 'away', 'baby', 'back', 'ball',
  'band', 'bank', 'base', 'bath', 'bear', 'beat', 'bell', 'belt', 'bend', 'best',
  'bird', 'blue', 'boat', 'body', 'bone', 'book', 'born', 'both', 'bowl', 'bulk',
  'burn', 'bush', 'busy', 'calm', 'camp', 'card', 'care', 'case', 'cash', 'cast',
  'cell', 'chat', 'chip', 'city', 'club', 'coal', 'coat', 'code', 'cold', 'come',
  'cook', 'cool', 'cope', 'copy', 'core', 'cost', 'crew', 'crop', 'dark', 'data',
  'dawn', 'days', 'dead', 'deal', 'dear', 'debt', 'deep', 'deny', 'desk', 'dial',
  'diet', 'dish', 'disk', 'door', 'dose', 'down', 'draw', 'drop', 'drum', 'dual',
  'duke', 'dust', 'duty', 'each', 'earn', 'ease', 'east', 'easy', 'edge', 'else',
  'even', 'ever', 'face', 'fact', 'fail', 'fair', 'fall', 'farm', 'fast', 'fate',
  'fear', 'feed', 'feel', 'file', 'fill', 'film', 'find', 'fine', 'fire', 'firm',
  'fish', 'five', 'flat', 'flow', 'food', 'foot', 'form', 'fort', 'four', 'free',
  'from', 'fuel', 'full', 'fund', 'gain', 'game', 'gate', 'gave', 'gear', 'gift',
  'girl', 'give', 'glad', 'goal', 'goes', 'gold', 'golf', 'gone', 'good', 'gray',
  'grew', 'grey', 'grow', 'gulf', 'hair', 'half', 'hall', 'hand', 'hang', 'hard',
  'harm', 'hate', 'have', 'head', 'hear', 'heat', 'held', 'hell', 'help', 'here',
  'hero', 'high', 'hill', 'hire', 'hold', 'hole', 'holy', 'home', 'hope', 'host',
  'hour', 'huge', 'hunt', 'hurt', 'idea', 'inch', 'into', 'iron', 'item', 'join',
  'jump', 'jury', 'just', 'keen', 'keep', 'kind', 'king', 'knee', 'knew', 'know',
  'lack', 'lady', 'laid', 'lake', 'land', 'lane', 'last', 'late', 'lead', 'left',
  'less', 'life', 'lift', 'like', 'line', 'link', 'list', 'live', 'load', 'loan',
  'lock', 'long', 'look', 'lord', 'lose', 'loss', 'lost', 'love', 'luck', 'made',
  'mail', 'main', 'make', 'many', 'mark', 'mass', 'mean', 'meet', 'mild', 'mile',
  'milk', 'mind', 'mine', 'miss', 'mode', 'mood', 'moon', 'more', 'most', 'move',
  'much', 'must', 'name', 'navy', 'near', 'neck', 'need', 'news', 'next', 'nice',
  'nine', 'none', 'nose', 'note', 'okay', 'once', 'only', 'onto', 'open', 'oral',
];

async function randomInts(count: number, max: number): Promise<number[]> {
  const bytes = await Crypto.getRandomBytesAsync(count * 2);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % max);
  }
  return out;
}

const PRICE_PER_TOKEN_USDT = 0.0001;
const STARTING_BALANCE = 5.0;

type BalanceListener = (state: WalletState) => void;

class WdkServiceImpl {
  private state: WalletState | null = null;
  private listeners = new Set<BalanceListener>();

  /** Load persisted wallet, if any. Does NOT create one — that's an explicit user step. */
  async init(): Promise<WalletState | null> {
    if (!this.state) {
      const stored = await Store.getWallet();
      this.state = stored?.initialized ? { ...stored, mnemonic: await SecureVault.getMnemonic() } : null;
    }
    return this.state;
  }

  getState(): WalletState | null {
    return this.state;
  }

  /** Forget in-memory state (used by Delete all data). */
  reset(): void {
    this.state = null;
  }

  subscribe(fn: BalanceListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async persist() {
    if (this.state) {
      if (this.state.mnemonic) await SecureVault.setMnemonic(this.state.mnemonic);
      await Store.saveWallet(this.state); // mnemonic is stripped by Store
      this.listeners.forEach(fn => fn(this.state!));
    }
  }

  /** Create a fresh non-custodial wallet: generates mnemonic + derived address. */
  async createWallet(network: WalletNetwork = 'testnet'): Promise<WalletState> {
    console.log('[WDK] Generating entropy and deriving key material...');
    const idx = await randomInts(12, WORDLIST.length);
    const mnemonic = idx.map(i => WORDLIST[i]).join(' ');
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, mnemonic);
    const address = '0x' + digest.slice(0, 40);

    this.state = {
      initialized: true,
      address,
      mnemonic,
      network,
      balanceUsdt: network === 'testnet' ? STARTING_BALANCE : 0,
      totalSpentUsdt: 0,
      txHistory: network === 'testnet'
        ? [{
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'topup',
            amountUsdt: STARTING_BALANCE,
            memo: 'Testnet faucet — welcome funds',
          }]
        : [],
    };
    await this.persist();
    console.log(`[WDK] Wallet ready on ${network}: ${address.slice(0, 10)}…`);
    return this.state;
  }

  /** Import from an existing recovery phrase. */
  async importWallet(mnemonic: string, network: WalletNetwork = 'testnet'): Promise<WalletState> {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12) throw new Error('Recovery phrase must be exactly 12 words.');
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, words.join(' '));
    this.state = {
      initialized: true,
      address: '0x' + digest.slice(0, 40),
      mnemonic: words.join(' '),
      network,
      balanceUsdt: network === 'testnet' ? STARTING_BALANCE : 0,
      totalSpentUsdt: 0,
      txHistory: [],
    };
    await this.persist();
    return this.state;
  }

  async switchNetwork(network: WalletNetwork): Promise<void> {
    if (!this.state) return;
    this.state.network = network;
    await this.persist();
  }

  /** Testnet faucet top-up */
  async topUp(amount: number): Promise<void> {
    if (!this.state) return;
    this.state.balanceUsdt = Math.round((this.state.balanceUsdt + amount) * 10000) / 10000;
    this.state.txHistory.unshift({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: 'topup',
      amountUsdt: amount,
      memo: this.state.network === 'testnet' ? 'Testnet faucet top-up' : 'Deposit',
    });
    await this.persist();
  }

  /**
   * Settle a micro-payment for streamed inference tokens.
   * Returns false when the payment channel can't cover the cost (stream should halt).
   */
  async payForComputeStream(tokensGenerated: number, peerId: string): Promise<boolean> {
    if (!this.state) return false;
    const cost = tokensGenerated * PRICE_PER_TOKEN_USDT;
    if (this.state.balanceUsdt < cost) {
      console.error('[WDK] Payment channel failed: insufficient funds.');
      return false;
    }
    this.state.balanceUsdt = Math.round((this.state.balanceUsdt - cost) * 10000) / 10000;
    this.state.totalSpentUsdt = Math.round((this.state.totalSpentUsdt + cost) * 10000) / 10000;

    // Aggregate stream payments to the same peer within a minute into one tx row
    const last = this.state.txHistory[0];
    if (last && last.type === 'stream_payment' && last.peerId === peerId &&
        Date.now() - new Date(last.date).getTime() < 60000) {
      last.amountUsdt = Math.round((last.amountUsdt + cost) * 10000) / 10000;
    } else {
      this.state.txHistory.unshift({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: 'stream_payment',
        amountUsdt: cost,
        peerId,
        memo: `Pay-per-token stream → ${peerId.slice(0, 14)}…`,
      });
    }
    await this.persist();
    return true;
  }

  /** Danger zone: forget the wallet on this device (recovery phrase is the only way back). */
  async resetWallet(): Promise<void> {
    this.state = null;
    await Store.saveWallet(null);
    await SecureVault.clear();
  }
}

export const WdkService = new WdkServiceImpl();
export { PRICE_PER_TOKEN_USDT };
