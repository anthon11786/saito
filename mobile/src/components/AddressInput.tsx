import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { isValidPublicKey } from '../utils/validation';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onScanQR?: () => void;
};

export function AddressInput({ value, onChangeText, onScanQR }: Props) {
  const [touched, setTouched] = useState(false);
  const isValid = !touched || value === '' || isValidPublicKey(value);

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) onChangeText(text.trim());
  };

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, !isValid && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => setTouched(true)}
          placeholder="Recipient public key"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={pasteFromClipboard}>
          <Text style={styles.actionText}>Paste</Text>
        </TouchableOpacity>
        {onScanQR && (
          <TouchableOpacity style={styles.actionBtn} onPress={onScanQR}>
            <Text style={styles.actionText}>Scan QR</Text>
          </TouchableOpacity>
        )}
      </View>
      {!isValid && (
        <Text style={styles.error}>Invalid public key</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0b1224',
    color: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});
