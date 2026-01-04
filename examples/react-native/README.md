# React Native + `saito-js` example

This example shows how to host the `saito-js` wrapper inside a React Native application. It demonstrates:

- Initializing the wasm wrapper with a React Native–friendly `SharedMethods` implementation.
- Performing a handshake and watching connected peer counts.
- Loading or generating a wallet key, persisting it with `AsyncStorage`, and reacting to wallet/block events.
- Sending a signed demo transaction and rendering the peer response.
- Logging inbound peer requests handled by the custom shared methods.

> The sample targets a lightweight, SPV-style client. Update the peer list in `saitoConfig.ts` to point at a node you control or trust.

## Files

- [`App.tsx`](./App.tsx) – React Native UI that boots Saito, displays connection status, and drives demo requests.
- [`ReactNativeSharedMethods.ts`](./ReactNativeSharedMethods.ts) – Bridges wasm callbacks to React Native (`AsyncStorage`, `EventEmitter`, WebSocket).
- [`saitoConfig.ts`](./saitoConfig.ts) – Default config template, storage keys, and the demo request label.

## Prerequisites

- An existing React Native project (Expo or CLI). The files here drop into your app’s source tree.
- Install dependencies used by the example:

```bash
npm install saito-js eventemitter3 @react-native-async-storage/async-storage buffer react-native-get-random-values
```

If you use TypeScript, ensure your `tsconfig` includes JSX/React Native types.

## Wiring the demo into your app

1. Copy the three files in `examples/react-native` into your project (e.g., `./src/saito/`).
2. Adjust the peer list in `saitoConfig.ts` to match a reachable Saito node (seed or your own).
3. Import and render `App` from `App.tsx` (or merge its logic into your own screen/component).
4. Run your React Native app as usual (`npx expo start`, `npx react-native run-ios`, etc.).

## What the UI demonstrates

- **Handshake + peer count** – `ReactNativeSharedMethods.sendInterfaceEvent` forwards the `handshake_complete` event into an `EventEmitter`. `App.tsx` listens, updates the peer count via `Saito.getInstance().getPeers()`, and renders the latest peers.
- **Key management** – On boot, the app loads `@saito/react-native/*` keys from `AsyncStorage`; if none exist, it generates new keys with `Saito.generatePrivateKey`, sets them on the wallet, and persists them. A “Regenerate key” button repeats this flow.
- **Wallet/block events** – Wallet updates trigger `wallet-updated`; block additions trigger `add-block-success`. Both are emitted by `ReactNativeSharedMethods` and rendered in the UI.
- **Signed demo transaction** – “Send demo tx” builds a `DEMO_REQUEST` transaction, signs it, and calls `sendTransactionWithCallback`. The peer’s response (if any) is rendered under “Peer response.”
- **Inbound peer requests** – `ReactNativeSharedMethods.processApiCall` emits a `peer-request` event and replies with an acknowledgement so callbacks resolve cleanly.

## Notes and tips

- The config defaults to `wss://lite.saito.io` as a placeholder. Replace it with your own peer(s) to ensure a successful handshake.
- The example sets `browser_mode` + `spv_mode` to true and uses `delete_old_blocks` when calling `initialize` to keep storage light.
- React Native needs `Buffer` and `crypto.getRandomValues` polyfills; both are applied at the top of `App.tsx` via `buffer` and `react-native-get-random-values`.
- Storage writes happen via `AsyncStorage` inside the shared methods; reads are cached for the synchronous hooks expected by `saito-js`.
