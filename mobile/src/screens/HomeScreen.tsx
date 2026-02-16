import React, { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { useWallet } from '../hooks/useWallet';
import { truncateKey } from '../utils/formatting';

export function HomeScreen() {
  const { publicKey, balance, connected, refreshBalance } = useWallet();
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
  }, [refreshBalance]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" />
      }
    >
      <View style={styles.statusRow}>
        <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
        <Text style={styles.statusText}>
          {connected ? 'Connected' : 'Connecting...'}
        </Text>
      </View>

      <BalanceDisplay balance={balance} />

      {publicKey ? (
        <Text style={styles.pubkey}>{truncateKey(publicKey, 12)}</Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('HomeTab', { screen: 'Send' })}
        >
          <Text style={styles.actionIcon}>&#8593;</Text>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('HomeTab', { screen: 'Receive' })}
        >
          <Text style={styles.actionIcon}>&#8595;</Text>
          <Text style={styles.actionLabel}>Receive</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#22c55e',
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  pubkey: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Courier',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 6,
  },
  actionIcon: {
    color: '#e11d48',
    fontSize: 24,
    fontWeight: '700',
  },
  actionLabel: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
});
