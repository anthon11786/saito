import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { isValidAmount } from '../utils/validation';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  balance?: string;
};

export function AmountInput({ value, onChangeText, balance }: Props) {
  const isValid = value === '' || isValidAmount(value);

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, !isValid && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          placeholder="0.00"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
        <Text style={styles.suffix}>SAITO</Text>
      </View>
      {balance && (
        <Text style={styles.available}>Available: {balance} SAITO</Text>
      )}
      {!isValid && value !== '' && (
        <Text style={styles.error}>Invalid amount</Text>
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
    fontSize: 18,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  suffix: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  available: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});
