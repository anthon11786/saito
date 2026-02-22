import { WasmBridge } from '../WasmBridge';

// Minimal mock for RefObject<WebView>
function createMockWebviewRef() {
  const injectJavaScript = jest.fn();
  const ref = {
    current: { injectJavaScript } as any,
  };
  return { ref, injectJavaScript };
}

// Helper: extract command ID from the injected JS string
function extractCmdId(injectMock: jest.Mock, callIndex = 0): string {
  const js = injectMock.mock.calls[callIndex][0] as string;
  const m = js.match(/"id":"(cmd_\d+_\d+)"/);
  if (!m) throw new Error('Could not extract command ID from injected JS');
  return m[1];
}

describe('WasmBridge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Ready lifecycle ──────────────────────────────────────────────

  describe('ready lifecycle', () => {
    it('resolves waitForReady when "ready" message is received', async () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      let resolved = false;
      const p = bridge.waitForReady().then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      bridge.handleMessage(JSON.stringify({ type: 'ready' }));

      // Flush microtasks
      await p;
      expect(resolved).toBe(true);

      bridge.destroy();
    });
  });

  // ── call() ───────────────────────────────────────────────────────

  describe('call()', () => {
    it('injects JavaScript into the WebView and resolves on response', async () => {
      const { ref, injectJavaScript } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));

      const promise = bridge.call('wallet', 'getBalance');

      // Flush the microtask that awaits readyPromise
      await Promise.resolve();

      expect(injectJavaScript).toHaveBeenCalledTimes(1);
      const cmdId = extractCmdId(injectJavaScript);

      bridge.handleMessage(JSON.stringify({ id: cmdId, result: '500' }));
      const result = await promise;
      expect(result).toBe('500');

      bridge.destroy();
    });

    it('rejects on error response', async () => {
      const { ref, injectJavaScript } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));

      const promise = bridge.call('wallet', 'badMethod');
      await Promise.resolve();

      const cmdId = extractCmdId(injectJavaScript);
      bridge.handleMessage(JSON.stringify({ id: cmdId, error: 'Unknown method' }));

      await expect(promise).rejects.toThrow('Unknown method');

      bridge.destroy();
    });

    it('waits for ready before injecting', async () => {
      const { ref, injectJavaScript } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      const promise = bridge.call('core', 'getPeers');
      await Promise.resolve();
      expect(injectJavaScript).not.toHaveBeenCalled();

      // Send ready
      bridge.handleMessage(JSON.stringify({ type: 'ready' }));
      await Promise.resolve();
      await Promise.resolve(); // extra tick for chained awaits

      expect(injectJavaScript).toHaveBeenCalledTimes(1);

      const cmdId = extractCmdId(injectJavaScript);
      bridge.handleMessage(JSON.stringify({ id: cmdId, result: [] }));
      const result = await promise;
      expect(result).toEqual([]);

      bridge.destroy();
    });

    it('times out after 30 seconds', async () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));

      const promise = bridge.call('core', 'getPeers');
      await Promise.resolve();

      // Advance time past the 30s timeout
      jest.advanceTimersByTime(31000);

      await expect(promise).rejects.toThrow('Bridge call timeout');

      bridge.destroy();
    });
  });

  // ── Events ───────────────────────────────────────────────────────

  describe('on() events', () => {
    it('dispatches events to registered handlers', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      const handler = jest.fn();
      bridge.on('wallet', 'balance-updated', handler);

      bridge.handleMessage(
        JSON.stringify({
          type: 'event',
          module: 'wallet',
          event: 'balance-updated',
          data: { balance: '1000' },
        }),
      );

      expect(handler).toHaveBeenCalledWith({ balance: '1000' });
      bridge.destroy();
    });

    it('does not dispatch to unrelated handlers', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      const handler = jest.fn();
      bridge.on('core', 'block-added', handler);

      bridge.handleMessage(
        JSON.stringify({
          type: 'event',
          module: 'wallet',
          event: 'balance-updated',
          data: { balance: '1000' },
        }),
      );

      expect(handler).not.toHaveBeenCalled();
      bridge.destroy();
    });

    it('returns an unsubscribe function', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      const handler = jest.fn();
      const unsub = bridge.on('wallet', 'balance-updated', handler);

      unsub();

      bridge.handleMessage(
        JSON.stringify({
          type: 'event',
          module: 'wallet',
          event: 'balance-updated',
          data: { balance: '1000' },
        }),
      );

      expect(handler).not.toHaveBeenCalled();
      bridge.destroy();
    });

    it('supports multiple handlers on the same event', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      const h1 = jest.fn();
      const h2 = jest.fn();
      bridge.on('core', 'peer-connected', h1);
      bridge.on('core', 'peer-connected', h2);

      bridge.handleMessage(
        JSON.stringify({
          type: 'event',
          module: 'core',
          event: 'peer-connected',
          data: { count: 1 },
        }),
      );

      expect(h1).toHaveBeenCalledWith({ count: 1 });
      expect(h2).toHaveBeenCalledWith({ count: 1 });
      bridge.destroy();
    });
  });

  // ── handleMessage edge cases ─────────────────────────────────────

  describe('handleMessage', () => {
    it('ignores unparseable messages', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      expect(() => bridge.handleMessage('not json')).not.toThrow();
      bridge.destroy();
    });

    it('ignores responses with unknown IDs', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      expect(() =>
        bridge.handleMessage(JSON.stringify({ id: 'unknown_123', result: 'ok' })),
      ).not.toThrow();
      bridge.destroy();
    });
  });

  // ── reset() ──────────────────────────────────────────────────────

  describe('reset()', () => {
    it('rejects pending calls', async () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));
      const promise = bridge.call('wallet', 'getBalance');
      await Promise.resolve();

      bridge.reset();

      // Advance past any lingering setTimeout
      jest.advanceTimersByTime(31000);

      await expect(promise).rejects.toThrow('Bridge reset');

      bridge.destroy();
    });

    it('clears event listeners', () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);
      const handler = jest.fn();
      bridge.on('wallet', 'balance-updated', handler);

      bridge.reset();

      bridge.handleMessage(
        JSON.stringify({
          type: 'event',
          module: 'wallet',
          event: 'balance-updated',
          data: { balance: '0' },
        }),
      );

      expect(handler).not.toHaveBeenCalled();
      bridge.destroy();
    });

    it('requires a new ready signal after reset', async () => {
      const { ref, injectJavaScript } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));
      bridge.reset();

      const promise = bridge.call('core', 'getPeers');
      await Promise.resolve();
      expect(injectJavaScript).not.toHaveBeenCalled();

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));
      await Promise.resolve();
      await Promise.resolve();

      expect(injectJavaScript).toHaveBeenCalled();

      const cmdId = extractCmdId(injectJavaScript);
      bridge.handleMessage(JSON.stringify({ id: cmdId, result: [] }));
      await promise;

      bridge.destroy();
    });
  });

  // ── destroy() ────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('rejects all pending calls', async () => {
      const { ref } = createMockWebviewRef();
      const bridge = new WasmBridge(ref);

      bridge.handleMessage(JSON.stringify({ type: 'ready' }));
      const p1 = bridge.call('wallet', 'getBalance');
      const p2 = bridge.call('core', 'getPeers');
      await Promise.resolve();

      bridge.destroy();

      // Advance past any lingering setTimeout
      jest.advanceTimersByTime(31000);

      await expect(p1).rejects.toThrow('Bridge destroyed');
      await expect(p2).rejects.toThrow('Bridge destroyed');
    });
  });
});
