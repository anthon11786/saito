import 'react-native-get-random-values';

// React Native does not ship with Buffer by default. Polyfill it immediately so downstream imports can rely on it.
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { initialize as initSaito } from 'saito-js/index.web';
import Factory from 'saito-js/lib/factory';
import Saito, { LogLevel } from 'saito-js/saito';

import ReactNativeSharedMethods from './ReactNativeSharedMethods';
import { DEMO_REQUEST, DEFAULT_SAITO_CONFIG, STORAGE_KEYS } from './saitoConfig';

const emitter = new EventEmitter();
const sharedMethods = new ReactNativeSharedMethods(emitter);

type HandshakePayload = { peerIndex: string; publicKey: string };
type BlockPayload = { hash: string; blockId: string };
type PeerRequestPayload = { peerIndex: string; payload: string };

const factory = new Factory();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0c1117'
  },
  section: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#111826'
  },
  heading: {
    color: '#f3f4f6',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  text: {
    color: '#d1d5db',
    marginBottom: 6
  },
  monospace: {
    fontFamily: 'monospace',
    color: '#e5e7eb'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    color: '#f9fafb'
  },
  logBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220'
  }
});

async function loadCachedKeys() {
  const [privateKey, publicKey] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.PRIVATE_KEY),
    AsyncStorage.getItem(STORAGE_KEYS.PUBLIC_KEY)
  ]);
  return {
    privateKey: privateKey || '',
    publicKey: publicKey || ''
  };
}

function formatKey(key: string) {
  if (!key) return 'not set';
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

function App(): JSX.Element {
  const [isReady, setIsReady] = useState(false);
  const [handshakes, setHandshakes] = useState<HandshakePayload[]>([]);
  const [peerCount, setPeerCount] = useState(0);
  const [balance, setBalance] = useState('0');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PeerRequestPayload | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [targetPeer, setTargetPeer] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('Booting Saito JS (React Native)...');
  const [blockEvents, setBlockEvents] = useState<BlockPayload[]>([]);

  const hasStarted = useRef(false);

  const attachEventHandlers = useCallback(() => {
    const removeFns: Array<() => void> = [];

    const onHandshake = (payload: HandshakePayload) => {
      setHandshakes((prev) => [payload, ...prev].slice(0, 5));
      refreshPeers();
    };
    emitter.on('handshake_complete', onHandshake);
    removeFns.push(() => emitter.off('handshake_complete', onHandshake));

    const onWalletUpdated = async () => {
      const wallet = await Saito.getInstance().getWallet();
      const [pk, pub, bal] = await Promise.all([
        wallet.getPrivateKey(),
        wallet.getPublicKey(),
        wallet.getBalance()
      ]);
      setPrivateKey(pk);
      setPublicKey(pub);
      setBalance(bal.toString());
      await sharedMethods.persistKeys(pk, pub);
    };
    emitter.on('wallet-updated', onWalletUpdated);
    removeFns.push(() => emitter.off('wallet-updated', onWalletUpdated));

    const onBlock = (payload: BlockPayload) => {
      setBlockEvents((prev) => [payload, ...prev].slice(0, 5));
    };
    emitter.on('add-block-success', onBlock);
    removeFns.push(() => emitter.off('add-block-success', onBlock));

    const onRequest = (payload: PeerRequestPayload) => {
      setLastRequest(payload);
    };
    emitter.on('peer-request', onRequest);
    removeFns.push(() => emitter.off('peer-request', onRequest));

    return () => removeFns.forEach((fn) => fn());
  }, []);

  const refreshPeers = useCallback(async () => {
    const peers = await Saito.getInstance().getPeers();
    setPeerCount(peers.length);
    if (!targetPeer && peers.length) {
      setTargetPeer(peers[0].peerIndex.toString());
    }
  }, [targetPeer]);

  const bootstrap = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setStatus('Loading persisted keys...');

    const cachedKeys = await loadCachedKeys();
    const privateKey = cachedKeys.privateKey;

    setStatus('Initializing wasm + network...');
    await initSaito(
      DEFAULT_SAITO_CONFIG,
      sharedMethods,
      factory,
      privateKey,
      LogLevel.Info,
      BigInt(1),
      true
    );

    const wallet = await Saito.getInstance().getWallet();
    if (privateKey) {
      await wallet.setPrivateKey(privateKey);
    } else {
      const generated = Saito.getInstance().generatePrivateKey();
      await wallet.setPrivateKey(generated);
      const pub = Saito.getInstance().generatePublicKey(generated);
      await wallet.setPublicKey(pub);
      await sharedMethods.persistKeys(generated, pub);
      setPrivateKey(generated);
      setPublicKey(pub);
    }

    const [pubKey, bal] = await Promise.all([wallet.getPublicKey(), wallet.getBalance()]);
    setPublicKey(pubKey);
    setBalance(bal.toString());

    Saito.getInstance().start();
    setStatus('Waiting for peer handshake...');
    setIsReady(true);
    refreshPeers();
  }, [refreshPeers]);

  useEffect(() => {
    const detach = attachEventHandlers();
    bootstrap();
    return detach;
  }, [attachEventHandlers, bootstrap]);

  const sendTestTransaction = useCallback(async () => {
    try {
      setSending(true);
      setLastResponse(null);
      const peers = await Saito.getInstance().getPeers();
      const peerIndexValue =
        targetPeer.trim() || (peers.length ? peers[0].peerIndex.toString() : BigInt(0).toString());
      const peerIndex = BigInt(peerIndexValue);

      const wallet = await Saito.getInstance().getWallet();
      const myPublicKey = await wallet.getPublicKey();
      const tx = await Saito.getInstance().createTransaction(myPublicKey, BigInt(0), BigInt(0));
      tx.msg = {
        request: DEMO_REQUEST,
        data: {
          note: 'React Native demo transaction',
          timestamp: Date.now(),
          sender: myPublicKey
        }
      };
      await tx.sign();
      await Saito.getInstance().sendTransactionWithCallback(
        tx,
        (response) => {
          setLastResponse(JSON.stringify(response, null, 2));
          return response;
        },
        peerIndex
      );
    } catch (error) {
      setLastResponse(error?.toString?.() || 'Failed to send transaction');
    } finally {
      setSending(false);
    }
  }, [targetPeer]);

  const regenerateKeys = useCallback(async () => {
    const wallet = await Saito.getInstance().getWallet();
    const newPrivateKey = Saito.getInstance().generatePrivateKey();
    const newPublicKey = Saito.getInstance().generatePublicKey(newPrivateKey);
    await wallet.setPrivateKey(newPrivateKey);
    await wallet.setPublicKey(newPublicKey);
    await sharedMethods.persistKeys(newPrivateKey, newPublicKey);
    setPrivateKey(newPrivateKey);
    setPublicKey(newPublicKey);
  }, []);

  const connectionCard = useMemo(
    () => (
      <View style={styles.section}>
        <Text style={styles.heading}>1) Network Handshake</Text>
        <Text style={styles.text}>Status: {status}</Text>
        <Text style={styles.text}>Peer count: {peerCount}</Text>
        <Text style={styles.text}>Last peer: {handshakes[0]?.peerIndex || 'waiting...'}</Text>
        <View style={styles.logBox}>
          <Text style={styles.text}>Handshake log (newest first)</Text>
          {handshakes.map((item) => (
            <Text key={item.peerIndex + item.publicKey} style={styles.monospace}>
              peer {item.peerIndex} :: {formatKey(item.publicKey)}
            </Text>
          ))}
        </View>
      </View>
    ),
    [handshakes, peerCount, status]
  );

  const walletCard = useMemo(
    () => (
      <View style={styles.section}>
        <Text style={styles.heading}>2) Key + Wallet</Text>
        <Text style={styles.text}>Public key: {formatKey(publicKey)}</Text>
        <Text style={styles.text}>Private key: {formatKey(privateKey)}</Text>
        <Text style={styles.text}>Balance: {balance}</Text>
        <Text style={styles.text}>Stored in AsyncStorage keys prefixed with @saito/react-native/</Text>
        <View style={styles.buttonRow}>
          <Button title="Regenerate key" onPress={regenerateKeys} />
          <Button title="Refresh peers" onPress={refreshPeers} />
        </View>
      </View>
    ),
    [balance, privateKey, publicKey, regenerateKeys, refreshPeers]
  );

  const txCard = useMemo(
    () => (
      <View style={styles.section}>
        <Text style={styles.heading}>3) Request + Response</Text>
        <Text style={styles.text}>Send a signed demo transaction to the selected peer.</Text>
        <TextInput
          value={targetPeer}
          onChangeText={setTargetPeer}
          style={styles.input}
          placeholder="Peer index (defaults to first connected peer)"
          placeholderTextColor="#6b7280"
        />
        <View style={styles.buttonRow}>
          <Button title="Send demo tx" onPress={sendTestTransaction} disabled={sending || !isReady} />
        </View>
        {sending && <Text style={styles.text}>Sending...</Text>}
        {lastResponse && (
          <View style={styles.logBox}>
            <Text style={styles.text}>Peer response</Text>
            <Text style={styles.monospace}>{lastResponse}</Text>
          </View>
        )}
        {lastRequest && (
          <View style={styles.logBox}>
            <Text style={styles.text}>Latest inbound request</Text>
            <Text style={styles.monospace}>
              peer {lastRequest.peerIndex}: {lastRequest.payload}
            </Text>
          </View>
        )}
      </View>
    ),
    [isReady, lastRequest, lastResponse, sendTestTransaction, sending, targetPeer]
  );

  const eventsCard = useMemo(
    () => (
      <View style={styles.section}>
        <Text style={styles.heading}>4) Blockchain + Wallet Events</Text>
        <View style={styles.logBox}>
          <Text style={styles.text}>Block success events</Text>
          {blockEvents.length === 0 && <Text style={styles.text}>Waiting for blocks...</Text>}
          {blockEvents.map((b) => (
            <Text key={b.hash} style={styles.monospace}>
              #{b.blockId} :: {formatKey(b.hash)}
            </Text>
          ))}
        </View>
      </View>
    ),
    [blockEvents]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {connectionCard}
        {walletCard}
        {txCard}
        {eventsCard}
      </ScrollView>
    </SafeAreaView>
  );
}

export default App;
