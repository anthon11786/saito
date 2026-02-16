import { useCallback, useEffect, useState } from 'react';
import type { ChatGroup, ChatMessage } from '../types';
import { showChatNotification } from '../services/NotificationService';
import { useSaito } from './useSaito';

export function useChat() {
  const { bridge, status } = useSaito();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    if (status !== 'ready' || !bridge) return;

    let cancelled = false;

    async function loadGroups() {
      try {
        const result = await bridge!.call<ChatGroup[]>('chat', 'getGroups');
        if (!cancelled) {
          setGroups(result);
          setUnreadTotal(result.reduce((sum, g) => sum + g.unread, 0));
        }
      } catch (e) {
        console.error('[useChat] loadGroups error:', e);
      }
    }

    loadGroups();

    const unsubGroup = bridge.on('chat', 'group-updated', (data) => {
      if (cancelled) return;
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === data.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [data, ...prev];
      });
    });

    const unsubMessage = bridge.on('chat', 'new-message', (data) => {
      if (cancelled) return;
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === data.groupId) {
            return {
              ...g,
              txs: [...g.txs, data.message],
              unread: g.unread + 1,
              lastUpdate: data.message.timestamp,
            };
          }
          return g;
        }),
      );
      showChatNotification(
        data.message.sender,
        data.message.message,
        data.groupId,
      );
    });

    const unsubUnread = bridge.on('chat', 'unread-updated', (data) => {
      if (cancelled) return;
      setGroups((prev) =>
        prev.map((g) =>
          g.id === data.groupId ? { ...g, unread: data.count } : g,
        ),
      );
    });

    return () => {
      cancelled = true;
      unsubGroup();
      unsubMessage();
      unsubUnread();
    };
  }, [bridge, status]);

  useEffect(() => {
    setUnreadTotal(groups.reduce((sum, g) => sum + g.unread, 0));
  }, [groups]);

  const sendMessage = useCallback(
    async (groupId: string, message: string) => {
      if (!bridge) throw new Error('Bridge not ready');
      return bridge.call('chat', 'sendMessage', { groupId, message });
    },
    [bridge],
  );

  const createGroup = useCallback(
    async (members: string[], name?: string) => {
      if (!bridge) throw new Error('Bridge not ready');
      return bridge.call<string>('chat', 'createGroup', { members, name });
    },
    [bridge],
  );

  const markRead = useCallback(
    async (groupId: string) => {
      if (!bridge) throw new Error('Bridge not ready');
      await bridge.call('chat', 'markRead', { groupId });
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, unread: 0 } : g)),
      );
    },
    [bridge],
  );

  const getMessages = useCallback(
    async (groupId: string) => {
      if (!bridge) throw new Error('Bridge not ready');
      return bridge.call<ChatMessage[]>('chat', 'getMessages', { groupId });
    },
    [bridge],
  );

  const getOlderMessages = useCallback(
    async (groupId: string, beforeTimestamp: number) => {
      if (!bridge) throw new Error('Bridge not ready');
      return bridge.call<ChatMessage[]>('chat', 'getOlderMessages', {
        groupId,
        beforeTimestamp,
      });
    },
    [bridge],
  );

  return {
    groups,
    unreadTotal,
    sendMessage,
    createGroup,
    markRead,
    getMessages,
    getOlderMessages,
  };
}
