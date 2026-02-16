export * from './chat';

export type ConnectionStatus = 'loading' | 'ready' | 'error';

export type WalletState = {
  publicKey: string;
  balance: string;
  connected: boolean;
};

export type PeerInfo = {
  publicKey: string;
  host: string;
  port: number;
};
