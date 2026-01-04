"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInMemoryStorage = createInMemoryStorage;
const buffer_1 = require("buffer");
const saito_1 = __importDefault(require("saito-js/saito"));
const custom_shared_methods_1 = __importDefault(require("saito-js/lib/custom/custom_shared_methods"));
const peer_service_list_1 = __importDefault(require("saito-js/lib/peer_service_list"));
const STORAGE_KEYS_KEY = '@saito/storage-keys';
const WALLET_STORAGE_KEY = '@saito/wallet';
class InMemoryStorage {
    constructor() {
        this.cache = new Map();
    }
    async getItem(key) {
        return this.cache.get(key) ?? null;
    }
    async setItem(key, value) {
        this.cache.set(key, value);
    }
    async removeItem(key) {
        this.cache.delete(key);
    }
}
function createInMemoryStorage() {
    return new InMemoryStorage();
}
class ReactNativeSharedMethods extends custom_shared_methods_1.default {
    constructor(storage, events) {
        super();
        this.cache = new Map();
        this.knownKeys = new Set();
        this.storage = storage;
        this.events = events;
    }
    async initialize() {
        await this.hydrateCache();
    }
    async hydrateCache() {
        try {
            const knownKeysRaw = await this.storage.getItem(STORAGE_KEYS_KEY);
            if (!knownKeysRaw) {
                return;
            }
            const keys = JSON.parse(knownKeysRaw);
            for (const key of keys) {
                try {
                    const storedValue = await this.storage.getItem(key);
                    if (storedValue) {
                        const buffer = buffer_1.Buffer.from(storedValue, 'base64');
                        this.cache.set(key, new Uint8Array(buffer));
                        this.knownKeys.add(key);
                    }
                }
                catch (error) {
                    console.error(`Failed to hydrate key ${key} from storage`, error);
                }
            }
        }
        catch (error) {
            console.error('Failed to hydrate saito storage cache', error);
        }
    }
    persistKeys() {
        this.storage
            .setItem(STORAGE_KEYS_KEY, JSON.stringify(Array.from(this.knownKeys)))
            .catch((error) => console.error('Failed to persist saito storage keys', error));
    }
    persistValue(key, value) {
        this.storage
            .setItem(key, buffer_1.Buffer.from(value).toString('base64'))
            .catch((error) => console.error(`Failed to persist key ${key}`, error));
    }
    trackKey(key) {
        if (!this.knownKeys.has(key)) {
            this.knownKeys.add(key);
            this.persistKeys();
        }
    }
    connectToPeer(url, peerIndex) {
        try {
            const socket = new WebSocket(url);
            socket.binaryType = 'arraybuffer';
            saito_1.default.getInstance().addNewSocket(socket, peerIndex);
            socket.onmessage = (event) => {
                try {
                    saito_1.default.getLibInstance().process_msg_buffer_from_peer(new Uint8Array(event.data), peerIndex);
                }
                catch (error) {
                    console.error(error);
                }
            };
            socket.onopen = () => {
                try {
                    saito_1.default.getLibInstance().process_new_peer(peerIndex, url);
                }
                catch (error) {
                    console.error(error);
                }
            };
            socket.onclose = () => {
                try {
                    saito_1.default.getLibInstance().process_peer_disconnection(peerIndex);
                }
                catch (error) {
                    console.error(error);
                }
            };
            socket.onerror = (error) => {
                try {
                    console.error(`socket.onerror ${peerIndex}: `, error);
                    saito_1.default.getInstance().removeSocket(peerIndex);
                }
                catch (innerError) {
                    console.error(innerError);
                }
            };
        }
        catch (error) {
            console.error('Error occurred while opening socket: ', error);
        }
    }
    disconnectFromPeer(peerIndex) {
        saito_1.default.getInstance().removeSocket(peerIndex);
    }
    fetchBlockFromPeer(url) {
        return fetch(url)
            .then((res) => res.arrayBuffer())
            .then((buffer) => new Uint8Array(buffer));
    }
    isExistingFile(key) {
        return this.cache.has(key);
    }
    loadBlockFileList() {
        return Array.from(this.knownKeys).filter((key) => key !== STORAGE_KEYS_KEY && key !== WALLET_STORAGE_KEY);
    }
    readValue(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return new Uint8Array();
        }
        return new Uint8Array(cached);
    }
    removeValue(key) {
        this.cache.delete(key);
        this.knownKeys.delete(key);
        this.persistKeys();
        this.storage
            .removeItem(key)
            .catch((error) => console.error(`Failed to remove value for key ${key}`, error));
    }
    sendMessage(peerIndex, buffer) {
        try {
            if (saito_1.default.getInstance().stunManager.isStunPeer(peerIndex)) {
                const stunPeer = saito_1.default.getInstance().stunManager.getStunPeer(peerIndex);
                if (stunPeer) {
                    // @ts-ignore
                    const { peerConnection } = stunPeer;
                    // @ts-ignore
                    const dc = peerConnection?.dc;
                    if (dc?.readyState === 'open') {
                        dc.send(buffer);
                    }
                    else {
                        console.warn(`Data channel for STUN peer ${peerIndex} is not open`);
                    }
                }
                return;
            }
            const socket = saito_1.default.getInstance().getSocket(peerIndex);
            if (socket) {
                socket.send(buffer);
            }
            else {
                console.error(`No WebSocket found for peer ${peerIndex}`);
            }
        }
        catch (error) {
            console.error(error);
        }
    }
    sendMessageToAll(buffer, exceptions) {
        saito_1.default.getInstance().sockets.forEach((socket, key) => {
            if (exceptions.includes(key)) {
                return;
            }
            try {
                if (socket.readyState !== socket.OPEN) {
                    console.error('Blocked Socket Send Before Open');
                }
                else {
                    socket.send(buffer);
                }
            }
            catch (err) {
                console.error('Socket Send Error: ' + err);
            }
        });
    }
    writeValue(key, value) {
        this.cache.set(key, new Uint8Array(value));
        this.trackKey(key);
        this.persistValue(key, value);
    }
    appendValue(key, value) {
        const existing = this.cache.get(key);
        const combined = existing
            ? new Uint8Array([...existing, ...value])
            : new Uint8Array(value);
        this.cache.set(key, combined);
        this.trackKey(key);
        this.persistValue(key, combined);
    }
    flushData(key) {
        // No-op for now; block data will be re-fetched as needed.
        console.debug(`flushData called for key ${key}`);
    }
    ensureBlockDirExists(_path) {
        // Filesystem not required for React Native storage.
    }
    sendInterfaceEvent(event, peerIndex, public_key) {
        this.events.emit('interface-event', {
            event,
            peerIndex,
            publicKey: public_key
        });
    }
    sendBlockFetchStatus(count) {
        this.events.emit('block-fetch-status', { count });
    }
    sendBlockSuccess(hash, blockId) {
        this.events.emit('add-block-success', { hash, blockId });
    }
    sendNewVersionAlert(major, minor, patch, peerIndex) {
        const version = `${major}.${minor}.${patch}`;
        this.events.emit('new-version-detected', { version, peerIndex });
    }
    sendWalletUpdate() {
        this.events.emit('wallet-updated', undefined);
    }
    async saveWallet(wallet) {
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
        }
        catch (error) {
            console.error('Failed to save wallet to AsyncStorage', error);
        }
    }
    async loadWallet(wallet) {
        if (!wallet) {
            return;
        }
        try {
            const raw = await this.storage.getItem(WALLET_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const payload = JSON.parse(raw);
            if (payload.privateKey !== undefined) {
                await wallet.setPrivateKey(payload.privateKey);
            }
            if (payload.publicKey !== undefined) {
                await wallet.setPublicKey(payload.publicKey);
            }
            if (payload.keyList !== undefined) {
                await wallet.setKeyList(payload.keyList);
            }
        }
        catch (error) {
            console.error('Failed to load wallet from AsyncStorage', error);
        }
    }
    async saveBlockchain(_blockchain) {
        // Blockchain persistence is stubbed for initial RN support.
        console.debug('saveBlockchain called - stubbed for React Native');
    }
    async loadBlockchain(_blockchain) {
        // Blockchain persistence is stubbed for initial RN support.
        console.debug('loadBlockchain called - stubbed for React Native');
    }
    getMyServices() {
        return new peer_service_list_1.default();
    }
    sendNewChainDetectedEvent() {
        this.events.emit('new-chain-detected', undefined);
    }
}
exports.default = ReactNativeSharedMethods;
