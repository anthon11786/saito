# React Native integration guide

Use this guide to embed the Saito JS runtime inside a React Native application. It covers package installation, the minimum polyfills needed for the Node primitives used in the codebase, initialization, event wiring, transaction submission, and mobile platform caveats.

## Install and polyfills

1. Add runtime dependencies:
   ```bash
   npm install saito-js buffer events crypto-browserify stream-browserify path-browserify url
   ```
   The imports in `lib/saito/crypto.ts` rely on `crypto-browserify`, `buffer`, and `secp256k1`, while other files use Node’s `EventEmitter` APIs. 【F:lib/saito/crypto.ts†L1-L77】【F:lib/saito/connection.ts†L1-L28】
2. Ensure Babel/TypeScript can handle BigInt and async/await by loading the existing `babel-polyfill` dependency before your app code:
   ```js
   import 'babel-polyfill';
   ```
3. Apply the polyfills at the top of your React Native entry file (e.g., `index.js`):
   ```js
   import { Buffer } from 'buffer';
   import crypto from 'crypto-browserify';
   import 'react-native-url-polyfill/auto';

   global.Buffer = global.Buffer || Buffer;
   if (!global.crypto?.getRandomValues) {
     global.crypto = crypto;
   }
   ```

## Initialization snippet

The browser-lite initialization shows how to bootstrap Saito in a non-Node runtime. Mirror that flow in React Native:

```ts
import { initialize, LogLevel } from 'saito-js/index.web';
import S from 'saito-js/saito';
import WebSharedMethods from 'saito-js/lib/custom/shared_methods.web';
import Factory from '../lib/saito/factory';
import { Saito } from '../apps/core';
import build from '../config/build.json';

class MobileMethods extends WebSharedMethods {
  constructor(private app: Saito) {
    super();
  }

  // forward wallet/network events into the RN layer
  sendWalletUpdate() {
    this.app.connection.emit('wallet-updated');
  }
  sendBlockFetchStatus(count: number) {
    this.app.connection.emit('block-fetch-status', { count });
  }
}

export async function startSaito(options) {
  const app = new Saito(options);
  await app.storage.initialize();
  app.options.browser_mode = true;
  app.options.spv_mode = true;
  app.build_number = parseInt(build.build_number, 10);

  await initialize(
    app.options,
    new MobileMethods(app),
    new Factory(),
    app.options.wallet?.privateKey || '',
    LogLevel.Info,
    BigInt(1),
    true
  );

  app.wallet = (await S.getInstance().getWallet()) as any;
  app.blockchain = (await S.getInstance().getBlockchain()) as any;
  app.BROWSER = 1;
  app.SPVMODE = 1;
  await app.init();
  S.getInstance().start();
  return app;
}
```
This mirrors the browser-lite bootstrap in `apps/lite/index.ts`. The `MobileMethods` bridge forwards native callbacks to the shared `connection` emitter so you can listen in JavaScript. 【F:apps/lite/index.ts†L6-L120】

## Event wiring

The `Connection` class extends `EventEmitter`, so you can subscribe directly. The web bridge emits several lifecycle events worth wiring up: 【F:lib/saito/connection.ts†L1-L28】【F:apps/lite/index.ts†L60-L117】

- `wallet-updated` – wallet state changed (balances, keys).
- `add-block-success` – a new block was accepted.
- `block-fetch-status` – sync progress updates.
- `new-version-detected` – a peer reports a higher version.
- `new-chain-detected` – a potential reorg was detected.

Core network and wallet events are also available from the Events Protocol, including `connection_up`, `connection_down`, `handshake_complete`, `header-update-crypto`, `registry-update-identifier`, `update_email`, `update_tag`, and `set_preferred_crypto`. 【F:docs/events.md†L18-L94】

Example wiring:

```ts
app.connection.on('wallet-updated', () => {/* refresh balances */});
app.connection.on('add-block-success', ({ hash, blockId }) => {/* update UI */});
app.connection.on('connection_up', peer => {/* show online */});
```

## Transaction submission flow

Use the wallet helpers to assemble, sign, and propagate transactions: 【F:lib/saito/wallet.ts†L32-L109】【F:lib/saito/network.ts†L24-L55】

1. Build an unsigned transaction with a default fee:
   ```ts
   const tx = await app.wallet.createUnsignedTransactionWithDefaultFee(
     recipientPublicKey,
     app.wallet.convertSaitoToNolan('1.0')
   );
   tx.msg = { module: 'MyModule', payload: {...} };
   ```
2. Sign (and encrypt when a shared secret exists):
   ```ts
   await app.wallet.signAndEncryptTransaction(tx, recipientPublicKey);
   ```
3. Submit to the network, optionally with a callback:
   ```ts
   await app.network.propagateTransaction(tx);
   // or
   await app.network.sendTransactionWithCallback(tx, (res) => {/* handle */});
   ```

## Platform caveats

- **Android**: add `android.permission.INTERNET` (and `ACCESS_NETWORK_STATE` if you surface connectivity) in `AndroidManifest.xml`. If you test against non-TLS endpoints, set a Network Security Config that permits cleartext for your dev host.
- **iOS**: App Transport Security blocks cleartext HTTP and some websocket targets by default. Add an `NSAppTransportSecurity` entry with `NSAllowsArbitraryLoads` for development or explicit `NSExceptionDomains` for your Saito websocket hosts. Confirm your websocket URLs use `wss://` in production.
- **Metro configuration**: map Node core modules to the installed polyfills so metro can resolve them:
  ```js
  // metro.config.js
  const path = require('path');
  module.exports = {
    resolver: {
      extraNodeModules: {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        path: require.resolve('path-browserify'),
        buffer: require.resolve('buffer'),
        url: require.resolve('url'),
        events: require.resolve('events'),
      },
    },
  };
  ```
  This matches the imports used by the Saito crypto, networking, and initialization code paths.
