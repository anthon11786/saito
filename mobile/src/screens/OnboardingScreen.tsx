import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';

type Props = {
  navigation: StackNavigationProp<any>;
};

export function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>SAITO</Text>
        <Text style={styles.tagline}>
          Peer-to-peer blockchain, in your pocket.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('CreateWallet')}
        >
          <Text style={styles.primaryText}>Create New Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Restore')}
        >
          <Text style={styles.secondaryText}>Restore from Backup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'space-between',
    padding: 24,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#e11d48',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    paddingBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#e11d48',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#1f2937',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '600',
  },
});
