import type Transaction from 'saito-js/lib/transaction';
import type Peer from 'saito-js/lib/peer';
import type Wallet from 'saito-js/lib/wallet';
import type Blockchain from 'saito-js/lib/blockchain';
import type Factory from 'saito-js/lib/factory';
import type { LogLevel } from 'saito-js/saito';
import type TypedEventEmitter from './event-emitter';
export interface AsyncStorageLike {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
export type InterfaceEventPayload = {
    event: string;
    peerIndex: bigint;
    publicKey: string;
};
export type BlockSuccessPayload = {
    hash: string;
    blockId: bigint;
};
export type NewVersionPayload = {
    version: string;
    peerIndex: bigint;
};
export type BlockFetchStatusPayload = {
    count: bigint;
};
export type SaitoEventMap = {
    'interface-event': InterfaceEventPayload;
    'add-block-success': BlockSuccessPayload;
    'wallet-updated': void;
    'block-fetch-status': BlockFetchStatusPayload;
    'new-version-detected': NewVersionPayload;
    'new-chain-detected': void;
};
export type EventListener<K extends keyof SaitoEventMap> = (payload: SaitoEventMap[K]) => void;
export interface SaitoInitOptions {
    configs: any;
    privateKey?: string;
    logLevel?: LogLevel;
    hasteMultiplier?: bigint;
    deleteOldBlocks?: boolean;
    storage?: AsyncStorageLike;
    eventEmitter?: TypedEventEmitter<SaitoEventMap>;
    factory?: Factory;
}
export interface SaitoClient {
    sendTransaction(tx: Transaction, peerIndex?: bigint): Promise<any>;
    sendRequest<T = any>(type: string, data?: any, cb?: any, peerIndex?: bigint): Promise<T>;
    getPeers(): Promise<Peer[]>;
    getWallet(): Promise<Wallet>;
    getBlockchain(): Promise<Blockchain>;
    on<K extends keyof SaitoEventMap>(event: K, listener: EventListener<K>): () => void;
    once<K extends keyof SaitoEventMap>(event: K, listener: EventListener<K>): () => void;
    off<K extends keyof SaitoEventMap>(event: K, listener: EventListener<K>): void;
    events: TypedEventEmitter<SaitoEventMap>;
}
