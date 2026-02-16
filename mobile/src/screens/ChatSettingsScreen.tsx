import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { UserAvatar } from '../components/UserAvatar';
import { useChat } from '../hooks/useChat';
import { truncateKey } from '../utils/formatting';

type Props = {
  route: RouteProp<{ ChatSettings: { groupId: string } }, 'ChatSettings'>;
};

export function ChatSettingsScreen({ route }: Props) {
  const { groupId } = route.params;
  const { groups } = useChat();
  const group = groups.find((g) => g.id === groupId);

  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Group not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{group.name || 'Chat'}</Text>
      <Text style={styles.subtitle}>{group.members.length} members</Text>

      <Text style={styles.sectionTitle}>Members</Text>
      <FlatList
        data={group.members}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <UserAvatar publicKey={item} size={36} />
            <Text style={styles.memberKey}>{truncateKey(item, 10)}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  memberKey: {
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'Courier',
  },
  separator: {
    height: 1,
    backgroundColor: '#1f2937',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
