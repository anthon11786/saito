import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { WasmBridge } from '../bridge/WasmBridge';
import * as SecureKeyStore from '../services/SecureKeyStore';
import type { ConnectionStatus } from '../types';

// Self-contained HTML with saito-mobile-bundle.js and wasm-bridge-host.js
// inlined. Built by: node scripts/build-bridge.js
const WEBVIEW_HTML = require('../bridge/bridge-bundle.html');

export type SaitoContextValue = {
  bridge: WasmBridge | null;
  status: ConnectionStatus;
  error: string | null;
  /** Clear WebView localStorage + reload so WASM generates a fresh keypair. */
  resetAndReload: () => Promise<void>;
  /** Reload WebView (preserves localStorage) so WASM re-inits with current keys. */
  reloadWebView: () => void;
};

export const SaitoContext = createContext<SaitoContextValue>({
  bridge: null,
  status: 'loading',
  error: null,
  resetAndReload: async () => { },
  reloadWebView: () => { },
});

type Props = {
  children: React.ReactNode;
};

// Forward WebView console output and uncaught errors to React Native.
const INJECTED_DEBUG_JS = `
(function() {
  var origLog = console.log;
  var origErr = console.error;
  var origWarn = console.warn;
  function fwd(level, args) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: '__debug__', level: level, msg: Array.prototype.slice.call(args).map(String).join(' ')
      }));
    } catch(e) {}
  }
  console.log = function() { fwd('log', arguments); origLog.apply(console, arguments); };
  console.error = function() { fwd('error', arguments); origErr.apply(console, arguments); };
  console.warn = function() { fwd('warn', arguments); origWarn.apply(console, arguments); };
  window.onerror = function(msg, src, line, col, err) {
    fwd('error', ['UNCAUGHT: ' + msg + ' at ' + (src||'?') + ':' + line + ':' + col]);
  };
  window.addEventListener('unhandledrejection', function(e) {
    fwd('error', ['UNHANDLED PROMISE: ' + (e.reason && e.reason.message || e.reason || 'unknown')]);
  });
})(); true;
`;

export function SaitoProvider({ children }: Props) {
  const webviewRef = useRef<WebView>(null);
  const [bridge] = useState(() => new WasmBridge(webviewRef));
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [keyInjectionScript, setKeyInjectionScript] = useState<string>('');

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === '__debug__') {
          console.log(`[WebView:${data.level}]`, data.msg);
          return;
        }
      } catch { }
      bridge.handleMessage(event.nativeEvent.data);
    },
    [bridge],
  );

  // Prepare key injection script BEFORE WebView loads
  useEffect(() => {
    let cancelled = false;

    async function prepareKeyInjection() {
      try {
        const storedKey = await SecureKeyStore.getPrivateKey();

        if (storedKey && !cancelled) {
          // This script runs BEFORE the HTML content loads
          const script = `
            (function() {
              try {
                var opts = JSON.parse(localStorage.getItem('options')) || {};
                opts.wallet = opts.wallet || {};
                opts.wallet.privateKey = '${storedKey.replace(/'/g, "\\'")}';
                localStorage.setItem('options', JSON.stringify(opts));
                console.log('[key-injection] Private key injected before init');
              } catch(e) {
                console.error('[key-injection] Failed:', e);
              }
            })();
            true; // Required for injectedJavaScriptBeforeContentLoaded
          `;
          setKeyInjectionScript(script);
        } else if (!cancelled) {
          setKeyInjectionScript('true;');
        }
      } catch (e) {
        console.error('[SaitoProvider] prepareKeyInjection error:', e);
        if (!cancelled) {
          setKeyInjectionScript('true;');
        }
      }
    }

    prepareKeyInjection();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!keyInjectionScript) return;

    let cancelled = false;

    async function initialize() {
      try {
        await bridge.waitForReady();
        if (cancelled) return;
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      }
    }

    initialize();
    return () => {
      cancelled = true;
      bridge.destroy();
    };
  }, [bridge, keyInjectionScript]);

  const reloadWebView = useCallback(() => {
    // Reset bridge state so it can await a new ready signal, then reload.
    // localStorage is preserved so the imported key is picked up on re-init.
    bridge.reset();
    setStatus('loading');
    setError(null);
    setTimeout(() => {
      webviewRef.current?.reload();
    }, 100);
    // Re-await the bridge ready signal so status goes back to 'ready'
    // and hooks like useChat re-subscribe their event listeners.
    bridge.waitForReady().then(() => {
      setStatus('ready');
    });
  }, [bridge]);

  const resetAndReload = useCallback(async () => {
    // 1. Tell the bridge to clear localStorage (wallet key + chat state)
    try {
      await bridge.call('wallet', 'resetWallet');
    } catch (e) {
      console.warn('[SaitoProvider] resetWallet bridge call failed (ok if WebView unloaded):', e);
    }
    // 2. Also clear via injected JS in case bridge is unresponsive
    webviewRef.current?.injectJavaScript('try { localStorage.clear(); } catch(e) {} true;');
    // 3. Reset bridge state so it can await a new ready signal
    bridge.reset();
    // 4. Clear the key injection script so WebView re-inits without a stored key
    setKeyInjectionScript('true;');
    setStatus('loading');
    setError(null);
    // 5. Reload the WebView — WASM will generate a fresh keypair
    setTimeout(() => {
      webviewRef.current?.reload();
    }, 100);
    // 6. Re-await the bridge ready signal so status goes back to 'ready'
    bridge.waitForReady().then(() => {
      setStatus('ready');
    });
  }, [bridge]);

  if (!keyInjectionScript) {
    // Wait for key injection script to be prepared
    return null;
  }

  // Combine key injection + debug logging
  const combinedInjectedScript = keyInjectionScript + '\n' + INJECTED_DEBUG_JS;

  return (
    <SaitoContext.Provider value={{ bridge, status, error, resetAndReload, reloadWebView }}>
      <View style={styles.webviewContainer}>
        <WebView
          ref={webviewRef}
          source={WEBVIEW_HTML}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          onError={(e) => {
            console.warn('[WebView] error:', e.nativeEvent.description);
            setError(e.nativeEvent.description);
            setStatus('error');
          }}
          onHttpError={(e) => {
            console.warn('[WebView] HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url);
          }}
          injectedJavaScriptBeforeContentLoaded={combinedInjectedScript}
          onLoad={() => console.log('[WebView] loaded')}
          onLoadEnd={() => console.log('[WebView] loadEnd')}
        />
      </View>
      {children}
    </SaitoContext.Provider>
  );
}

const styles = StyleSheet.create({
  webviewContainer: {
    position: 'absolute',
    height: 1,
    width: 1,
    opacity: 0,
  },
});
