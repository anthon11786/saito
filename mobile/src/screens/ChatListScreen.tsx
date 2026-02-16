import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ChatGroupListItem } from '../components/ChatGroupListItem';
import { useChat } from '../hooks/useChat';
import type { ChatGroup } from '../types';

export function ChatListScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { groups } = useChat();
  const [refreshing, setRefreshing] = useState(false);

  const sortedGroups = [...groups].sort((a, b) => b.lastUpdate - a.lastUpdate);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Groups update via bridge events; pulling just pauses briefly
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  }, []);

  const openChat = (group: ChatGroup) => {
    navigation.navigate('Chat', { groupId: group.id, name: group.name });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatGroupListItem group={item} onPress={() => openChat(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e11d48"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a new chat to get going.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: '#1f2937',
    marginLeft: 76,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e11d48',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
});
