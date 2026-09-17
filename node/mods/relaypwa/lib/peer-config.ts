export interface RelayPeer {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  synctype: string;
}

export type PeerReachability = 'connected' | 'offline' | 'node-unreachable';

/**
 * A pinned single peer means an install from a dead node looks healthy
 * (service worker still serves the cached shell) but can never sync again.
 * There is no real mainnet default yet — Phase 0 needs to retrieve one —
 * so this stays empty rather than shipping a guessed host.
 */
export const DEFAULT_RELAY_PEERS: RelayPeer[] = [];

export function returnOrCreatePeerConfig(app: any): RelayPeer[] {
  if (!app.options.relaypwa) {
    app.options.relaypwa = {};
  }
  if (!Array.isArray(app.options.relaypwa.peers) || app.options.relaypwa.peers.length === 0) {
    app.options.relaypwa.peers = [...DEFAULT_RELAY_PEERS];
    app.storage.saveOptions();
  }
  return app.options.relaypwa.peers;
}

export function addFallbackPeer(app: any, peer: RelayPeer) {
  const peers = returnOrCreatePeerConfig(app);
  const exists = peers.some((p) => p.host === peer.host && p.port === peer.port);
  if (!exists) {
    peers.push(peer);
    app.storage.saveOptions();
  }
}

export function removePeer(app: any, host: string, port: number) {
  const peers = returnOrCreatePeerConfig(app);
  app.options.relaypwa.peers = peers.filter((p) => !(p.host === host && p.port === port));
  app.storage.saveOptions();
}

/**
 * Distinguishes "you are offline" from "your node is unreachable" — the
 * two need different actions from the user, and a plain connection check
 * cannot tell them apart on its own.
 */
export function classifyReachability(navigatorOnLine: boolean, peerConnected: boolean): PeerReachability {
  if (!navigatorOnLine) {
    return 'offline';
  }
  return peerConnected ? 'connected' : 'node-unreachable';
}
