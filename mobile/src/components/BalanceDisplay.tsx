import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { nolanToSaito } from '../utils/formatting';

type Props = {
  balance: string;
};

export function BalanceDisplay({ balance }: Props) {
  const saito = nolanToSaito(balance);

  return (
    <View style={styles.container}>
      <Text style={styles.amount}>{saito}</Text>
      <Text style={styles.label}>SAITO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  amount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#f8fafc',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 4,
  },
});
