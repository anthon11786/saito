import { Buffer as BufferPolyfill } from 'buffer';
import { TextDecoder as UtilTextDecoder, TextEncoder as UtilTextEncoder } from 'util';
import S from 'saito-js/saito';

/**
 * Minimal runtime shims for the lite/RN surface:
 * - Buffer/TextEncoder/TextDecoder for wasm + crypto helpers
 * - global/process/WebSocket to match web/RN expectations
 * - lightweight fs/path stand-ins so lite builds avoid bundling Node core
 * - connectivity helper to probe and trigger reconnects from wrappers
 */

type ProbeResult = {
  hasHealthyPeer: boolean;
  peers: Array<{
    index: bigint;
    status: string;
    publicKey: string;
  }>;
};

const getGlobalScope = () => (typeof globalThis !== 'undefined' ? (globalThis as any) : window);

const shimNodeModules = () => {
  const globalScope = getGlobalScope();

  if (!globalScope.fs) {
    const noop = () => {};
    const notSupported = (..._args) => {
      throw new Error('fs is not available in lite/react-native environments');
    };
    globalScope.fs = {
      readFile: (_file, _encoding, cb) =>
        typeof cb === 'function' ? cb(new Error('fs.readFile not available'), null) : undefined,
      watchFile: (_file, _opts, _cb) => noop(),
      writeFile: notSupported,
      existsSync: () => false
    };
  }

  if (!globalScope.path) {
    globalScope.path = {
      join: (...parts: Array<string>) => parts.filter(Boolean).join('/'),
      dirname: (p: string) => p?.split('/').slice(0, -1).join('/') || '.'
    };
  }
};

export const applyLitePolyfills = (): void => {
  const globalScope = getGlobalScope();

  if (!globalScope.Buffer) {
    globalScope.Buffer = BufferPolyfill;
  }

  if (!globalScope.TextEncoder) {
    globalScope.TextEncoder = UtilTextEncoder;
  }

  if (!globalScope.TextDecoder) {
    globalScope.TextDecoder = UtilTextDecoder;
  }

  if (!globalScope.global) {
    globalScope.global = globalScope;
  }

  if (!globalScope.process) {
    globalScope.process = { env: {}, browser: true };
  } else {
    globalScope.process.env = globalScope.process.env || {};
    if (globalScope.process.browser === undefined) {
      globalScope.process.browser = true;
    }
  }

  if (!globalScope.WebSocket) {
    const rnWebSocket = (globalScope as any).nativeWebSocket || (globalScope as any).WebSocket;
    if (rnWebSocket) {
      globalScope.WebSocket = rnWebSocket;
    }
  }

  shimNodeModules();
};

export const createConnectivityHelper = () => {
  const probeConnectivity = async (): Promise<ProbeResult> => {
    const peers = (await S.getInstance().getPeers()) || [];
    const normalized = peers.map((peer: any) => ({
      index: peer.peerIndex ?? peer.peer_index,
      status: (peer as any).status ?? '',
      publicKey: (peer as any).publicKey ?? ''
    }));

    return {
      hasHealthyPeer: normalized.some((p) => p.status === 'connected'),
      peers: normalized
    };
  };

  const reconnect = async (): Promise<ProbeResult> => {
    const peers = (await S.getInstance().getPeers()) || [];
    for (const peer of peers) {
      const peerIndex = peer.peerIndex ?? (peer as any).peer_index;
      if (peerIndex !== undefined && peerIndex !== null) {
        try {
          await S.getInstance().processPeerDisconnection(peerIndex);
        } catch (err) {
          console.warn('Failed to trigger reconnect for peer', peerIndex, err);
        }
      }
    }

    return probeConnectivity();
  };

  return { probeConnectivity, reconnect };
};
