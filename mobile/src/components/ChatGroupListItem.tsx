import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ChatGroup } from '../types';
import { formatTimestamp, truncateKey } from '../utils/formatting';
import { UserAvatar } from './UserAvatar';

type Props = {
  group: ChatGroup;
  onPress: () => void;
};

export function ChatGroupListItem({ group, onPress }: Props) {
  const displayName = group.name || truncateKey(group.members[0] || '', 10);
  const lastMsg = group.txs[group.txs.length - 1];
  const preview = lastMsg?.message || 'No messages yet';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <UserAvatar publicKey={group.members[0] || group.id} size={48} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          {group.lastUpdate > 0 && (
            <Text style={styles.time}>{formatTimestamp(group.lastUpdate)}</Text>
          )}
        </View>
        <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
      </View>
      {group.unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{group.unread > 99 ? '99+' : group.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  time: {
    color: '#64748b',
    fontSize: 12,
  },
  preview: {
    color: '#94a3b8',
    fontSize: 14,
  },
  badge: {
    backgroundColor: '#e11d48',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
