import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { ChatBubble } from '../components/ChatBubble';
import { ChatInput } from '../components/ChatInput';
import { useChat } from '../hooks/useChat';
import { useWallet } from '../hooks/useWallet';
import type { ChatMessage } from '../types';

type Props = {
  route: RouteProp<{ Chat: { groupId: string; name: string } }, 'Chat'>;
};

export function ChatScreen({ route }: Props) {
  const { groupId } = route.params;
  const { groups, sendMessage, markRead, getMessages, getOlderMessages } = useChat();
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList>(null);

  const group = groups.find((g) => g.id === groupId);

  useEffect(() => {
    async function load() {
      try {
        const msgs = await getMessages(groupId);
        setMessages(msgs);
      } catch (e) {
        console.error('[ChatScreen] load error:', e);
      }
    }
    load();
    markRead(groupId);
  }, [groupId, getMessages, markRead]);

  // Sync new messages from group state
  useEffect(() => {
    if (group) {
      setMessages(group.txs);
      markRead(groupId);
    }
  }, [group?.txs.length]);

  const handleSend = useCallback(
    async (text: string) => {
      try {
        await sendMessage(groupId, text);
      } catch (e) {
        console.error('[ChatScreen] send error:', e);
      }
    },
    [groupId, sendMessage],
  );

  const loadOlder = useCallback(async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    try {
      const older = await getOlderMessages(groupId, oldest.timestamp);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
      }
    } catch (e) {
      console.error('[ChatScreen] loadOlder error:', e);
    }
  }, [groupId, messages, getOlderMessages]);

  const reversed = [...messages].reverse();

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={reversed}
        keyExtractor={(item, index) => item.id || item.sig || `msg-${index}`}
        renderItem={({ item }) => (
          <ChatBubble message={item} isOwn={item.sender === publicKey} />
        )}
        inverted
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list}
      />
      <ChatInput onSend={handleSend} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  list: {
    paddingVertical: 8,
  },
});
