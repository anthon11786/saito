#!/usr/bin/env node
/**
 * Builds a single self-contained bridge-bundle.html by inlining
 * saito.js (with WASM base64-encoded, Worker inlined) and wasm-bridge-host.js.
 *
 * Usage: node scripts/build-bridge.js
 */
const fs = require('fs');
const path = require('path');
const peerConfig = require('../config/peers.js');

// Prefer the monorepo node/ build (saito-js 0.2.182+) over the standalone saito-lite-rust.
// Fall back to saito-lite-rust if the node build isn't available.
const NODE_SAITO_DIR = path.resolve(__dirname, '../../node/web/saito');
const LITE_SAITO_DIR = path.resolve(__dirname, '../../../saito-lite-rust/web/saito');
const SAITO_DIR = fs.existsSync(path.join(NODE_SAITO_DIR, 'saito.js'))
  ? NODE_SAITO_DIR
  : LITE_SAITO_DIR;
const SAITO_BUNDLE = path.join(SAITO_DIR, 'saito.js');

const NODE_JSSTORE = path.resolve(__dirname, '../../node/node_modules/jsstore/dist/jsstore.worker.min.js');
const LITE_JSSTORE = path.resolve(__dirname, '../../../saito-lite-rust/node_modules/jsstore/dist/jsstore.worker.min.js');
const JSSTORE_WORKER = fs.existsSync(NODE_JSSTORE) ? NODE_JSSTORE : LITE_JSSTORE;
const BRIDGE_DIR = path.resolve(__dirname, '../src/bridge');
const BRIDGE_HOST = path.join(BRIDGE_DIR, 'wasm-bridge-host.js');
const OUTPUT = path.join(BRIDGE_DIR, 'bridge-bundle.html');

if (!fs.existsSync(SAITO_BUNDLE)) {
  console.error(
    'ERROR: saito.js not found. Build saito-lite-rust first:\n  cd saito-lite-rust && npm run compile'
  );
  process.exit(1);
}

let saitoJs = fs.readFileSync(SAITO_BUNDLE, 'utf-8');

// 1. Patch webpack's automatic publicPath detection.
const publicPathError = 'throw new Error("Automatic publicPath is not supported in this browser")';
if (saitoJs.includes(publicPathError)) {
  saitoJs = saitoJs.replace(publicPathError, '__webpack_require__.p=""');
  console.log('  Patched webpack publicPath auto-detection');
}

// 2. Inline WASM files as base64 data URIs.
//    Pattern A (saito-lite-rust): r.p+"<hash>.wasm"
//    Pattern B (node):            n.p+"static/zkey/index_bg<hash>.wasm"
const wasmPatterns = [
  /([a-z])\.p\+"([a-f0-9]+\.wasm)"/g,
  /([a-z])\.p\+"(static\/zkey\/index_bg[a-f0-9]+\.wasm)"/g,
];
let inlinedCount = 0;
for (const wasmPattern of wasmPatterns) {
  let match;
  while ((match = wasmPattern.exec(saitoJs)) !== null) {
    const varName = match[1];
    const relPath = match[2];
    const wasmFile = path.join(SAITO_DIR, relPath);
    if (!fs.existsSync(wasmFile)) {
      console.error(`WARNING: WASM file not found: ${relPath}`);
      continue;
    }
    const wasmB64 = fs.readFileSync(wasmFile).toString('base64');
    const dataUri = `"data:application/wasm;base64,${wasmB64}"`;
    const original = `${varName}.p+"${relPath}"`;
    saitoJs = saitoJs.replace(original, dataUri);
    inlinedCount++;
    console.log(`  Inlined WASM ${relPath} (${(wasmB64.length / 1024 / 1024).toFixed(1)} MB)`);
  }
}

// 3. Read the JSStore worker script for inlining.
const jsStoreWorkerJs = fs.readFileSync(JSSTORE_WORKER, 'utf-8');
console.log(`  JSStore worker: ${(jsStoreWorkerJs.length / 1024).toFixed(0)} KB`);

const bridgeHostJs = fs.readFileSync(BRIDGE_HOST, 'utf-8');

// Polyfill: iOS WKWebView doesn't support fetch() with data: URIs.
const fetchPolyfill = `
(function() {
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.indexOf('data:') === 0) {
      try {
        var commaIdx = input.indexOf(',');
        var meta = input.substring(0, commaIdx);
        var b64 = input.substring(commaIdx + 1);
        var raw = atob(b64);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var ct = meta.replace('data:', '').split(';')[0] || 'application/octet-stream';
        return Promise.resolve(new Response(bytes.buffer, {
          status: 200,
          headers: { 'Content-Type': ct }
        }));
      } catch(e) {
        return Promise.reject(e);
      }
    }
    return origFetch.apply(this, arguments);
  };
})();
`;

// Worker polyfill: intercept Worker() calls for jsstore.worker.js and create
// a Blob-based Worker with the inlined script instead.
const workerPolyfill = `
(function() {
  var OrigWorker = window.Worker;
  var workerCode = ${JSON.stringify(jsStoreWorkerJs)};
  window.Worker = function(url, opts) {
    if (typeof url === 'string' && url.indexOf('jsstore.worker') !== -1) {
      console.log('[worker-polyfill] intercepted jsstore worker, creating Blob worker');
      var blob = new Blob([workerCode], { type: 'application/javascript' });
      var blobUrl = URL.createObjectURL(blob);
      return new OrigWorker(blobUrl, opts);
    }
    return new OrigWorker(url, opts);
  };
})();
`;

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Saito Mobile Bridge</title>
</head>
<body>
<script>${fetchPolyfill}</script>
<script>${workerPolyfill}</script>
<script>
// Ensure localStorage has valid options with required fields.
// Saito's loadOptions() reads from localStorage first, falling back to
// fetch('/options') which doesn't exist in the WebView.
(function() {
  var defaults = {
    "peers": ${JSON.stringify(peerConfig.peers)},
    "spv_mode": ${peerConfig.spv_mode},
    "browser_mode": ${peerConfig.browser_mode},
    "blockchain": {
      "last_block_hash": "0000000000000000000000000000000000000000000000000000000000000000",
      "last_block_id": 0,
      "last_timestamp": 0,
      "genesis_block_id": 0,
      "genesis_timestamp": 0,
      "lowest_acceptable_timestamp": 0,
      "lowest_acceptable_block_hash": "0000000000000000000000000000000000000000000000000000000000000000",
      "lowest_acceptable_block_id": 0,
      "fork_id": "0000000000000000000000000000000000000000000000000000000000000000"
    },
    "wallet": {},
    "server": {
      "host": "localhost",
      "port": 12101,
      "protocol": "http",
      "endpoint": {"host": "localhost", "port": 12101, "protocol": "http"},
      "verification_threads": 1
    }
  };
  var existing = {};
  try { existing = JSON.parse(localStorage.getItem('options')) || {}; } catch(e) {}
  // Merge: ensure required top-level keys exist
  // Note: defaults MUST win for peers/server so config changes take effect on rebuild
  //        UNLESS the user has explicitly configured a peer via the app UI.
  var merged = Object.assign({}, defaults, existing);
  if (!merged.blockchain || !merged.blockchain.last_block_hash) merged.blockchain = defaults.blockchain;

  // Check for user-configured peer override (set by Settings > Peer Connection)
  var userPeers = null;
  try { userPeers = JSON.parse(localStorage.getItem('user_peers')); } catch(e) {}
  if (Array.isArray(userPeers) && userPeers.length > 0) {
    merged.peers = userPeers;
    // Also update server endpoint to match the first user peer
    var up = userPeers[0];
    merged.server = {
      host: up.host || 'localhost',
      port: up.port || 12101,
      protocol: up.protocol || 'http',
      endpoint: { host: up.host || 'localhost', port: up.port || 12101, protocol: up.protocol || 'http' },
      verification_threads: 1
    };
    console.log('[config] Using user-configured peer:', JSON.stringify(up));
  } else {
    merged.peers = defaults.peers;
    merged.server = defaults.server;
  }
  localStorage.setItem('options', JSON.stringify(merged));
  console.log('[config] options ensured:', JSON.stringify(Object.keys(merged)));
  console.log('[config] wallet.privateKey:', merged.wallet?.privateKey ? 'SET (' + merged.wallet.privateKey.length + ' chars)' : 'NOT SET');

  // Log what will be loaded by saito.storage.initialize()
  window.addEventListener('DOMContentLoaded', function() {
    try {
      var reloaded = JSON.parse(localStorage.getItem('options')) || {};
      console.log('[config] After DOMContentLoaded, wallet.privateKey:', reloaded.wallet?.privateKey ? 'SET (' + reloaded.wallet.privateKey.length + ' chars)' : 'NOT SET');
    } catch(e) {
      console.error('[config] Failed to reload options:', e);
    }
  });
})();
</script>
<script>
// Status monitor
(function() {
  var start = Date.now();
  var timer = setInterval(function() {
    var elapsed = ((Date.now() - start) / 1000).toFixed(0);
    var status = [];
    if (window.__SAITO_APP__) status.push('APP_READY');
    if (window.__SAITO_BRIDGE__) status.push('BRIDGE_READY');
    console.log('[monitor ' + elapsed + 's] ' + (status.length ? status.join(', ') : 'waiting...'));
    if (window.__SAITO_APP__) clearInterval(timer);
  }, 3000);
})();
</script>
<script>
${saitoJs}
</script>
<script>
${bridgeHostJs}
</script>
</body>
</html>
`;

fs.writeFileSync(OUTPUT, html);
const sizeMB = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
console.log(`bridge-bundle.html written (${sizeMB} MB, ${inlinedCount} WASM file(s) inlined)`);
