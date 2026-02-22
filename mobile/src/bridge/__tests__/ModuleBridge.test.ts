import { ModuleBridgeRegistry, ModuleBridgeAdapter } from '../ModuleBridge';

function createMockAdapter(name: string): ModuleBridgeAdapter & { handleEvent: jest.Mock } {
  return {
    moduleName: name,
    handleEvent: jest.fn(),
    getMethods: () => ['method1', 'method2'],
  };
}

describe('ModuleBridgeRegistry', () => {
  let registry: ModuleBridgeRegistry;

  beforeEach(() => {
    registry = new ModuleBridgeRegistry();
  });

  describe('register / getAdapter', () => {
    it('registers and retrieves an adapter', () => {
      const adapter = createMockAdapter('wallet');
      registry.register(adapter);
      expect(registry.getAdapter('wallet')).toBe(adapter);
    });

    it('returns undefined for unregistered modules', () => {
      expect(registry.getAdapter('nonexistent')).toBeUndefined();
    });

    it('overwrites a previously registered adapter for the same module', () => {
      const adapter1 = createMockAdapter('wallet');
      const adapter2 = createMockAdapter('wallet');
      registry.register(adapter1);
      registry.register(adapter2);
      expect(registry.getAdapter('wallet')).toBe(adapter2);
    });
  });

  describe('unregister', () => {
    it('removes a registered adapter', () => {
      const adapter = createMockAdapter('chat');
      registry.register(adapter);
      registry.unregister('chat');
      expect(registry.getAdapter('chat')).toBeUndefined();
    });

    it('does not throw when unregistering a non-existent module', () => {
      expect(() => registry.unregister('ghost')).not.toThrow();
    });
  });

  describe('dispatchEvent', () => {
    it('dispatches events to the correct adapter', () => {
      const walletAdapter = createMockAdapter('wallet');
      const chatAdapter = createMockAdapter('chat');
      registry.register(walletAdapter);
      registry.register(chatAdapter);

      registry.dispatchEvent('wallet', 'balance-updated', { balance: '100' });

      expect(walletAdapter.handleEvent).toHaveBeenCalledWith('balance-updated', { balance: '100' });
      expect(chatAdapter.handleEvent).not.toHaveBeenCalled();
    });

    it('does nothing if no adapter is registered for the module', () => {
      expect(() => registry.dispatchEvent('core', 'some-event', {})).not.toThrow();
    });
  });
});

