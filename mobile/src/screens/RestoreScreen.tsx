import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useSaito } from '../hooks/useSaito';
import * as SecureKeyStore from '../services/SecureKeyStore';
import {
  getPrivateKeyFromMnemonic,
  isValidMnemonic,
} from '../services/MnemonicService';

type Props = {
  navigation: StackNavigationProp<any>;
};

type RestoreMethod = 'phrase' | 'key' | 'file';

const METHODS: { id: RestoreMethod; label: string }[] = [
  { id: 'phrase', label: 'Seed Phrase' },
  { id: 'key', label: 'Private Key' },
  { id: 'file', label: 'Wallet File' },
];

export function RestoreScreen({ navigation }: Props) {
  const { bridge, reloadWebView } = useSaito();
  const [method, setMethod] = useState<RestoreMethod>('phrase');
  const [words, setWords] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Seed-phrase restore (existing) ──────────────────────────────────

  const handleRestorePhrase = async () => {
    const trimmed = words.trim().toLowerCase();
    if (!isValidMnemonic(trimmed)) {
      Alert.alert('Invalid Mnemonic', 'Please enter a valid 24-word recovery phrase.');
      return;
    }
    setLoading(true);
    try {
      const privateKey = getPrivateKeyFromMnemonic(trimmed);
      if (!bridge) throw new Error('Bridge not ready');
      await bridge.call('wallet', 'setPrivateKey', { privateKey });
      await SecureKeyStore.setPrivateKey(privateKey);
      reloadWebView();
      navigateToApp();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to restore wallet');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Private-key restore ─────────────────────────────────────────────

  const handleRestoreKey = async () => {
    const trimmed = privateKeyInput.trim();
    if (!trimmed || trimmed.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      Alert.alert('Invalid Key', 'Please enter a valid 64-character hex private key.');
      return;
    }
    setLoading(true);
    try {
      if (!bridge) throw new Error('Bridge not ready');
      const result = await bridge.call<{ publicKey: string }>('wallet', 'setPrivateKey', {
        privateKey: trimmed,
      });
      await SecureKeyStore.setPrivateKey(trimmed);
      console.log('[restore] Imported private key, publicKey:', result?.publicKey);
      reloadWebView();
      navigateToApp();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to import private key');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Wallet-file restore ─────────────────────────────────────────────

  const handlePickFile = async () => {
    try {
      const picked = await File.pickFileAsync(undefined, 'application/json');
      if (!picked) return;

      // pickFileAsync may return a single File or an array; normalise
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file) return;

      setFileName(Paths.basename(file.uri) || 'wallet.json');
      const content = await file.text();
      setFileContent(content);
    } catch (e: any) {
      // User cancelled the picker — not an error
      if (e?.message?.includes('cancel') || e?.code === 'ERR_CANCELED') return;
      Alert.alert('Error', 'Could not read file');
      console.error(e);
    }
  };

  const handleRestoreFile = async () => {
    if (!fileContent) {
      Alert.alert('No File', 'Please select a wallet JSON file first.');
      return;
    }

    // Quick validation
    try {
      const parsed = JSON.parse(fileContent);
      if (!parsed.wallet?.privateKey) {
        Alert.alert(
          'Invalid Wallet File',
          'The selected file does not contain a valid Saito wallet (missing wallet.privateKey).',
        );
        return;
      }
    } catch {
      Alert.alert('Invalid File', 'The selected file is not valid JSON.');
      return;
    }

    setLoading(true);
    try {
      if (!bridge) throw new Error('Bridge not ready');
      const result = await bridge.call<{ publicKey: string; privateKey: string }>(
        'wallet',
        'importWalletJSON',
        { json: fileContent },
      );
      await SecureKeyStore.setPrivateKey(result.privateKey);
      console.log('[restore] Imported wallet file, publicKey:', result.publicKey);
      reloadWebView();
      navigateToApp();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to import wallet file');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────

  const navigateToApp = () => {
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} message="Restoring wallet..." />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Restore Wallet</Text>

        {/* ── Method selector (segmented control) ── */}
        <View style={styles.segmented}>
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.segmentBtn, method === m.id && styles.segmentActive]}
              onPress={() => setMethod(m.id)}
            >
              <Text style={[styles.segmentText, method === m.id && styles.segmentTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Seed Phrase ── */}
        {method === 'phrase' && (
          <>
            <Text style={styles.subtitle}>
              Enter your 24-word recovery phrase, separated by spaces.
            </Text>
            <TextInput
              style={styles.inputMultiline}
              value={words}
              onChangeText={setWords}
              placeholder="Enter recovery phrase..."
              placeholderTextColor="#475569"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.btn, !words.trim() && styles.btnDisabled]}
              onPress={handleRestorePhrase}
              disabled={!words.trim()}
            >
              <Text style={styles.btnText}>Restore</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Private Key ── */}
        {method === 'key' && (
          <>
            <Text style={styles.subtitle}>
              Enter your 64-character hex private key to restore your account.
            </Text>
            <TextInput
              style={styles.inputSingle}
              value={privateKeyInput}
              onChangeText={setPrivateKeyInput}
              placeholder="Paste private key..."
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.btn, !privateKeyInput.trim() && styles.btnDisabled]}
              onPress={handleRestoreKey}
              disabled={!privateKeyInput.trim()}
            >
              <Text style={styles.btnText}>Restore</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Wallet File ── */}
        {method === 'file' && (
          <>
            <Text style={styles.subtitle}>
              Import a <Text style={styles.mono}>saito-wallet-*.json</Text> file previously
              exported from a Saito browser or this app.
            </Text>
            <TouchableOpacity style={styles.filePicker} onPress={handlePickFile}>
              <Text style={styles.filePickerText}>
                {fileName ? fileName : 'Choose wallet file...'}
              </Text>
            </TouchableOpacity>
            {fileName ? (
              <Text style={styles.fileHint}>File selected. Tap "Restore" to import.</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.btn, !fileContent && styles.btnDisabled]}
              onPress={handleRestoreFile}
              disabled={!fileContent}
            >
              <Text style={styles.btnText}>Restore</Text>
            </TouchableOpacity>
          </>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
  },
  mono: {
    fontFamily: 'Courier',
    color: '#e2e8f0',
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

  // ── Inputs ──
  inputMultiline: {
    backgroundColor: '#111827',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#1f2937',
    lineHeight: 24,
  },
  inputSingle: {
    backgroundColor: '#111827',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },

  // ── File picker ──
  filePicker: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  filePickerText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  fileHint: {
    color: '#22d3ee',
    fontSize: 13,
    textAlign: 'center',
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
