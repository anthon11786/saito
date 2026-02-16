import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { MnemonicGrid } from '../components/MnemonicGrid';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useSaito } from '../hooks/useSaito';
import * as SecureKeyStore from '../services/SecureKeyStore';
import { generateMnemonicFromKey } from '../services/MnemonicService';

type Props = {
  navigation: StackNavigationProp<any>;
};

export function CreateWalletScreen({ navigation }: Props) {
  const { bridge } = useSaito();
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function generate() {
      if (!bridge) return;
      try {
        const { privateKey } = await bridge.call<{
          publicKey: string;
          privateKey: string;
        }>('wallet', 'generateNewWallet');

        await SecureKeyStore.setPrivateKey(privateKey);
        const words = generateMnemonicFromKey(privateKey);
        setMnemonic(words.split(' '));
      } catch (e) {
        Alert.alert('Error', 'Failed to create wallet');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    generate();
  }, [bridge]);

  const handleContinue = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={loading} message="Creating wallet..." />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Your Recovery Phrase</Text>
        <Text style={styles.subtitle}>
          Write down these 24 words in order. You will need them to recover your
          wallet.
        </Text>

        {mnemonic.length > 0 && <MnemonicGrid words={mnemonic} />}

        <Text style={styles.warning}>
          Never share your recovery phrase. Anyone with these words can access
          your wallet.
        </Text>

        <TouchableOpacity style={styles.btn} onPress={handleContinue}>
          <Text style={styles.btnText}>I've saved my recovery phrase</Text>
        </TouchableOpacity>
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
  warning: {
    fontSize: 13,
    color: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 12,
    borderRadius: 10,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: '#e11d48',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
