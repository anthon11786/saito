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
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useChat } from '../hooks/useChat';
import { isValidPublicKey } from '../utils/validation';

type Props = {
  navigation: StackNavigationProp<any>;
};

export function NewChatScreen({ navigation }: Props) {
  const { createGroup } = useChat();
  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!isValidPublicKey(recipient)) {
      Alert.alert('Invalid Key', 'Please enter a valid public key.');
      return;
    }

    setLoading(true);
    try {
      const groupId = await createGroup([recipient]);
      navigation.replace('Chat', { groupId, name: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LoadingOverlay visible={loading} message="Creating chat..." />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>New Chat</Text>
        <Text style={styles.subtitle}>
          Enter the public key of the person you want to chat with.
        </Text>

        <AddressInput value={recipient} onChangeText={setRecipient} />

        <TouchableOpacity
          style={[styles.btn, !isValidPublicKey(recipient) && styles.btnDisabled]}
          onPress={handleStart}
          disabled={!isValidPublicKey(recipient)}
        >
          <Text style={styles.btnText}>Start Chat</Text>
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
