import React from 'react';
import { Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { useWallet } from '../hooks/useWallet';

export function ReceiveScreen() {
  const { publicKey } = useWallet();

  const copyKey = async () => {
    await Clipboard.setStringAsync(publicKey);
    Alert.alert('Copied', 'Public key copied to clipboard');
  };

  const shareKey = async () => {
    try {
      await Share.share({ message: publicKey });
    } catch {
      // user cancelled
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receive SAITO</Text>
      <Text style={styles.subtitle}>
        Share your public key or QR code to receive payments.
      </Text>

      <QRCodeDisplay value={publicKey} size={220} />

      <Text style={styles.key} selectable>{publicKey}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={copyKey}>
          <Text style={styles.btnText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={shareKey}>
          <Text style={styles.btnSecondaryText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  key: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Courier',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
});
