import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SaitoMobileClient } from './src/saito-client';

type Status = 'disconnected' | 'connecting' | 'connected';

export default function App() {
  const [status, setStatus] = useState<Status>('disconnected');
  const [peerCount, setPeerCount] = useState(0);
  const [publicKey, setPublicKey] = useState<string>('');
  const [note, setNote] = useState('Hello from React Native!');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [client, setClient] = useState<SaitoMobileClient | null>(null);

  const appendLog = useCallback((message: string) => {
    setLogLines((prev) => [message, ...prev].slice(0, 12));
  }, []);

  const connect = useCallback(async () => {
    if (status === 'connecting') return;
    setStatus('connecting');
    appendLog('Connecting to the Saito network...');
    try {
      const newClient = await SaitoMobileClient.create({
        callbacks: {
          onWalletUpdate: () => appendLog('Wallet updated'),
          onBlockAdded: (hash, blockId) => appendLog(`New block ${blockId.toString()} (${hash})`),
          onNewVersion: (version) => appendLog(`New version detected: ${version}`)
        }
      });
      setClient(newClient);
      const pk = await newClient.getPublicKey();
      setPublicKey(pk);
      appendLog(`Wallet ready: ${pk.slice(0, 12)}...`);
      setStatus('connected');
      await refreshPeers(newClient);
    } catch (error) {
      console.error(error);
      appendLog('Connection failed; see console for details.');
      setStatus('disconnected');
    }
  }, [appendLog, status]);

  const refreshPeers = useCallback(
    async (activeClient = client) => {
      if (!activeClient) return;
      try {
        const stats = await activeClient.refreshPeerStats();
        setPeerCount(stats.count);
        appendLog(`Found ${stats.count} connected peers`);
      } catch (error) {
        console.error(error);
        appendLog('Failed to refresh peers');
      }
    },
    [appendLog, client]
  );

  const sendNote = useCallback(async () => {
    if (!client) return;
    try {
      await client.sendNote(note);
      appendLog(`Sent note: "${note}"`);
    } catch (error) {
      console.error(error);
      appendLog('Failed to send note; check console');
    }
  }, [appendLog, client, note]);

  const connectionLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      default:
        return 'Disconnected';
    }
  }, [status]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Saito React Native Demo</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <Text style={styles.caption}>Status: {connectionLabel}</Text>
          {publicKey ? <Text style={styles.caption}>Public key: {publicKey}</Text> : null}
          <View style={styles.actionsRow}>
            <Button title="Connect" onPress={connect} disabled={status === 'connecting'} />
            <Button title="Refresh peers" onPress={() => refreshPeers()} disabled={!client} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Peers</Text>
          <Text style={styles.caption}>Connected peers: {peerCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Send a note</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Enter a short message"
          />
          <Button title="Send note" onPress={sendNote} disabled={!client} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {logLines.length === 0 ? (
            <Text style={styles.caption}>No activity yet.</Text>
          ) : (
            logLines.map((line, idx) => (
              <Text key={`${line}-${idx}`} style={styles.caption}>
                • {line}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  container: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 6
  },
  card: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc'
  },
  caption: {
    color: '#cbd5e1',
    fontSize: 14
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  input: {
    backgroundColor: '#0b1224',
    color: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937'
  }
});
