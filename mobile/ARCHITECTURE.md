# Saito Mobile - Architecture

## Overview

Saito Mobile is a React Native (Expo) wallet and chat app for the Saito blockchain. The core Saito protocol runs as a **WASM binary inside a hidden WebView**, and React Native communicates with it over a JSON-RPC bridge via `postMessage`. The native side handles UI, navigation, secure storage, and biometrics. The WebView side runs the full Saito lite client (blockchain sync, wallet cryptography, chat protocol, network peers).

```
┌─────────────────────────────────────────────────────────┐
│  React Native (Expo)                                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐│
│  │ Screens  │  │  Hooks   │  │  Services              ││
│  │ & UI     │──│ useWallet│──│ SecureKeyStore          ││
│  │          │  │ useChat  │  │ BiometricAuth           ││
│  │          │  │ useSaito │  │ MnemonicService         ││
│  └──────────┘  └────┬─────┘  │ NotificationService    ││
│                     │        └────────────────────────┘│
│              ┌──────┴──────┐                           │
│              │ WasmBridge  │  (RPC client)              │
│              └──────┬──────┘                           │
│                     │ injectJavaScript / postMessage    │
│  ┌──────────────────┴──────────────────────────────────┐│
│  │  Hidden WebView (1x1px, opacity 0)                  ││
│  │  ┌────────────────────────────────────────────────┐ ││
│  │  │  bridge-bundle.html                            │ ││
│  │  │  ┌─────────────────┐  ┌──────────────────────┐│ ││
│  │  │  │  saito.js       │  │ wasm-bridge-host.js  ││ ││
│  │  │  │  (webpack bundle│  │ (RPC server/dispatch)││ ││
│  │  │  │  + WASM inlined)│  │                      ││ ││
│  │  │  └─────────────────┘  └──────────────────────┘│ ││
│  │  └────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
            │
            │ WebSocket (ws/wss)
            ▼
    ┌──────────────────────┐
    │  Saito network peer  │  (localhost:12101 or saito.io:443)
    └──────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.83 + Expo SDK 55 (dev client) |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation 7 (stack + bottom tabs) |
| WASM runtime | Saito lite client via `node/` webpack bundle (falls back to `saito-lite-rust`) |
| WebView | `react-native-webview` (WKWebView on iOS) |
| Secure storage | `expo-secure-store` (Keychain with biometric gate) |
| Biometrics | `expo-local-authentication` (Face ID / Touch ID) |
| Camera / QR | `expo-camera` |
| Clipboard | `expo-clipboard` |
| Notifications | `expo-notifications` (local only) |
| Mnemonic | `bip39` (BIP39 24-word backup phrases) |

## Directory Structure

```
mobile/
├── index.js                    # Entry point (Buffer polyfill + registerRootComponent)
├── scripts/
│   └── build-bridge.js         # Builds bridge-bundle.html (inlines WASM + JS)
├── src/
│   ├── app/
│   │   ├── App.tsx             # Root: SaitoProvider → NavigationContainer → RootNavigator
│   │   └── SaitoProvider.tsx   # Context provider, renders hidden WebView, initializes bridge
│   ├── bridge/
│   │   ├── WasmBridge.ts       # RPC client (call/on/waitForReady/destroy)
│   │   ├── ModuleBridge.ts     # Module adapter registry (extensibility pattern)
│   │   ├── bridge-protocol.ts  # TypeScript types for bridge messages
│   │   ├── wasm-bridge-host.js # RPC server running inside WebView
│   │   ├── bridge-bundle.html  # GENERATED — self-contained HTML with everything inlined
│   │   └── wasm-webview.html   # Deprecated template
│   ├── hooks/
│   │   ├── useSaito.ts         # Access bridge + connection status from context
│   │   ├── useWallet.ts        # Public key, balance, sendTransaction, refreshBalance
│   │   └── useChat.ts          # Groups, messages, sendMessage, createGroup, markRead
│   ├── screens/
│   │   ├── OnboardingScreen.tsx
│   │   ├── CreateWalletScreen.tsx
│   │   ├── RestoreScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── SendScreen.tsx
│   │   ├── ReceiveScreen.tsx
│   │   ├── BackupScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── ChatListScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   ├── NewChatScreen.tsx
│   │   └── ChatSettingsScreen.tsx
│   ├── components/
│   │   ├── AddressInput.tsx     # Public key text input with paste/QR buttons
│   │   ├── AmountInput.tsx      # Numeric input with validation
│   │   ├── BalanceDisplay.tsx   # Large formatted balance
│   │   ├── ChatBubble.tsx       # Own vs. other message styling
│   │   ├── ChatGroupListItem.tsx
│   │   ├── ChatInput.tsx        # Text input + send button
│   │   ├── LoadingOverlay.tsx   # Modal spinner
│   │   ├── MnemonicGrid.tsx     # 24-word backup grid
│   │   ├── QRCodeDisplay.tsx    # QR code from string
│   │   ├── QRCodeScanner.tsx    # Camera-based scanner (expo-camera)
│   │   └── UserAvatar.tsx       # Deterministic color from public key
│   ├── services/
│   │   ├── SecureKeyStore.ts    # Keychain CRUD with biometric requirement
│   │   ├── BiometricAuth.ts     # Face ID / Touch ID / Iris detection + auth
│   │   ├── MnemonicService.ts   # BIP39 entropy ↔ mnemonic conversion
│   │   └── NotificationService.ts # Local push notifications for background chat
│   ├── types/
│   │   ├── index.ts             # ConnectionStatus, WalletState, PeerInfo
│   │   ├── chat.ts              # ChatMessage, ChatGroup
│   │   ├── navigation.ts        # React Navigation param lists
│   │   └── assets.d.ts          # Module declaration for .html imports
│   └── utils/
│       ├── formatting.ts        # nolanToSaito, saitoToNolan, truncateKey, formatTimestamp
│       └── validation.ts        # isValidPublicKey (base58), isValidAmount
├── ios/                         # Xcode project, AppDelegate.swift, Podfile
├── android/                     # Gradle project
├── app.json                     # Expo config (plugins, permissions, bundle IDs)
├── metro.config.js              # Expo metro config + html/wasm asset extensions
├── babel.config.js              # babel-preset-expo
├── tsconfig.json                # Strict TS, extends expo/tsconfig.base
└── package.json
```

## The WebView Bridge — How It Works

This is the central architectural pattern. The Saito protocol (consensus, wallet crypto, networking) is compiled to WASM and runs inside a JavaScript bundle (`saito.js`) produced by the `saito-lite-rust` project. Since React Native's Hermes engine cannot run WASM, we host it in a hidden WebView.

### Message Flow

**Commands (RN → WebView):**
```
React Hook → bridge.call('wallet', 'getBalance')
         → WasmBridge generates { id, module, method, params }
         → webviewRef.injectJavaScript('__SAITO_BRIDGE__.handleCommand(...)')
         → wasm-bridge-host.js dispatches to handler
         → handler calls app.wallet.getBalance()
         → postMessage({ id, result }) back to RN
         → WasmBridge resolves the pending promise
```

**Events (WebView → RN):**
```
Saito lite client fires 'wallet-updated' event
         → wasm-bridge-host.js listener catches it
         → postMessage({ type: 'event', module: 'wallet', event: 'balance-updated', data })
         → SaitoProvider.onMessage routes to bridge.handleMessage
         → WasmBridge dispatches to registered listeners
         → useWallet hook updates state
```

### Bridge Protocol Types

```typescript
// Command (RN → WebView)
{ id: "cmd_1_1707000000", module: "wallet", method: "getBalance", params: {} }

// Response (WebView → RN)
{ id: "cmd_1_1707000000", result: "500000000" }
// or
{ id: "cmd_1_1707000000", error: "Chat module not loaded" }

// Event (WebView → RN, unsolicited)
{ type: "event", module: "chat", event: "new-message", data: { groupId: "...", message: {...} } }

// Ready signal (WebView → RN, once)
{ type: "ready" }
```

### Available Bridge Methods

| Module | Method | Params | Returns |
|--------|--------|--------|---------|
| `core` | `init` | — | `{ status: 'ready' }` |
| `core` | `getPeers` | — | `PeerInfo[]` |
| `core` | `getBlockchainInfo` | — | `{ blockId, blockHash }` |
| `wallet` | `getPublicKey` | — | `string` |
| `wallet` | `getPrivateKey` | — | `string` |
| `wallet` | `getBalance` | — | `string` (nolan) |
| `wallet` | `setPrivateKey` | `{ privateKey }` | `{ publicKey }` |
| `wallet` | `generateNewWallet` | — | `{ publicKey, privateKey }` |
| `wallet` | `createAndSendTransaction` | `{ recipient, amount }` | `{ success, sig }` |
| `chat` | `getGroups` | — | `ChatGroup[]` |
| `chat` | `getMessages` | `{ groupId }` | `ChatMessage[]` |
| `chat` | `sendMessage` | `{ groupId, message }` | `{ success }` |
| `chat` | `createGroup` | `{ members, name? }` | `string` (groupId) |
| `chat` | `getOlderMessages` | `{ groupId, beforeTimestamp }` | `ChatMessage[]` |
| `chat` | `markRead` | `{ groupId }` | `{ success }` |

### Available Bridge Events

| Module | Event | Data |
|--------|-------|------|
| `wallet` | `balance-updated` | `{ balance: string }` |
| `core` | `block-added` | `{ hash, blockId }` |
| `chat` | `group-updated` | `ChatGroup` |
| `chat` | `new-message` | `{ groupId, message: ChatMessage }` |

## Navigation Structure

```
RootStack (headerless)
├── Onboarding (shown if no private key in SecureStore)
│   ├── Welcome        → OnboardingScreen
│   ├── CreateWallet   → CreateWalletScreen
│   └── Restore        → RestoreScreen
│
└── MainTabs (shown if private key exists)
    ├── HomeTab (label: "Wallet")
    │   ├── Home     → HomeScreen (balance + send/receive buttons)
    │   ├── Send     → SendScreen
    │   └── Receive  → ReceiveScreen
    │
    ├── ChatTab (label: "Chat")
    │   ├── ChatList     → ChatListScreen (+ FAB → NewChat)
    │   ├── Chat         → ChatScreen (params: groupId, name)
    │   ├── NewChat      → NewChatScreen
    │   └── ChatSettings → ChatSettingsScreen (params: groupId)
    │
    └── SettingsTab (label: "Settings")
        ├── SettingsMain → SettingsScreen
        └── Backup       → BackupScreen
```

Navigation routing on launch is determined by `SecureKeyStore.hasPrivateKey()`. After wallet creation, the app navigates to `MainTabs` via `navigation.reset()`.

## Key Data Types

```typescript
type ConnectionStatus = 'loading' | 'ready' | 'error';

type ChatMessage = {
  id: string;        // transaction signature
  groupId: string;
  sender: string;    // base58 public key
  message: string;
  timestamp: number;
  sig: string;
};

type ChatGroup = {
  id: string;
  name: string;
  members: string[];       // base58 public keys
  txs: ChatMessage[];
  unread: number;
  lastUpdate: number;
};
```

**Saito public keys** are base58-encoded 33-byte compressed secp256k1 keys (~44 characters, e.g. `eiPKRTtA5HpP838JdBrLF6vsX77QM7yi2rvZBUBjo9NJ`). They are NOT hex strings.

**Balances** are represented as strings in "nolan" (Saito's smallest unit). 1 SAITO = 100,000,000 nolan. Use `nolanToSaito()` and `saitoToNolan()` from `utils/formatting.ts` for conversion.

## Wallet & Security Flow

1. **Create wallet**: WASM core auto-generates a secp256k1 keypair during `initSaito()`. The bridge returns the existing keys via `wallet.generateNewWallet`.
2. **Store key**: The private key (hex) is saved to `expo-secure-store` with `requireAuthentication: true` (biometric-gated Keychain on iOS).
3. **Mnemonic backup**: The private key hex is converted to a BIP39 24-word mnemonic via `entropyToMnemonic()` for the user to write down.
4. **Restore wallet**: User enters 24 words → `mnemonicToEntropy()` → hex private key → `wallet.setPrivateKey` on the bridge → stored in SecureStore.
5. **App launch**: `SaitoProvider` waits for bridge ready, reads stored key from SecureStore (triggers biometric), injects it into the WebView via `wallet.setPrivateKey`.

## Building the Bridge Bundle

The WebView loads a **single self-contained HTML file** (`bridge-bundle.html`) with all dependencies inlined. This avoids Metro asset-serving issues with `.js` files and WASM loading in WKWebView.

### Prerequisites

Build the Saito lite client first. The build script prefers the monorepo `node/` build over the standalone `saito-lite-rust/`:

```bash
# Option A — preferred: use the monorepo node/ build (same saito-js version as your running node)
cd node
npm run compile    # produces web/saito/saito.js + *.wasm files

# Option B — fallback: use the standalone saito-lite-rust
cd saito-lite-rust
npm install
npm run compile    # produces web/saito/saito.js + *.wasm files
```

> **Critical: Version Matching**
>
> The `saito-js` (and `saito-wasm`) version in the mobile bridge **must match**
> the version running on the Saito node you connect to. A mismatch causes
> handshake deserialization failures (`Deserializing failed for handshake
> response`) and the mobile client will report 0 peers even after connecting.
>
> Check versions with:
> ```bash
> grep '"version"' node/node_modules/saito-js/package.json
> # Should match the saito-js used in the bridge bundle source
> ```
>
> The `build-bridge.js` script automatically prefers `node/web/saito/saito.js`
> (if it exists) over `saito-lite-rust/web/saito/saito.js` to avoid this issue.

The lite client entry point (`apps/lite/index.ts`) **must** set `window.__SAITO_APP__ = saito` after initialization so the bridge can find the app instance. Without this, the bridge never reaches `APP_READY` and all RPC calls (wallet, chat, etc.) will time out.

The modules config (`config/modules.config.js`) controls which Saito modules are bundled. The `lite` array is what gets included:

```javascript
lite: [
  'chat/chat.js',
  'encrypt/encrypt.js',
  'relay/relay.js',
  'registry/registry.js',
  'settings/settings.js',
]
```

### Build the bundle

```bash
cd mobile
npm run build-bridge    # node scripts/build-bridge.js
```

This script (`scripts/build-bridge.js`):

1. Reads `saito.js` — prefers `node/web/saito/` if it exists, falls back to `saito-lite-rust/web/saito/`
2. Patches webpack's `publicPath` auto-detection (throws in inline scripts; replaced with `__webpack_require__.p=""`)
3. Inlines all `.wasm` files as base64 data URIs (supports both WASM naming patterns: `<hash>.wasm` from saito-lite-rust and `static/zkey/index_bg<hash>.wasm` from node)
4. Inlines the JSStore web worker script (for Blob-based Worker creation)
5. Adds polyfills:
   - **fetch polyfill**: iOS WKWebView doesn't support `fetch()` with `data:` URIs
   - **Worker polyfill**: Intercepts `new Worker()` for jsstore and creates a Blob URL worker
6. Seeds default Saito config into localStorage (peers from `config/peers.js`, SPV mode, blockchain defaults). Build-time config always wins for `peers` and `server` — stale values in localStorage are overridden.
7. Appends `wasm-bridge-host.js` (the RPC server)
8. Writes the final `bridge-bundle.html` (~5-8 MB depending on WASM binary size)

### After rebuilding

Clear Metro cache so it picks up the new HTML:

```bash
rm -rf /tmp/metro-* .expo
npx expo start --clear
```

## Adding a New Bridge Module

To expose a new Saito module to React Native:

### 1. Add handlers in `wasm-bridge-host.js`

Add a new key to the `handlers` object:

```javascript
var handlers = {
  // ... existing modules ...

  registry: {
    lookupName: async function (app, params) {
      var registryMod = app.modules.returnModule('Registry');
      if (!registryMod) throw new Error('Registry module not loaded');
      var result = await registryMod.lookupName(params.name);
      return result;
    },
  },
};
```

### 2. Add event forwarding (if needed)

In the `waitForApp` callback at the bottom of `wasm-bridge-host.js`:

```javascript
app.connection.on('registry-name-resolved', function (data) {
  emitEvent('registry', 'name-resolved', { name: data.name, key: data.key });
});
```

### 3. Create a React hook

```typescript
// src/hooks/useRegistry.ts
export function useRegistry() {
  const { bridge, status } = useSaito();

  const lookupName = useCallback(async (name: string) => {
    if (!bridge) throw new Error('Bridge not ready');
    return bridge.call('registry', 'lookupName', { name });
  }, [bridge]);

  return { lookupName };
}
```

### 4. Rebuild the bundle

```bash
npm run build-bridge
```

The module must also be included in `saito-lite-rust/config/modules.config.js` under the `lite` array, and the Saito lite client must be recompiled (`npm run compile` in `saito-lite-rust/`).

## Adding a New Screen

1. Create the screen component in `src/screens/`.
2. Add its params to the relevant type in `src/types/navigation.ts`.
3. Register it in the appropriate navigator in `src/app/App.tsx`.
4. Use hooks (`useWallet`, `useChat`, `useSaito`) to access bridge data.

## iOS-Specific Notes

- **AppDelegate.swift** uses `ExpoReactNativeFactory` and `ExpoReactNativeFactoryDelegate` (not the bare RN versions). The module name is `"main"` (Expo convention with `registerRootComponent`).
- **Info.plist** includes `NSFaceIDUsageDescription`, `NSCameraUsageDescription`, and `NSAllowsLocalNetworking`.
- WebView is rendered at 1x1 pixels (not 0x0) because iOS throttles zero-sized WebViews.
- The fetch polyfill and Worker polyfill in the bundle are specifically for WKWebView limitations.

## Debugging

`SaitoProvider.tsx` injects JavaScript that forwards all WebView `console.log`/`console.error`/`console.warn` output to React Native's console, prefixed with `[WebView:log]`, `[WebView:error]`, etc. Uncaught errors and unhandled promise rejections are also forwarded.

The bridge bundle includes a status monitor that logs `[monitor Ns] waiting...` / `APP_READY` / `BRIDGE_READY` every 3 seconds until the Saito app instance is available.

To see all WebView output in the Metro console, just run the app normally — no Safari Web Inspector needed.

## Changing Network Peers

The mobile app connects to Saito peers via WebSocket. Peer configuration is managed in `config/peers.js`.

### Connect to Local Development Node

1. **Start your local Saito node** (in the `saito-lite-rust` repo):
   ```bash
   cd node
   npm run start
   ```
   The node will run on `http://localhost:12101` by default.

2. **Edit `mobile/config/peers.js`**:
   ```javascript
   module.exports = {
     peers: [
       { host: 'localhost', port: 12101, protocol: 'http', synctype: 'lite' },
     ],
     spv_mode: true,
     browser_mode: true,
   };
   ```

3. **Rebuild the bridge bundle**:
   ```bash
   cd mobile
   npm run build-bridge
   ```

4. **Clear Metro cache and restart**:
   ```bash
   rm -rf .expo
   npx expo start --clear
   ```

5. **Check the connection** in the Metro console:
   ```
   [WebView:log] connecting to ws://localhost:12101/wsopen....
   [WebView:log] connected to : ws://localhost:12101/wsopen with peer index : 1
   ```

### Connect to Live Network

To connect to the production Saito network, edit `config/peers.js`:

```javascript
module.exports = {
  peers: [
    { host: 'saito.io', port: 443, protocol: 'https', synctype: 'lite' },
  ],
  spv_mode: true,
  browser_mode: true,
};
```

### Connect to Physical Device (Local Network)

If testing on a real iPhone/iPad (not simulator), replace `localhost` with your Mac's local IP:

1. **Find your Mac's IP address**:
   ```bash
   ipconfig getifaddr en0
   # Example output: 192.168.1.100
   ```

2. **Use the IP in `config/peers.js`**:
   ```javascript
   module.exports = {
     peers: [
       { host: '192.168.1.100', port: 12101, protocol: 'http', synctype: 'lite' },
     ],
     spv_mode: true,
     browser_mode: true,
   };
   ```

3. **Rebuild the bundle** and restart Metro as above.

### Multiple Peers

You can connect to multiple peers by adding more entries to the `peers` array in `config/peers.js`:

```javascript
module.exports = {
  peers: [
    { host: 'localhost', port: 12101, protocol: 'http', synctype: 'lite' },
    { host: 'saito.io', port: 443, protocol: 'https', synctype: 'lite' },
  ],
  spv_mode: true,
  browser_mode: true,
};
```

### Troubleshooting Peer Connections

- **Check Settings tab** - Shows peer count (should be > 0 after connection)
- **Check block height** - If syncing, block height will increase
- **Check Metro logs** for:
  ```
  [WebView:log] connected to : ws://...
  [WebView:log] peer_connect received for : 1
  [WebView:log] handshake complete
  [monitor Ns] APP_READY, BRIDGE_READY
  ```
- **Common issues**:
  - `Deserializing failed for handshake response` in node logs → **saito-js version mismatch** between the mobile bridge and the node. Rebuild the bridge using the same source as the node (see "Version Matching" above).
  - Only `BRIDGE_READY` in monitor, never `APP_READY` → The lite client entry point (`apps/lite/index.ts`) is missing `window.__SAITO_APP__ = saito`. All RPC calls will time out.
  - `cannot parse key` error → Protocol version mismatch between WASM and server.
  - `Network request failed` → Firewall blocking WebSocket, wrong host/port.
  - `peer_connect never fires` → Handshake failing (check WASM/server compatibility).
  - Still connecting to `saito.io` despite `peers.js` set to localhost → Stale `localStorage` from a prior build. The build script now forces build-time config to win for `peers` and `server`, but you may need to clear the app's WebView storage.

## Common Tasks

| Task | What to do |
|------|-----------|
| Change network peer | Edit `config/peers.js`, run `npm run build-bridge`, clear Metro cache with `npx expo start --clear` |
| Add a Saito module | Add to `lite` array in `node/config/modules.config.js` (or `saito-lite-rust/`), recompile, add handlers in `wasm-bridge-host.js`, rebuild bundle |
| Change UI theme | Header/tab colors are in `screenOptions` and `Tab.Navigator` config in `App.tsx`. Background is `#0f172a` (slate-900), accent is `#e11d48` (rose-600) |
| Run on device | `npx expo run:ios --device` (requires Expo dev client build) |
| Clear all caches | `rm -rf /tmp/metro-* .expo node_modules/.cache && npx expo start --clear` |
| Check types | `npx tsc --noEmit` |
| Run tests | `npm test` |
