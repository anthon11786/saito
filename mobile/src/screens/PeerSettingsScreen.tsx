import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSaito } from '../hooks/useSaito';

type PeerConfig = {
  host: string;
  port: string;
  protocol: 'http' | 'https';
  isCustom: boolean;
};

export function PeerSettingsScreen() {
  const { bridge, status, reloadWebView } = useSaito();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [isCustom, setIsCustom] = useState(false);

  // Load current peer config from the bridge
  const loadConfig = useCallback(async () => {
    if (!bridge || status !== 'ready') return;
    setLoading(true);
    try {
      const config = await bridge.call<PeerConfig>('core', 'getPeerConfig');
      setHost(config.host || '');
      setPort(String(config.port || 12101));
      setProtocol(config.protocol === 'https' ? 'https' : 'http');
      setIsCustom(config.isCustom || false);
    } catch (e) {
      console.error('[PeerSettings] loadConfig error:', e);
    } finally {
      setLoading(false);
    }
  }, [bridge, status]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    if (!bridge) return;
    const trimmedHost = host.trim();
    if (!trimmedHost) {
      Alert.alert('Error', 'Host is required.');
      return;
    }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert('Error', 'Port must be a number between 1 and 65535.');
      return;
    }

    Alert.alert(
      'Save & Reconnect',
      `Connect to ${protocol}://${trimmedHost}:${portNum}?\n\nThe app will reconnect to the new peer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setSaving(true);
            try {
              await bridge.call('core', 'setPeerConfig', {
                host: trimmedHost,
                port: portNum,
                protocol,
              });
              setIsCustom(true);
              // Reload WebView to reconnect with the new peer
              reloadWebView();
              // Give it time to reconnect
              setTimeout(() => {
                setSaving(false);
                Alert.alert('Success', 'Peer updated. Reconnecting to the network...');
              }, 2000);
            } catch (e: any) {
              setSaving(false);
              Alert.alert('Error', e.message || 'Failed to save peer config.');
            }
          },
        },
      ],
    );
  }, [bridge, host, port, protocol, reloadWebView]);

  const handleReset = useCallback(async () => {
    if (!bridge) return;

    Alert.alert(
      'Reset to Default',
      'Revert to the default peer configured at build time?\n\nThe app will reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await bridge.call('core', 'resetPeerConfig');
              setIsCustom(false);
              // Reload to apply defaults
              reloadWebView();
              setTimeout(async () => {
                setSaving(false);
                await loadConfig();
                Alert.alert('Success', 'Reverted to default peer. Reconnecting...');
              }, 3000);
            } catch (e: any) {
              setSaving(false);
              Alert.alert('Error', e.message || 'Failed to reset peer config.');
            }
          },
        },
      ],
    );
  }, [bridge, reloadWebView, loadConfig]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading peer config...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Configure which Saito node this app connects to. A lite wallet connects
          to one node as its gateway to the network.
        </Text>

        {isCustom && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Custom peer configured</Text>
          </View>
        )}

        {/* Protocol Toggle */}
        <Text style={styles.label}>Protocol</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, protocol === 'http' && styles.toggleActive]}
            onPress={() => setProtocol('http')}
          >
            <Text
              style={[styles.toggleText, protocol === 'http' && styles.toggleTextActive]}
            >
              HTTP
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, protocol === 'https' && styles.toggleActive]}
            onPress={() => setProtocol('https')}
          >
            <Text
              style={[styles.toggleText, protocol === 'https' && styles.toggleTextActive]}
            >
              HTTPS
            </Text>
          </TouchableOpacity>
        </View>

        {/* Host */}
        <Text style={styles.label}>Host</Text>
        <TextInput
          style={styles.input}
          value={host}
          onChangeText={setHost}
          placeholder="e.g. saito.io or 192.168.1.100"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {/* Port */}
        <Text style={styles.label}>Port</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder="e.g. 12101 or 443"
          placeholderTextColor="#475569"
          keyboardType="number-pad"
        />

        {/* Preview */}
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Will connect to:</Text>
          <Text style={styles.previewUrl}>
            {protocol}://{host.trim() || '...'}:{port || '...'}
          </Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save & Reconnect'}
          </Text>
        </TouchableOpacity>

        {isCustom && (
          <TouchableOpacity
            style={[styles.resetBtn, saving && styles.btnDisabled]}
            onPress={handleReset}
            disabled={saving}
          >
            <Text style={styles.resetBtnText}>Reset to Default</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>
          Common configurations:{'\n'}
          {'\u2022'} Local dev: http://localhost:12101{'\n'}
          {'\u2022'} Production: https://saito.io:443{'\n'}
          {'\u2022'} LAN device: http://192.168.x.x:12101
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3b82f6',
  },
  toggleText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#3b82f6',
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 16,
  },
  previewBox: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    marginTop: 4,
  },
  previewLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  previewUrl: {
    color: '#e2e8f0',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  resetBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  hint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
});

