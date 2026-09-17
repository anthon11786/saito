import {
  returnOrCreatePeerConfig,
  addFallbackPeer,
  removePeer,
  classifyReachability
} from '../../../mods/relaypwa/lib/peer-config';

function makeFakeApp() {
  return {
    options: {} as any,
    storage: { saveOptions: jest.fn() }
  };
}

describe('peer-config', () => {
  it('starts with an empty peer list rather than a guessed default', () => {
    const app = makeFakeApp();
    expect(returnOrCreatePeerConfig(app)).toEqual([]);
  });

  it('adds a peer and persists it, ignoring an exact duplicate', () => {
    const app = makeFakeApp();
    const peer = { host: 'node1.example', port: 12101, protocol: 'https' as const, synctype: 'lite' };

    addFallbackPeer(app, peer);
    addFallbackPeer(app, peer);

    expect(app.options.relaypwa.peers).toEqual([peer]);
    expect(app.storage.saveOptions).toHaveBeenCalled();
  });

  it('removes a peer by host and port', () => {
    const app = makeFakeApp();
    addFallbackPeer(app, { host: 'a', port: 1, protocol: 'https', synctype: 'lite' });
    addFallbackPeer(app, { host: 'b', port: 2, protocol: 'https', synctype: 'lite' });

    removePeer(app, 'a', 1);

    expect(app.options.relaypwa.peers).toEqual([{ host: 'b', port: 2, protocol: 'https', synctype: 'lite' }]);
  });

  it('distinguishes offline from node-unreachable, since they need different UI treatment', () => {
    expect(classifyReachability(false, false)).toBe('offline');
    expect(classifyReachability(true, false)).toBe('node-unreachable');
    expect(classifyReachability(true, true)).toBe('connected');
  });
});
