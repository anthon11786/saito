import { initialize as initializeSaito } from 'saito-js/index.web';
import S, { LogLevel } from 'saito-js/saito';
import Factory from 'saito-js/lib/factory';
import ReactNativeSharedMethods, { createInMemoryStorage } from './web-methods';
import type {
    AsyncStorageLike,
    SaitoClient,
    SaitoEventMap,
    SaitoInitOptions,
    EventListener
} from './types';
import TypedEventEmitter from './event-emitter';
import type Transaction from 'saito-js/lib/transaction';
import type Peer from 'saito-js/lib/peer';
import type Wallet from 'saito-js/lib/wallet';
import type Blockchain from 'saito-js/lib/blockchain';

export type {
    Transaction,
    Peer,
    Wallet,
    Blockchain,
    SaitoEventMap,
    SaitoInitOptions,
    AsyncStorageLike,
    EventListener,
    SaitoClient
};
export { createInMemoryStorage } from './web-methods';
export { default as TypedEventEmitter } from './event-emitter';
export { LogLevel } from 'saito-js/saito';

const DEFAULT_HASTE_MULTIPLIER = BigInt(1);

function registerListener<K extends keyof SaitoEventMap>(
    emitter: TypedEventEmitter<SaitoEventMap>,
    event: K,
    listener: EventListener<K>
): () => void {
    emitter.on(event, listener);
    return () => emitter.off(event, listener);
}

export async function initSaito(options: SaitoInitOptions): Promise<SaitoClient> {
    const events = options.eventEmitter ?? new TypedEventEmitter<SaitoEventMap>();
    const storage = options.storage ?? createInMemoryStorage();
    const sharedMethods = new ReactNativeSharedMethods(storage, events);
    await sharedMethods.initialize();

    const factory = options.factory ?? new Factory();
    await initializeSaito(
        options.configs,
        sharedMethods,
        factory,
        options.privateKey ?? '',
        options.logLevel ?? LogLevel.Info,
        options.hasteMultiplier ?? DEFAULT_HASTE_MULTIPLIER,
        options.deleteOldBlocks ?? true
    );

    const walletPromise = S.getInstance().getWallet();
    const blockchainPromise = S.getInstance().getBlockchain();

    S.getInstance().start();

    return {
        sendTransaction: (tx: Transaction, peerIndex?: bigint) =>
            S.getInstance().sendTransactionWithCallback(tx, undefined, peerIndex),
        sendRequest: (type: string, data?: any, cb?: any, peerIndex?: bigint) =>
            S.getInstance().sendRequest(type, data, cb, peerIndex),
        getPeers: () => S.getInstance().getPeers(),
        getWallet: () => walletPromise,
        getBlockchain: () => blockchainPromise,
        on: <K extends keyof SaitoEventMap>(event: K, listener: EventListener<K>) =>
            registerListener(events, event, listener),
        once: <K extends keyof SaitoEventMap>(event: K, listener: EventListener<K>) => {
            const wrapped: EventListener<K> = (payload) => {
                events.off(event, wrapped);
                listener(payload);
            };
            events.on(event, wrapped);
            return () => events.off(event, wrapped);
        },
        off: <K extends keyof SaitoEventMap>(event: K, listener: EventListener<K>) =>
            events.off(event, listener),
        events
    };
}
