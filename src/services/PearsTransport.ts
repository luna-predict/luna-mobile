import type { Worklet } from 'react-native-bare-kit';
import { PEARS_WORKLET_SOURCE } from './pears-worklet.bundle';
import { SharedSnapshot } from '../types';

export interface PearsWorkletEvent {
  event: string;
  data: any;
}

export interface PearsWorkletResponse {
  id: number;
  result?: any;
  error?: string;
}

function stringToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function bytesToString(chunk: any): string {
  if (typeof chunk === 'string') return chunk;
  if (chunk instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk))) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(chunk);
    }
    let res = '';
    for (let i = 0; i < chunk.length; i++) {
      res += String.fromCharCode(chunk[i]);
    }
    return res;
  }
  return String(chunk ?? '');
}

/**
 * PearsTransport provides communication between React Native and the BareKit Worklet
 * that runs the real Holepunch/Pears peer-to-peer stack (Hyperswarm & Hypercore).
 */
class PearsTransportService {
  private worklet: any = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private eventListeners = new Set<(event: PearsWorkletEvent) => void>();
  private initialized = false;
  private available = false;
  private buffer = '';

  /**
   * Initializes the BareKit worklet if supported in the current environment.
   * If running in Expo Go or Jest, worklet creation is cleanly bypassed.
   */
  async init(): Promise<boolean> {
    if (this.initialized) return this.available;
    this.initialized = true;

    // In test environment, skip spinning up native worklet
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      this.available = false;
      return false;
    }

    try {
      // Dynamic require so if BareKit TurboModule is absent or fails to load,
      // it won't crash the JS bundle at app startup.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bareKitModule = require('react-native-bare-kit');
      const WorkletClass = bareKitModule?.Worklet;
      if (!WorkletClass) {
        this.available = false;
        return false;
      }

      this.worklet = new WorkletClass();
      const { IPC } = this.worklet;
      if (!IPC) {
        this.available = false;
        return false;
      }

      // Attach error listener so stream errors do not turn into uncaught fatal crashes
      IPC.on('error', (err: any) => {
        console.warn('[PearsTransport] IPC stream warning:', err);
      });

      IPC.on('data', (chunk: any) => {
        const text = bytesToString(chunk);
        this.buffer += text;
        let boundary = this.buffer.indexOf('\n');

        while (boundary !== -1) {
          const line = this.buffer.slice(0, boundary).trim();
          this.buffer = this.buffer.slice(boundary + 1);
          boundary = this.buffer.indexOf('\n');
          if (!line) continue;

          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'response') {
              const pending = this.pendingRequests.get(parsed.payload?.id);
              if (pending) {
                this.pendingRequests.delete(parsed.payload.id);
                if (parsed.payload.error) {
                  pending.reject(new Error(parsed.payload.error));
                } else {
                  pending.resolve(parsed.payload.result);
                }
              }
            } else if (parsed.type === 'event') {
              this.eventListeners.forEach(listener => listener(parsed.payload));
            } else if (parsed.type === 'status') {
              this.available = !!parsed.payload?.ready;
            }
          } catch {
            // malformed json frame; drop
          }
        }
      });

      this.worklet.start('/pears-worklet.js', PEARS_WORKLET_SOURCE);

      // Ping worklet to ensure channel is up
      const pingRes = await this.request('ping', {}, 2000).catch(() => null);
      this.available = pingRes?.ok === true;
    } catch (err) {
      console.warn('[PearsTransport] Failed to initialize worklet:', err);
      this.available = false;
    }

    return this.available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  onEvent(listener: (event: PearsWorkletEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private request<T = any>(command: string, params: any = {}, timeoutMs = 8000): Promise<T> {
    if (!this.worklet || !this.worklet.IPC) {
      return Promise.reject(new Error('Pears worklet not running'));
    }

    const id = ++this.requestId;
    const payload = JSON.stringify({ id, command, params }) + '\n';

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Pears worklet request '${command}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      try {
        // NativeBareKit.write requires a TypedArray (ArrayBufferView), never a string!
        const bytes = stringToBytes(payload);
        this.worklet!.IPC.write(bytes);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  async createInvite(topicHex: string, sharerName: string): Promise<{ success: boolean; coreKey?: string }> {
    return this.request('createInvite', { topicHex, sharerName });
  }

  async joinWithCode(topicHex: string, partnerName: string): Promise<{ success: boolean }> {
    return this.request('joinWithCode', { topicHex, partnerName });
  }

  async publishSnapshot(snapshot: SharedSnapshot): Promise<{ appended: boolean }> {
    return this.request('publishSnapshot', { snapshot });
  }

  async fetchLatestSnapshot(): Promise<SharedSnapshot | null> {
    const res = await this.request<{ snapshot: SharedSnapshot | null }>('fetchLatestSnapshot');
    return res?.snapshot ?? null;
  }

  async unlink(): Promise<void> {
    if (!this.worklet) return;
    await this.request('unlink', {}, 3000).catch(() => { });
  }
}

export const PearsTransport = new PearsTransportService();
