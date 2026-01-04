import { initialize as initSaito } from 'saito-js/index.web';
import S, { LogLevel } from 'saito-js/saito';
import WebSharedMethods from 'saito-js/lib/custom/shared_methods.web';
import PeerServiceList from 'saito-js/lib/peer_service_list';
import Peer from 'saito-js/lib/peer';
import Factory from '../../node/lib/saito/factory';
import Transaction from '../../node/lib/saito/transaction';
import Wallet from '../../node/lib/saito/wallet';
import Blockchain from '../../node/lib/saito/blockchain';

type EventCallbacks = {
  onWalletUpdate?: () => void;
  onBlockAdded?: (hash: string, blockId: bigint) => void;
  onInterfaceEvent?: (event: string, peerIndex: bigint, publicKey: string) => void;
  onNewChain?: () => void;
  onNewVersion?: (version: string) => void;
};

class ReactNativeMethods extends WebSharedMethods {
  callbacks: EventCallbacks;

  constructor(callbacks: EventCallbacks) {
    super();
    this.callbacks = callbacks;
  }

  async processApiCall(buffer: Uint8Array, msgIndex: number, peerIndex: bigint): Promise<void> {
    // For demo purposes we simply echo success back to the sender.
    try {
      await S.getInstance().sendApiSuccess(msgIndex, buffer, peerIndex);
    } catch (error) {
      console.error('processApiCall error', error);
    }
  }

  sendInterfaceEvent(event: string, peerIndex: bigint, public_key: string) {
    this.callbacks.onInterfaceEvent?.(event, peerIndex, public_key);
  }

  sendBlockSuccess(hash: string, blockId: bigint) {
    this.callbacks.onBlockAdded?.(hash, blockId);
  }

  sendNewVersionAlert(major: number, minor: number, patch: number): void {
    this.callbacks.onNewVersion?.(`${major}.${minor}.${patch}`);
  }

  sendWalletUpdate() {
    this.callbacks.onWalletUpdate?.();
  }

  sendBlockFetchStatus(_count: number) {
    // no-op for the demo UI
  }

  ensureDirExists(_path: string): void {
    // RN will use AsyncStorage or filesystem; demo leaves this empty
  }

  sendNewChainDetectedEvent(): void {
    this.callbacks.onNewChain?.();
  }

  async saveWallet() {
    // In a production app, persist using AsyncStorage or a secure keystore.
    const wallet = await S.getInstance().getWallet();
    const publicKey = await wallet.getPublicKey();
    console.log('Wallet updated for', publicKey);
  }

  async loadWallet() {
    // Implement loading persisted wallet data if desired.
  }

  async saveBlockchain() {
    // Lite/SPV demo does not persist headers.
  }

  async loadBlockchain() {
    // Implement loading persisted headers if desired.
  }

  getMyServices() {
    const list = new PeerServiceList();
    return list;
  }
}

export type ClientOptions = {
  privateKey?: string;
  callbacks?: EventCallbacks;
  logLevel?: LogLevel;
};

export class SaitoMobileClient {
  wallet?: Wallet;
  blockchain?: Blockchain;

  static async create(options: ClientOptions = {}) {
    const callbacks = options.callbacks || {};
    const methods = new ReactNativeMethods(callbacks);

    await initSaito(
      {
        browser_mode: true,
        spv_mode: true,
        wallet: { privateKey: options.privateKey || '' }
      },
      methods,
      new Factory(),
      options.privateKey || '',
      options.logLevel || LogLevel.Info,
      BigInt(1),
      true
    );

    const wallet = (await S.getInstance().getWallet()) as Wallet;
    const blockchain = (await S.getInstance().getBlockchain()) as Blockchain;

    const client = new SaitoMobileClient();
    client.wallet = wallet;
    client.blockchain = blockchain;
    return client;
  }

  async getPublicKey(): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    return this.wallet.getPublicKey();
  }

  async getPeers(): Promise<Peer[]> {
    return S.getInstance().getPeers();
  }

  async refreshPeerStats(): Promise<{ count: number }> {
    const peers = await this.getPeers();
    return { count: peers.length };
  }

  async sendNote(note: string): Promise<void> {
    // Sends a lightweight request to connected peers; adjust type as needed by your modules.
    await S.getInstance().sendRequest('note', { note });
  }

  async broadcastTransaction(tx: Transaction, peerIndex?: bigint) {
    // Utility for modules that want to send a transaction with a callback path.
    await S.getInstance().sendTransactionWithCallback(tx, undefined, peerIndex);
  }
}
