import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as Clipboard from 'expo-clipboard';
import { useSaito } from '../hooks/useSaito';
import { useWallet } from '../hooks/useWallet';
import * as SecureKeyStore from '../services/SecureKeyStore';
import { isBiometricAvailable, getBiometryType } from '../services/BiometricAuth';

export function SettingsScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { bridge, status, resetAndReload, reloadWebView } = useSaito();
  const { publicKey } = useWallet();
  const [peerCount, setPeerCount] = useState(0);
  const [blockInfo, setBlockInfo] = useState({ blockId: '0', blockHash: '' });
  const [biometryType, setBiometryType] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const loadNetworkInfo = useCallback(async () => {
    if (!bridge || status !== 'ready') return;
    setRefreshing(true);
    try {
      const [peers, blockchain] = await Promise.all([
        bridge.call<any[]>('core', 'getPeers'),
        bridge.call<any>('core', 'getBlockchainInfo'),
      ]);
      setPeerCount(peers.length);
      setBlockInfo(blockchain);
      console.log('[SettingsScreen] Network info:', { peers: peers.length, blockchain });
    } catch (e) {
      console.error('[SettingsScreen] load error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [bridge, status]);

  useEffect(() => {
    async function load() {
      const type = await getBiometryType();
      setBiometryType(type);
    }
    load();
    loadNetworkInfo();

    if (!bridge || status !== 'ready') return;
    const unsub = bridge.on('core', 'peer-connected', (data) => {
      setPeerCount(data.count);
      loadNetworkInfo();
    });
    return unsub;
  }, [bridge, status, loadNetworkInfo]);

  const handleBackup = () => {
    navigation.navigate('Backup');
  };

  const handleCopyPublicKey = async () => {
    if (!publicKey) return;
    await Clipboard.setStringAsync(publicKey);
    Alert.alert('Copied', 'Public key copied to clipboard.');
  };

  const handleReconnect = useCallback(() => {
    setReconnecting(true);
    reloadWebView();
    // The WebView will reload and the bridge will re-emit 'ready'.
    // Give it a moment then refresh network info.
    setTimeout(() => {
      setReconnecting(false);
      loadNetworkInfo();
    }, 5000);
  }, [reloadWebView, loadNetworkInfo]);

  const handleResetWallet = () => {
    Alert.alert(
      'Reset Wallet',
      'This will delete your wallet and all chat history from this device. Make sure you have your recovery phrase saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            // 1. Clear WebView localStorage + reload WASM (generates fresh keypair)
            await resetAndReload();
            // 2. Delete the old key from native secure storage
            await SecureKeyStore.deletePrivateKey();
            // 3. Navigate to onboarding so user can save the new recovery phrase
            navigation.reset({
              index: 0,
              routes: [{ name: 'Onboarding' }],
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Network</Text>
      <View style={styles.card}>
        <Row label="Status" value={status === 'ready' ? 'Connected' : 'Disconnected'} />
        <Row label="Peers" value={String(peerCount)} />
        <Row label="Block Height" value={blockInfo.blockId} />
        <TouchableOpacity style={styles.row} onPress={loadNetworkInfo} disabled={refreshing}>
          <Text style={styles.rowLabel}>Refresh Network Info</Text>
          <Text style={styles.rowChevron}>{refreshing ? '...' : '↻'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={handleReconnect} disabled={reconnecting}>
          <Text style={styles.rowLabel}>Reconnect to Network</Text>
          <Text style={styles.rowChevron}>{reconnecting ? '...' : '⟳'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PeerSettings')}>
          <Text style={styles.rowLabel}>Peer Connection</Text>
          <Text style={styles.rowChevron}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.card}>
        <Row label="Biometrics" value={biometryType || 'Not available'} />
        <TouchableOpacity style={styles.row} onPress={handleBackup}>
          <Text style={styles.rowLabel}>Backup Wallet</Text>
          <Text style={styles.rowChevron}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={handleCopyPublicKey}>
          <Text style={styles.rowLabel}>Public Key</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {publicKey ? `${publicKey.slice(0, 16)}...` : '—'}
          </Text>
        </TouchableOpacity>
        <Row label="Version" value="1.0.0" />
      </View>

      <TouchableOpacity style={styles.dangerBtn} onPress={handleResetWallet}>
        <Text style={styles.dangerText}>Reset Wallet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    gap: 8,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  rowLabel: {
    color: '#e2e8f0',
    fontSize: 15,
  },
  rowValue: {
    color: '#64748b',
    fontSize: 14,
  },
  rowChevron: {
    color: '#475569',
    fontSize: 16,
  },
  dangerBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  dangerText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
