import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AddressInput } from '../components/AddressInput';
import { AmountInput } from '../components/AmountInput';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useWallet } from '../hooks/useWallet';
import { nolanToSaito, saitoToNolan } from '../utils/formatting';
import { isValidPublicKey, isValidAmount } from '../utils/validation';

type Props = {
  navigation: StackNavigationProp<any>;
};

export function SendScreen({ navigation }: Props) {
  const { balance, sendTransaction } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const canSend =
    isValidPublicKey(recipient) &&
    isValidAmount(amount) &&
    !sending;

  const handleSend = async () => {
    if (!canSend) return;

    const nolan = saitoToNolan(amount);

    Alert.alert(
      'Confirm Transaction',
      `Send ${amount} SAITO to ${recipient.slice(0, 12)}...?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              await sendTransaction(recipient, nolan);
              Alert.alert('Sent', 'Transaction broadcast successfully.');
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Transaction failed');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LoadingOverlay visible={sending} message="Sending..." />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Recipient</Text>
        <AddressInput value={recipient} onChangeText={setRecipient} />

        <Text style={[styles.label, { marginTop: 20 }]}>Amount</Text>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          balance={nolanToSaito(balance)}
        />

        <TouchableOpacity
          style={[styles.btn, !canSend && styles.btnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Text style={styles.btnText}>Send SAITO</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    padding: 24,
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  btn: {
    backgroundColor: '#e11d48',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
