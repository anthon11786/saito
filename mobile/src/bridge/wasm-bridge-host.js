/**
 * wasm-bridge-host.js
 *
 * Runs INSIDE the hidden WebView. Acts as the RPC server that receives
 * commands from React Native and forwards Saito module events back.
 *
 * Expects `window.__SAITO_APP__` to be set by the Saito lite client init
 * (saito-mobile-bundle.js) once Saito is ready.
 */

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────

  function postToRN(msg) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } catch (e) {
      console.error('[bridge-host] postToRN failed', e);
    }
  }

  function respond(id, result) {
    postToRN({ id: id, result: result });
  }

  function respondError(id, error) {
    postToRN({ id: id, error: String(error) });
  }

  function emitEvent(module, event, data) {
    postToRN({ type: 'event', module: module, event: event, data: data });
  }

  // ── Serializers ──────────────────────────────────────────────────────

  function serializeGroup(group) {
    return {
      id: group.id || '',
      name: group.name || '',
      members: group.members || [],
      txs: (group.txs || []).slice(-50).map(serializeMessage),
      unread: group.unread || 0,
      lastUpdate: group.last_update || group.lastUpdate || 0,
    };
  }

  function serializeMessage(tx) {
    // Chat module stores two formats:
    //   1. Raw transactions (from createChatTransaction): tx.msg is an OBJECT
    //      { module: 'Chat', message: 'hello', group_id: '...', ... }
    //      tx.from is [{ publicKey: '...' }]
    //   2. Stored messages (from addTransactionToGroup): tx.msg is a STRING
    //      (the message text itself), tx.from is ['publicKeyString']
    var msg = tx.msg || tx;
    var isStoredFormat = typeof msg === 'string';
    var messageText = isStoredFormat ? msg : (msg.message || '');
    var groupId = isStoredFormat ? '' : (msg.group_id || msg.groupId || '');
    var sender = '';
    if (tx.from && tx.from.length > 0) {
      var first = tx.from[0];
      sender = (typeof first === 'string') ? first : (first.publicKey || '');
    }
    if (!sender && !isStoredFormat) {
      sender = msg.sender || '';
    }
    return {
      id: tx.signature || tx.sig || tx.id || String(Date.now()) + Math.random(),
      groupId: groupId,
      sender: sender,
      message: messageText,
      timestamp: tx.timestamp || (isStoredFormat ? 0 : msg.timestamp) || 0,
      sig: tx.signature || tx.sig || '',
    };
  }

  // ── Wait for Saito init ──────────────────────────────────────────────

  function waitForApp(callback) {
    if (window.__SAITO_APP__) {
      callback(window.__SAITO_APP__);
      return;
    }
    var interval = setInterval(function () {
      if (window.__SAITO_APP__) {
        clearInterval(interval);
        callback(window.__SAITO_APP__);
      }
    }, 100);
  }

  // ── Command handlers ─────────────────────────────────────────────────

  var handlers = {
    core: {
      init: async function (app, params) {
        return { status: 'ready' };
      },
      getPeers: async function (app) {
        var peers = [];
        try {
          peers = await app.network.getPeers();
          console.log('[bridge] getPeers returned', peers.length, 'peers');

          // Try alternate method: getPeer by index
          if (peers.length === 0) {
            console.log('[bridge] Trying getPeer(1) directly...');
            try {
              var peer1 = await app.network.getPeer(BigInt(1));
              if (peer1) {
                console.log('[bridge] getPeer(1) found peer:', peer1.publicKey, peer1.host);
                peers = [peer1];
              }
            } catch (e) {
              console.log('[bridge] getPeer(1) failed:', e.message);
            }
          }

          if (peers.length > 0) {
            console.log('[bridge] First peer:', JSON.stringify({
              publicKey: peers[0].publicKey,
              host: peers[0].host,
              port: peers[0].port,
              peerIndex: peers[0].peerIndex?.toString()
            }));
          } else if (connectedPeerCount > 0) {
            // Fallback: if we tracked connections but getPeers returns nothing
            // Read configured peer from localStorage options
            console.log('[bridge] getPeers empty but tracked', connectedPeerCount, 'connections');
            var fallbackHost = 'localhost';
            var fallbackPort = 12101;
            try {
              var opts = JSON.parse(localStorage.getItem('options')) || {};
              if (Array.isArray(opts.peers) && opts.peers.length > 0) {
                fallbackHost = opts.peers[0].host || fallbackHost;
                fallbackPort = opts.peers[0].port || fallbackPort;
              }
            } catch (e) {}
            return [{
              publicKey: 'unknown',
              host: fallbackHost,
              port: fallbackPort,
              connected: true,
            }];
          }
        } catch (e) {
          console.error('[bridge] getPeers error:', e);
        }
        return peers.map(function (p) {
          return {
            publicKey: p.publicKey || p.peer?.publicKey || '',
            host: p.host || '',
            port: p.port || 0,
            connected: true,
          };
        });
      },
      getBlockchainInfo: async function (app) {
        var bc = app.blockchain;
        return {
          blockId: bc?.last_block_id?.toString() || '0',
          blockHash: bc?.last_block_hash || '',
        };
      },
      getPeerConfig: async function (app) {
        // Return the current peer config: check user override first, then options
        var userPeers = null;
        try { userPeers = JSON.parse(localStorage.getItem('user_peers')); } catch (e) {}
        var isCustom = Array.isArray(userPeers) && userPeers.length > 0;
        var activePeer = null;
        if (isCustom) {
          activePeer = userPeers[0];
        } else {
          try {
            var opts = JSON.parse(localStorage.getItem('options')) || {};
            activePeer = (opts.peers && opts.peers[0]) || null;
          } catch (e) {}
        }
        return {
          host: (activePeer && activePeer.host) || 'localhost',
          port: (activePeer && activePeer.port) || 12101,
          protocol: (activePeer && activePeer.protocol) || 'http',
          synctype: (activePeer && activePeer.synctype) || 'lite',
          isCustom: isCustom,
        };
      },
      setPeerConfig: async function (app, params) {
        // Save user-configured peer to localStorage (survives WebView reloads)
        var peer = {
          host: (params.host || '').trim(),
          port: parseInt(params.port, 10) || 12101,
          protocol: params.protocol || 'http',
          synctype: 'lite',
        };
        if (!peer.host) throw new Error('Host is required');
        localStorage.setItem('user_peers', JSON.stringify([peer]));
        console.log('[bridge] User peer saved:', JSON.stringify(peer));
        return { success: true, peer: peer };
      },
      resetPeerConfig: async function (app) {
        // Remove user override so build-time defaults take effect on next reload
        localStorage.removeItem('user_peers');
        console.log('[bridge] User peer override cleared, will use defaults on reload');
        return { success: true };
      },
    },

    wallet: {
      getPublicKey: async function (app) {
        return await app.wallet.getPublicKey();
      },
      getPrivateKey: async function (app) {
        return await app.wallet.getPrivateKey();
      },
      getBalance: async function (app) {
        var bal = await app.wallet.getBalance();
        return bal.toString();
      },
      createAndSendTransaction: async function (app, params) {
        var recipient = (params.recipient || '').trim();
        if (!recipient) throw new Error('Recipient address is required');
        var newtx = await app.wallet.createUnsignedTransaction(
          recipient,
          BigInt(params.amount)
        );
        if (!newtx) throw new Error('Failed to create transaction');
        await newtx.sign();
        await app.network.propagateTransaction(newtx);
        return { success: true, sig: newtx.sig };
      },
      generateNewWallet: async function (app) {
        // The WASM core generates a keypair during initSaito().
        // Just return the existing keys.
        return {
          publicKey: await app.wallet.getPublicKey(),
          privateKey: await app.wallet.getPrivateKey(),
        };
      },
      setPrivateKey: async function (app, params) {
        var pk = (params.privateKey || '').trim();
        if (!pk) throw new Error('No private key provided');

        // Derive public key from private key
        var publicKey = app.crypto.generatePublicKey(pk);

        // Set keys in the WASM layer
        await app.wallet.setPublicKey(publicKey);
        await app.wallet.setPrivateKey(pk);

        // Update options (ensure wallet object exists)
        if (!app.options) app.options = {};
        if (!app.options.wallet) app.options.wallet = {};
        app.options.wallet.publicKey = publicKey;
        app.options.wallet.privateKey = pk;
        app.options.wallet.inputs = [];
        app.options.wallet.outputs = [];
        app.options.wallet.spends = [];
        app.options.wallet.pending = [];

        // Reset blockchain state so the peer sends a fresh balance snapshot
        // during the next handshake (same as resetBlockchain does)
        var emptyHash = '0000000000000000000000000000000000000000000000000000000000000000';
        app.options.blockchain = {
          last_block_hash: emptyHash,
          last_block_id: 0,
          last_timestamp: 0,
          genesis_block_id: 0,
          genesis_timestamp: 0,
          lowest_acceptable_timestamp: 0,
          lowest_acceptable_block_hash: emptyHash,
          lowest_acceptable_block_id: 0,
          fork_id: emptyHash,
          confirmations: [],
        };

        // Clear keys/games/invites for the old identity
        app.options.keys = [];
        app.options.games = [];
        app.options.invites = [];
        app.options.groups = [];

        // Persist to localStorage so the key survives WebView reloads
        app.storage.saveOptions();

        // Clear localForage (IndexedDB) — removes cached balance snapshots
        // and other stale data from the previous wallet
        try {
          if (app.storage.clearLocalForage) {
            await app.storage.clearLocalForage();
          }
        } catch (e) {
          console.warn('[bridge] clearLocalForage failed:', e);
        }

        return { publicKey: publicKey, privateKey: pk };
      },
      resetWallet: async function (app) {
        // Clear all Saito state from WebView localStorage so the next
        // init cycle generates a fresh keypair.
        try { localStorage.removeItem('options'); } catch (e) {}
        // Also clear localForage (IndexedDB) — balance snapshots, cached blocks, etc.
        try {
          if (app.storage && app.storage.clearLocalForage) {
            await app.storage.clearLocalForage();
          }
        } catch (e) {
          console.warn('[bridge] clearLocalForage in resetWallet failed:', e);
        }
        return { success: true };
      },
      exportWallet: async function (app) {
        // Build export manually — the SDK's exportWallet() assumes
        // app.options.wallet exists, which may not be true on mobile.
        if (!app.options) app.options = {};
        if (!app.options.wallet) app.options.wallet = {};
        app.options.wallet.publicKey = await app.wallet.getPublicKey();
        app.options.wallet.privateKey = await app.wallet.getPrivateKey();
        app.options.wallet.ts = Date.now();

        var opts = JSON.parse(JSON.stringify(app.options));
        delete opts.games;
        return JSON.stringify(opts, null, 2);
      },
      importWalletJSON: async function (app, params) {
        // Import a wallet from a JSON string (same format as browser export)
        var jsonStr = params.json;
        if (!jsonStr) throw new Error('No wallet JSON provided');

        var wobj = JSON.parse(jsonStr);
        if (!wobj.wallet || !wobj.wallet.privateKey) {
          throw new Error('Invalid wallet file: missing wallet.privateKey');
        }

        var pk = wobj.wallet.privateKey;
        var publicKey = wobj.wallet.publicKey || app.crypto.generatePublicKey(pk);

        // Set keys in the WASM layer
        await app.wallet.setPublicKey(publicKey);
        await app.wallet.setPrivateKey(pk);

        // Merge the imported options (minus games) into app.options
        delete wobj.games;
        wobj.wallet.inputs = [];
        wobj.wallet.outputs = [];
        wobj.wallet.spends = [];
        wobj.wallet.pending = [];

        // Reset blockchain state so the peer sends a fresh balance snapshot
        var emptyHash = '0000000000000000000000000000000000000000000000000000000000000000';
        wobj.blockchain = {
          last_block_hash: emptyHash,
          last_block_id: 0,
          last_timestamp: 0,
          genesis_block_id: 0,
          genesis_timestamp: 0,
          lowest_acceptable_timestamp: 0,
          lowest_acceptable_block_hash: emptyHash,
          lowest_acceptable_block_id: 0,
          fork_id: emptyHash,
          confirmations: [],
        };

        // Clear identity-specific data
        wobj.keys = [];
        wobj.invites = [];
        wobj.groups = [];

        app.options = wobj;

        // Persist to localStorage
        app.storage.saveOptions();

        // Clear localForage (IndexedDB) — removes cached balance snapshots
        // and other stale data from the previous wallet
        try {
          if (app.storage.clearLocalForage) {
            await app.storage.clearLocalForage();
          }
        } catch (e) {
          console.warn('[bridge] clearLocalForage failed:', e);
        }

        return { publicKey: publicKey, privateKey: pk };
      },
    },

    chat: {
      getGroups: async function (app) {
        var chatMod = app.modules.returnModule('Chat');
        if (!chatMod) throw new Error('Chat module not loaded');
        var groups = chatMod.chat_manager?.groups || chatMod.groups || [];
        return groups.map(serializeGroup);
      },
      getMessages: async function (app, params) {
        var chatMod = app.modules.returnModule('Chat');
        if (!chatMod) throw new Error('Chat module not loaded');
        var groups = chatMod.chat_manager?.groups || chatMod.groups || [];
        var group = groups.find(function (g) { return g.id === params.groupId; });
        if (!group) return [];
        return (group.txs || []).map(serializeMessage);
      },
      sendMessage: async function (app, params) {
        var chatMod = app.modules.returnModule('Chat');
        if (!chatMod) throw new Error('Chat module not loaded');
        var tx = await chatMod.createChatTransaction(params.groupId, params.message);
        if (tx) {
          console.log('[bridge] Message sent, sig:', tx.signature || tx.sig, 'propagated to network');
          // Process locally via receiveChatTransaction (same as desktop).
          // This runs addTransactionToGroup which normalizes the tx into
          // a plain-object format that survives serialization, and emits
          // 'chat-popup-render-request' which triggers our group-updated event.
          await chatMod.receiveChatTransaction(tx);
        }
        return { success: true };
      },
      createGroup: async function (app, params) {
        var chatMod = app.modules.returnModule('Chat');
        if (!chatMod) throw new Error('Chat module not loaded');
        var group = chatMod.returnOrCreateChatGroupFromMembers(
          params.members,
          params.name || null
        );
        return group?.id || '';
      },
      getOlderMessages: async function (app, params) {
        // For now, return from the in-memory txs that are older than the timestamp
        var chatMod = app.modules.returnModule('Chat');
        if (!chatMod) throw new Error('Chat module not loaded');
        var groups = chatMod.chat_manager?.groups || chatMod.groups || [];
        var group = groups.find(function (g) { return g.id === params.groupId; });
        if (!group) return [];
        return (group.txs || [])
          .filter(function (tx) {
            var ts = (tx.msg || tx).timestamp || tx.timestamp || 0;
            return ts < params.beforeTimestamp;
          })
          .map(serializeMessage);
      },
      markRead: async function (app, params) {
        var chatMod = app.modules.returnModule('Chat');
        if (!chatMod) throw new Error('Chat module not loaded');
        var groups = chatMod.chat_manager?.groups || chatMod.groups || [];
        var group = groups.find(function (g) { return g.id === params.groupId; });
        if (group) group.unread = 0;
        return { success: true };
      },
    },
  };

  // ── RPC dispatcher ───────────────────────────────────────────────────

  window.__SAITO_BRIDGE__ = {
    handleCommand: function (cmd) {
      waitForApp(async function (app) {
        try {
          var moduleHandlers = handlers[cmd.module];
          if (!moduleHandlers || !moduleHandlers[cmd.method]) {
            respondError(cmd.id, 'Unknown command: ' + cmd.module + '.' + cmd.method);
            return;
          }
          var result = await moduleHandlers[cmd.method](app, cmd.params || {});
          respond(cmd.id, result);
        } catch (e) {
          console.error('[bridge-host] command error', cmd.module, cmd.method, e);
          respondError(cmd.id, e.message || String(e));
        }
      });
    },
  };

  // ── Event forwarding ─────────────────────────────────────────────────

  // Track connected peer count (workaround for getPeers not working in SPV mode)
  var connectedPeerCount = 0;

  waitForApp(function (app) {
    console.log('[bridge] Saito app ready, registering event listeners');

    // Wallet events
    app.connection.on('wallet-updated', async function () {
      var bal = await app.wallet.getBalance();
      emitEvent('wallet', 'balance-updated', { balance: bal.toString() });
    });

    // Peer events
    app.connection.on('peer_connect', async function (peerIndex) {
      console.log('[bridge] peer_connect event fired, peerIndex:', peerIndex?.toString());
      connectedPeerCount++;
      var peers = [];
      try { peers = await app.network.getPeers(); } catch (e) {}
      console.log('[bridge] After peer_connect, getPeers returns:', peers.length, 'tracked count:', connectedPeerCount);
      // Use tracked count as fallback if getPeers doesn't work
      emitEvent('core', 'peer-connected', { count: peers.length || connectedPeerCount });
    });

    app.connection.on('peer_disconnect', async function (peerIndex) {
      console.log('[bridge] peer_disconnect event fired, peerIndex:', peerIndex?.toString());
      if (connectedPeerCount > 0) connectedPeerCount--;
      var peers = [];
      try { peers = await app.network.getPeers(); } catch (e) {}
      emitEvent('core', 'peer-connected', { count: peers.length || connectedPeerCount });
    });

    app.connection.on('handshake_complete', async function (peerIndex) {
      console.log('[bridge] handshake_complete event fired, peerIndex:', peerIndex?.toString());
      var peers = [];
      try { peers = await app.network.getPeers(); } catch (e) {}
      console.log('[bridge] After handshake_complete, getPeers returns:', peers.length);
      emitEvent('core', 'peer-connected', { count: peers.length || connectedPeerCount });
    });

    // Block events
    app.connection.on('add-block-success', function (data) {
      emitEvent('core', 'block-added', {
        hash: data.hash || '',
        blockId: data.blockId?.toString() || '0',
      });
    });

    // Chat events
    app.connection.on('chat-popup-render-request', function (group) {
      if (group) {
        emitEvent('chat', 'group-updated', serializeGroup(group));
      }
    });

    app.connection.on('chat-manager-render-request', function () {
      var chatMod = app.modules.returnModule('Chat');
      if (chatMod) {
        var groups = chatMod.chat_manager?.groups || chatMod.groups || [];
        groups.forEach(function (g) {
          emitEvent('chat', 'group-updated', serializeGroup(g));
        });
      }
    });

    app.connection.on('chat-message-new', function (data) {
      if (data) {
        emitEvent('chat', 'new-message', {
          groupId: data.group_id || data.groupId || '',
          message: serializeMessage(data),
        });
      }
    });

    // Version mismatch detection (from WASM handshake)
    app.connection.on('new-version-detected', function (data) {
      console.log('[bridge] new-version-detected event fired:', JSON.stringify(data));
      emitEvent('core', 'version-mismatch', {
        requiredVersion: data.version || 'unknown',
        peerIndex: data.peerIndex ? data.peerIndex.toString() : '0',
        source: 'handshake',
      });
    });

    // Pre-connect version check via HTTP — gives early warning before handshake
    (function preConnectVersionCheck() {
      try {
        var opts = JSON.parse(localStorage.getItem('options')) || {};
        var peers = opts.peers || [];
        if (peers.length === 0) return;

        var peer = peers[0];
        var protocol = peer.protocol || 'http';
        var host = peer.host || 'localhost';
        var port = peer.port || 12101;
        var versionUrl = protocol + '://' + host + ':' + port + '/version';

        console.log('[bridge] Pre-connect version check:', versionUrl);
        fetch(versionUrl, { method: 'GET' })
          .then(function (res) { return res.json(); })
          .then(function (nodeVersion) {
            console.log('[bridge] Node version info:', JSON.stringify(nodeVersion));
            emitEvent('core', 'node-version', {
              saito_js: nodeVersion.saito_js || 'unknown',
              build_number: nodeVersion.build_number || 0,
              wallet_version: nodeVersion.wallet_version || 0,
            });
          })
          .catch(function (err) {
            console.warn('[bridge] Pre-connect version check failed (node may not support /version):', err.message || err);
          });
      } catch (e) {
        console.warn('[bridge] Pre-connect version check error:', e);
      }
    })();

    // Signal ready
    postToRN({ type: 'ready' });

    // Periodic peer check for debugging
    var peerCheckCount = 0;
    var peerCheckInterval = setInterval(async function() {
      peerCheckCount++;
      var peers = [];
      try { peers = await app.network.getPeers(); } catch (e) {}
      console.log('[bridge] Periodic peer check #' + peerCheckCount + ':', peers.length, 'peers');
      if (peerCheckCount >= 10) {
        clearInterval(peerCheckInterval);
        console.log('[bridge] Stopped periodic peer checks');
      }
    }, 5000);
  });
})();
