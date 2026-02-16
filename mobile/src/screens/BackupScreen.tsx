import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MnemonicGrid } from '../components/MnemonicGrid';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { authenticateWithBiometric } from '../services/BiometricAuth';
import { useSaito } from '../hooks/useSaito';
import { generateMnemonicFromKey } from '../services/MnemonicService';

type BackupMethod = 'phrase' | 'file';

const METHODS: { id: BackupMethod; label: string }[] = [
  { id: 'phrase', label: 'Recovery Phrase' },
  { id: 'file', label: 'Wallet File' },
];

export function BackupScreen() {
  const { bridge } = useSaito();
  const [method, setMethod] = useState<BackupMethod>('phrase');
  const [words, setWords] = useState<string[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function authenticate() {
      const ok = await authenticateWithBiometric('Authenticate to view backup');
      if (!ok) {
        Alert.alert(
          'Authentication Required',
          'You must authenticate to view your backup.',
        );
        setLoading(false);
        return;
      }
      setAuthenticated(true);

      try {
        if (!bridge) throw new Error('Bridge not ready');
        const pk = await bridge.call<string>('wallet', 'getPrivateKey');
        const mnemonic = generateMnemonicFromKey(pk);
        setWords(mnemonic.split(' '));
      } catch (e) {
        Alert.alert('Error', 'Could not retrieve private key');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    authenticate();
  }, [bridge]);

  // ── Export wallet JSON ──────────────────────────────────────────────

  const handleExportWallet = async () => {
    if (!bridge) {
      Alert.alert('Error', 'Bridge not ready');
      return;
    }

    setExporting(true);
    try {
      const walletJson = await bridge.call<string>('wallet', 'exportWallet');
      const publicKey = await bridge.call<string>('wallet', 'getPublicKey');
      const fileName = `saito-wallet-${publicKey.slice(0, 8)}.json`;

      const file = new File(Paths.cache, fileName);
      file.write(walletJson);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save Wallet Backup',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Exported', 'Wallet file saved to:\n' + file.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to export wallet');
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} message="Authenticating..." />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Backup Wallet</Text>

        {authenticated && (
          <>
            {/* ── Method selector ── */}
            <View style={styles.segmented}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.segmentBtn, method === m.id && styles.segmentActive]}
                  onPress={() => setMethod(m.id)}
                >
                  <Text
                    style={[styles.segmentText, method === m.id && styles.segmentTextActive]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Recovery Phrase ── */}
            {method === 'phrase' && (
              <>
                <Text style={styles.subtitle}>
                  Write these words down and store them securely. They are the only
                  way to recover your wallet.
                </Text>
                {words.length > 0 && <MnemonicGrid words={words} />}
                <Text style={styles.warning}>Do not screenshot. Do not share.</Text>
              </>
            )}

            {/* ── Wallet File Export ── */}
            {method === 'file' && (
              <>
                <Text style={styles.subtitle}>
                  Export your wallet as a JSON file. You can later import this file
                  in any Saito browser or mobile app to restore your account.
                </Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    The exported file contains your private key and wallet settings.
                    Keep it safe — anyone with this file can access your wallet.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.btn, exporting && styles.btnDisabled]}
                  onPress={handleExportWallet}
                  disabled={exporting}
                >
                  <Text style={styles.btnText}>
                    {exporting ? 'Exporting...' : 'Export Wallet File'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {!authenticated && !loading && (
          <Text style={styles.subtitle}>
            Authentication is required to view your backup.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
  },
  warning: {
    fontSize: 13,
    color: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center',
    fontWeight: '600',
  },

  // ── Segmented control ──
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#334155',
  },
  segmentText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#f8fafc',
  },

  // ── Info box ──
  infoBox: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  infoText: {
    color: '#f59e0b',
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Button ──
  btn: {
    backgroundColor: '#e11d48',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
