import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';
import CustomSharedMethods from 'saito-js/lib/custom/custom_shared_methods';
import Wallet from 'saito-js/lib/wallet';
import Saito from 'saito-js/saito';

import { STORAGE_KEYS } from './saitoConfig';

const bufferToBase64 = (value: Uint8Array) => Buffer.from(value).toString('base64');
const base64ToBuffer = (value: string | null) =>
  value ? new Uint8Array(Buffer.from(value, 'base64')) : new Uint8Array();

export type ReactNativeEvent =
  | 'handshake_complete'
  | 'wallet-updated'
  | 'add-block-success'
  | 'block-fetch-status'
  | 'peer-request'
  | 'new-version-detected'
  | 'new-chain-detected';

export default class ReactNativeSharedMethods extends CustomSharedMethods {
  private emitter: EventEmitter;
  private storageCache: Map<string, string>;

  constructor(emitter: EventEmitter) {
    super();
    this.emitter = emitter;
    this.storageCache = new Map();
  }

  sendMessage(peerIndex: bigint, buffer: Uint8Array): void {
    const socket = Saito.getInstance().getSocket(peerIndex);
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(buffer);
    }
  }

  sendMessageToAll(buffer: Uint8Array, exceptions: Array<bigint>): void {
    Saito.getInstance().sockets.forEach((socket, key) => {
      if (exceptions.includes(key)) return;
      if (socket.readyState === socket.OPEN) {
        socket.send(buffer);
      }
    });
  }

  connectToPeer(url: string, peerIndex: bigint): void {
    try {
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      Saito.getInstance().addNewSocket(socket, peerIndex);

      socket.onmessage = (event) => {
        try {
          const payload =
            event.data instanceof ArrayBuffer
              ? new Uint8Array(event.data)
              : new Uint8Array(Buffer.from(event.data));
          Saito.getLibInstance().process_msg_buffer_from_peer(payload, peerIndex);
        } catch (error) {
          console.error(error);
        }
      };

      socket.onopen = () => {
        Saito.getLibInstance().process_new_peer(peerIndex, url);
      };

      socket.onclose = () => {
        Saito.getLibInstance().process_peer_disconnection(peerIndex);
      };

      socket.onerror = (error) => {
        console.error(`socket.onerror ${peerIndex.toString()}: `, error);
        Saito.getInstance().removeSocket(peerIndex);
      };
    } catch (error) {
      console.error('Failed to connect to peer', url, error);
    }
  }

  disconnectFromPeer(peerIndex: bigint): void {
    Saito.getInstance().removeSocket(peerIndex);
  }

  async fetchBlockFromPeer(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  isExistingFile(key: string): boolean {
    return this.storageCache.has(key);
  }

  loadBlockFileList(): Array<string> {
    return [];
  }

  async processApiCall(buffer: Uint8Array, msgIndex: number, peerIndex: bigint): Promise<void> {
    try {
      this.emitter.emit('peer-request', {
        peerIndex: peerIndex.toString(),
        payload: Buffer.from(buffer).toString('utf-8')
      });

      const ack = Buffer.from(
        JSON.stringify({ ok: true, echoedBytes: buffer.byteLength }),
        'utf-8'
      );
      await Saito.getInstance().sendApiSuccess(msgIndex, new Uint8Array(ack), peerIndex);
    } catch (error) {
      console.error('processApiCall failed', error);
      await Saito.getInstance().sendApiError(
        msgIndex,
        new Uint8Array(Buffer.from(error?.toString?.() || 'api error', 'utf-8')),
        peerIndex
      );
    }
  }

  processApiSuccess(buffer: Uint8Array, msgIndex: number, peerIndex: bigint): void {
    super.processApiSuccess(buffer, msgIndex, peerIndex);
  }

  processApiError(buffer: Uint8Array, msgIndex: number, peerIndex: bigint): void {
    super.processApiError(buffer, msgIndex, peerIndex);
  }

  ensureBlockDirExists(_path: string): void {}

  readValue(key: string): Uint8Array {
    return base64ToBuffer(this.storageCache.get(key) || null);
  }

  async removeValue(key: string): Promise<void> {
    this.storageCache.delete(key);
    await AsyncStorage.removeItem(key);
  }

  sendBlockFetchStatus(count: bigint): void {
    this.emitter.emit('block-fetch-status', count.toString());
  }

  writeValue(key: string, value: Uint8Array): void {
    const encoded = bufferToBase64(value);
    this.storageCache.set(key, encoded);
    AsyncStorage.setItem(key, encoded);
  }

  async appendValue(key: string, value: Uint8Array): Promise<void> {
    const existing = await AsyncStorage.getItem(key);
    const merged = existing ? `${existing}${bufferToBase64(value)}` : bufferToBase64(value);
    this.storageCache.set(key, merged);
    await AsyncStorage.setItem(key, merged);
  }

  flushData(_key: string): void {}

  sendInterfaceEvent(event: string, peerIndex: bigint, public_key: string): void {
    this.emitter.emit(event as ReactNativeEvent, {
      peerIndex: peerIndex.toString(),
      publicKey: public_key
    });
  }

  async sendWalletUpdate(): Promise<void> {
    this.emitter.emit('wallet-updated');
  }

  async sendBlockSuccess(hash: string, blockId: bigint): Promise<void> {
    this.emitter.emit('add-block-success', { hash, blockId: blockId.toString() });
  }

  async saveWallet(wallet?: Wallet): Promise<void> {
    const activeWallet = wallet || (await Saito.getInstance().getWallet());
    const [privateKey, publicKey, balance] = await Promise.all([
      activeWallet.getPrivateKey(),
      activeWallet.getPublicKey(),
      activeWallet.getBalance()
    ]);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKey),
      AsyncStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKey),
      AsyncStorage.setItem(
        STORAGE_KEYS.WALLET_META,
        JSON.stringify({ balance: balance.toString() })
      )
    ]);

    this.storageCache.set(STORAGE_KEYS.PRIVATE_KEY, privateKey);
    this.storageCache.set(STORAGE_KEYS.PUBLIC_KEY, publicKey);
  }

  async loadWallet(wallet?: Wallet): Promise<void> {
    const activeWallet = wallet || (await Saito.getInstance().getWallet());
    const [privateKey, publicKey] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.PRIVATE_KEY),
      AsyncStorage.getItem(STORAGE_KEYS.PUBLIC_KEY)
    ]);

    if (privateKey) {
      await activeWallet.setPrivateKey(privateKey);
      this.storageCache.set(STORAGE_KEYS.PRIVATE_KEY, privateKey);
    }
    if (publicKey) {
      await activeWallet.setPublicKey(publicKey);
      this.storageCache.set(STORAGE_KEYS.PUBLIC_KEY, publicKey);
    }
  }

  saveBlockchain(): void {}
  loadBlockchain(): void {}

  sendNewVersionAlert(major: number, minor: number, patch: number, peerIndex: bigint): void {
    this.emitter.emit('new-version-detected', { major, minor, patch, peerIndex: peerIndex.toString() });
  }

  sendNewChainDetectedEvent(): void {
    this.emitter.emit('new-chain-detected');
  }

  async persistKeys(privateKey: string, publicKey: string): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKey),
      AsyncStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKey)
    ]);
    this.storageCache.set(STORAGE_KEYS.PRIVATE_KEY, privateKey);
    this.storageCache.set(STORAGE_KEYS.PUBLIC_KEY, publicKey);
  }
}
