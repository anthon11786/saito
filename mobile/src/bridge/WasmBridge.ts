import { RefObject } from 'react';
import type WebView from 'react-native-webview';
import type {
  BridgeCommand,
  BridgeEvent,
  BridgeMessage,
  BridgeResponse,
} from './bridge-protocol';

type EventHandler = (data: any) => void;

let commandId = 0;
function nextId(): string {
  return `cmd_${++commandId}_${Date.now()}`;
}

export class WasmBridge {
  private webviewRef: RefObject<WebView | null>;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners = new Map<string, Set<EventHandler>>();
  private ready = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(webviewRef: RefObject<WebView | null>) {
    this.webviewRef = webviewRef;
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  handleMessage(raw: string): void {
    let msg: BridgeMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[WasmBridge] unparseable message:', raw);
      return;
    }

    // Handle ready signal
    if ('type' in msg && (msg as any).type === 'ready') {
      this.ready = true;
      this.resolveReady();
      return;
    }

    // Handle events
    if ('type' in msg && (msg as BridgeEvent).type === 'event') {
      const evt = msg as BridgeEvent;
      const key = `${evt.module}.${evt.event}`;
      const handlers = this.listeners.get(key);
      if (handlers) {
        handlers.forEach((h) => h(evt.data));
      }
      return;
    }

    // Handle responses
    const resp = msg as BridgeResponse;
    if (resp.id && this.pending.has(resp.id)) {
      const { resolve, reject } = this.pending.get(resp.id)!;
      this.pending.delete(resp.id);
      if (resp.error) {
        reject(new Error(resp.error));
      } else {
        resolve(resp.result);
      }
    }
  }

  async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  async call<T = any>(
    module: string,
    method: string,
    params?: Record<string, any>,
  ): Promise<T> {
    await this.readyPromise;

    const id = nextId();
    const command: BridgeCommand = { id, module, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const js = `window.__SAITO_BRIDGE__.handleCommand(${JSON.stringify(command)}); true;`;
      this.webviewRef.current?.injectJavaScript(js);

      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Bridge call timeout: ${module}.${method}`));
        }
      }, 30000);
    });
  }

  on(module: string, event: string, handler: EventHandler): () => void {
    const key = `${module}.${event}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(handler);

    return () => {
      this.listeners.get(key)?.delete(handler);
    };
  }

  /**
   * Reset the bridge so it can await a fresh ready signal from the WebView.
   * Call this before reloading the WebView.
   */
  reset(): void {
    this.pending.forEach(({ reject }) => reject(new Error('Bridge reset')));
    this.pending.clear();
    this.listeners.clear();
    this.ready = false;
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  destroy(): void {
    this.pending.forEach(({ reject }) => reject(new Error('Bridge destroyed')));
    this.pending.clear();
    this.listeners.clear();
  }
}
