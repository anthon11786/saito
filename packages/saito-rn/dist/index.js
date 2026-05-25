"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.TypedEventEmitter = exports.createInMemoryStorage = void 0;
exports.initSaito = initSaito;
const index_web_1 = require("saito-js/index.web");
const saito_1 = __importStar(require("saito-js/saito"));
const factory_1 = __importDefault(require("saito-js/lib/factory"));
const web_methods_1 = __importStar(require("./web-methods"));
const event_emitter_1 = __importDefault(require("./event-emitter"));
var web_methods_2 = require("./web-methods");
Object.defineProperty(exports, "createInMemoryStorage", { enumerable: true, get: function () { return web_methods_2.createInMemoryStorage; } });
var event_emitter_2 = require("./event-emitter");
Object.defineProperty(exports, "TypedEventEmitter", { enumerable: true, get: function () { return __importDefault(event_emitter_2).default; } });
var saito_2 = require("saito-js/saito");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return saito_2.LogLevel; } });
const DEFAULT_HASTE_MULTIPLIER = BigInt(1);
function registerListener(emitter, event, listener) {
    emitter.on(event, listener);
    return () => emitter.off(event, listener);
}
async function initSaito(options) {
    const events = options.eventEmitter ?? new event_emitter_1.default();
    const storage = options.storage ?? (0, web_methods_1.createInMemoryStorage)();
    const sharedMethods = new web_methods_1.default(storage, events);
    await sharedMethods.initialize();
    const factory = options.factory ?? new factory_1.default();
    await (0, index_web_1.initialize)(options.configs, sharedMethods, factory, options.privateKey ?? '', options.logLevel ?? saito_1.LogLevel.Info, options.hasteMultiplier ?? DEFAULT_HASTE_MULTIPLIER, options.deleteOldBlocks ?? true);
    const walletPromise = saito_1.default.getInstance().getWallet();
    const blockchainPromise = saito_1.default.getInstance().getBlockchain();
    saito_1.default.getInstance().start();
    return {
        sendTransaction: (tx, peerIndex) => saito_1.default.getInstance().sendTransactionWithCallback(tx, undefined, peerIndex),
        sendRequest: (type, data, cb, peerIndex) => saito_1.default.getInstance().sendRequest(type, data, cb, peerIndex),
        getPeers: () => saito_1.default.getInstance().getPeers(),
        getWallet: () => walletPromise,
        getBlockchain: () => blockchainPromise,
        on: (event, listener) => registerListener(events, event, listener),
        once: (event, listener) => {
            const wrapped = (payload) => {
                events.off(event, wrapped);
                listener(payload);
            };
            events.on(event, wrapped);
            return () => events.off(event, wrapped);
        },
        off: (event, listener) => events.off(event, listener),
        events
    };
}
