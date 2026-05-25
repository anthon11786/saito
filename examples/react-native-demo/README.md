# React Native demo (Saito network)

This demo shows a minimal React Native screen that connects to the Saito network, lists peers, and fires a sample request. It mirrors the lite client bootstrap found in `node/apps/lite/index.ts` but uses React Native-friendly wiring for UI and storage.

## Running the demo

1. Install dependencies
   ```bash
   npm install
   ```

2. Start the Metro bundler or your preferred RN runner (iOS/Android):
   ```bash
   npx react-native start
   npx react-native run-ios    # or run-android
   ```

## What the screen does

- Initializes `saito-js` using a React Native compatible set of callbacks
- Displays connection status, wallet public key, and current peer count
- Lets you refresh peers on demand
- Sends a simple `"note"` request to connected peers to prove network interaction

> Note: This is a demo. You may want to add proper persistence for wallets/block headers (AsyncStorage/SQLite) and production-grade reconnect logic for real apps.
