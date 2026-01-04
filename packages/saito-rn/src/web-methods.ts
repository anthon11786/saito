import { Buffer } from 'buffer';
import S from 'saito-js/saito';
import CustomSharedMethods from 'saito-js/lib/custom/custom_shared_methods';
import PeerServiceList from 'saito-js/lib/peer_service_list';
import type Wallet from 'saito-js/lib/wallet';
import type Blockchain from 'saito-js/lib/blockchain';
import TypedEventEmitter from './event-emitter';
import type { AsyncStorageLike, SaitoEventMap } from './types';

const STORAGE_KEYS_KEY = '@saito/storage-keys';
const WALLET_STORAGE_KEY = '@saito/wallet';

class InMemoryStorage implements AsyncStorageLike {
    private cache = new Map<string, string>();

    async getItem(key: string): Promise<string | null> {
        return this.cache.get(key) ?? null;
    }

    async setItem(key: string, value: string): Promise<void> {
        this.cache.set(key, value);
    }

    async removeItem(key: string): Promise<void> {
        this.cache.delete(key);
    }
}

export function createInMemoryStorage(): AsyncStorageLike {
    return new InMemoryStorage();
}

export default class ReactNativeSharedMethods extends CustomSharedMethods {
    private readonly storage: AsyncStorageLike;
    private readonly events: TypedEventEmitter<SaitoEventMap>;
    private readonly cache = new Map<string, Uint8Array>();
    private readonly knownKeys = new Set<string>();

    constructor(storage: AsyncStorageLike, events: TypedEventEmitter<SaitoEventMap>) {
        super();
        this.storage = storage;
        this.events = events;
    }

    async initialize(): Promise<void> {
        await this.hydrateCache();
    }

    private async hydrateCache(): Promise<void> {
        try {
            const knownKeysRaw = await this.storage.getItem(STORAGE_KEYS_KEY);
            if (!knownKeysRaw) {
                return;
            }

            const keys = JSON.parse(knownKeysRaw) as string[];
            for (const key of keys) {
                try {
                    const storedValue = await this.storage.getItem(key);
                    if (storedValue) {
                        const buffer = Buffer.from(storedValue, 'base64');
                        this.cache.set(key, new Uint8Array(buffer));
                        this.knownKeys.add(key);
                    }
                } catch (error) {
                    console.error(`Failed to hydrate key ${key} from storage`, error);
                }
            }
        } catch (error) {
            console.error('Failed to hydrate saito storage cache', error);
        }
    }

    private persistKeys(): void {
        this.storage
            .setItem(STORAGE_KEYS_KEY, JSON.stringify(Array.from(this.knownKeys)))
            .catch((error) => console.error('Failed to persist saito storage keys', error));
    }

    private persistValue(key: string, value: Uint8Array): void {
        this.storage
            .setItem(key, Buffer.from(value).toString('base64'))
            .catch((error) => console.error(`Failed to persist key ${key}`, error));
    }

    private trackKey(key: string): void {
        if (!this.knownKeys.has(key)) {
            this.knownKeys.add(key);
            this.persistKeys();
        }
    }

    override connectToPeer(url: string, peerIndex: bigint): void {
        try {
            const socket = new WebSocket(url);
            socket.binaryType = 'arraybuffer';
            S.getInstance().addNewSocket(socket, peerIndex);

            socket.onmessage = (event) => {
                try {
                    S.getLibInstance().process_msg_buffer_from_peer(
                        new Uint8Array(event.data),
                        peerIndex
                    );
                } catch (error) {
                    console.error(error);
                }
            };

            socket.onopen = () => {
                try {
                    S.getLibInstance().process_new_peer(peerIndex, url);
                } catch (error) {
                    console.error(error);
                }
            };

            socket.onclose = () => {
                try {
                    S.getLibInstance().process_peer_disconnection(peerIndex);
                } catch (error) {
                    console.error(error);
                }
            };

            socket.onerror = (error) => {
                try {
                    console.error(`socket.onerror ${peerIndex}: `, error);
                    S.getInstance().removeSocket(peerIndex);
                } catch (innerError) {
                    console.error(innerError);
                }
            };
        } catch (error) {
            console.error('Error occurred while opening socket: ', error);
        }
    }

    override disconnectFromPeer(peerIndex: bigint): void {
        S.getInstance().removeSocket(peerIndex);
    }

    override fetchBlockFromPeer(url: string): Promise<Uint8Array> {
        return fetch(url)
            .then((res) => res.arrayBuffer())
            .then((buffer) => new Uint8Array(buffer));
    }

    override isExistingFile(key: string): boolean {
        return this.cache.has(key);
    }

    override loadBlockFileList(): Array<string> {
        return Array.from(this.knownKeys).filter(
            (key) => key !== STORAGE_KEYS_KEY && key !== WALLET_STORAGE_KEY
        );
    }

    override readValue(key: string): Uint8Array {
        const cached = this.cache.get(key);
        if (!cached) {
            return new Uint8Array();
        }
        return new Uint8Array(cached);
    }

    override removeValue(key: string): void {
        this.cache.delete(key);
        this.knownKeys.delete(key);
        this.persistKeys();
        this.storage
            .removeItem(key)
            .catch((error) => console.error(`Failed to remove value for key ${key}`, error));
    }

    override sendMessage(peerIndex: bigint, buffer: Uint8Array): void {
        try {
            if (S.getInstance().stunManager.isStunPeer(peerIndex)) {
                const stunPeer = S.getInstance().stunManager.getStunPeer(peerIndex);
                if (stunPeer) {
                    // @ts-ignore
                    const { peerConnection } = stunPeer;
                    // @ts-ignore
                    const dc = peerConnection?.dc;
                    if (dc?.readyState === 'open') {
                        dc.send(buffer);
                    } else {
                        console.warn(`Data channel for STUN peer ${peerIndex} is not open`);
                    }
                }
                return;
            }

            const socket = S.getInstance().getSocket(peerIndex);
            if (socket) {
                socket.send(buffer);
            } else {
                console.error(`No WebSocket found for peer ${peerIndex}`);
            }
        } catch (error) {
            console.error(error);
        }
    }

    override sendMessageToAll(buffer: Uint8Array, exceptions: Array<bigint>): void {
        S.getInstance().sockets.forEach((socket, key) => {
            if (exceptions.includes(key)) {
                return;
            }
            try {
                if (socket.readyState !== socket.OPEN) {
                    console.error('Blocked Socket Send Before Open');
                } else {
                    socket.send(buffer);
                }
            } catch (err) {
                console.error('Socket Send Error: ' + err);
            }
        });
    }

    override writeValue(key: string, value: Uint8Array): void {
        this.cache.set(key, new Uint8Array(value));
        this.trackKey(key);
        this.persistValue(key, value);
    }

    override appendValue(key: string, value: Uint8Array): void {
        const existing = this.cache.get(key);
        const combined = existing
            ? new Uint8Array([...existing, ...value])
            : new Uint8Array(value);
        this.cache.set(key, combined);
        this.trackKey(key);
        this.persistValue(key, combined);
    }

    override flushData(key: string): void {
        // No-op for now; block data will be re-fetched as needed.
        console.debug(`flushData called for key ${key}`);
    }

    override ensureBlockDirExists(_path: string): void {
        // Filesystem not required for React Native storage.
    }

    override sendInterfaceEvent(event: string, peerIndex: bigint, public_key: string): void {
        this.events.emit('interface-event', {
            event,
            peerIndex,
            publicKey: public_key
        });
    }

    override sendBlockFetchStatus(count: bigint): void {
        this.events.emit('block-fetch-status', { count });
    }

    override sendBlockSuccess(hash: string, blockId: bigint): void {
        this.events.emit('add-block-success', { hash, blockId });
    }

    override sendNewVersionAlert(
        major: number,
        minor: number,
        patch: number,
        peerIndex: bigint
    ): void {
        const version = `${major}.${minor}.${patch}`;
        this.events.emit('new-version-detected', { version, peerIndex });
    }

    override sendWalletUpdate(): void {
        this.events.emit('wallet-updated', undefined);
    }

    override async saveWallet(wallet?: Wallet): Promise<void> {
        if (!wallet) {
            return;
        }
        try {
            const [privateKey, publicKey, keyList] = await Promise.all([
                wallet.getPrivateKey(),
                wallet.getPublicKey(),
                wallet.getKeyList()
            ]);

            const payload = {
                privateKey,
                publicKey,
                keyList
            };
            await this.storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload));
            this.trackKey(WALLET_STORAGE_KEY);
        } catch (error) {
            console.error('Failed to save wallet to AsyncStorage', error);
        }
    }

    override async loadWallet(wallet?: Wallet): Promise<void> {
        if (!wallet) {
            return;
        }
        try {
            const raw = await this.storage.getItem(WALLET_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const payload = JSON.parse(raw) as {
                privateKey?: string;
                publicKey?: string;
                keyList?: string[];
            };
            if (payload.privateKey !== undefined) {
                await wallet.setPrivateKey(payload.privateKey);
            }
            if (payload.publicKey !== undefined) {
                await wallet.setPublicKey(payload.publicKey);
            }
            if (payload.keyList !== undefined) {
                await wallet.setKeyList(payload.keyList);
            }
        } catch (error) {
            console.error('Failed to load wallet from AsyncStorage', error);
        }
    }

    override async saveBlockchain(_blockchain?: Blockchain): Promise<void> {
        // Blockchain persistence is stubbed for initial RN support.
        console.debug('saveBlockchain called - stubbed for React Native');
    }

    override async loadBlockchain(_blockchain?: Blockchain): Promise<void> {
        // Blockchain persistence is stubbed for initial RN support.
        console.debug('loadBlockchain called - stubbed for React Native');
    }

    override getMyServices(): PeerServiceList {
        return new PeerServiceList();
    }

    override sendNewChainDetectedEvent(): void {
        this.events.emit('new-chain-detected', undefined);
    }
}
