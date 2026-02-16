import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../types';
import { formatTimestamp, truncateKey } from '../utils/formatting';

type Props = {
  message: ChatMessage;
  isOwn: boolean;
};

export function ChatBubble({ message, isOwn }: Props) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn && (
          <Text style={styles.sender}>{truncateKey(message.sender, 6)}</Text>
        )}
        <Text style={styles.text}>{message.message}</Text>
        <Text style={styles.time}>{formatTimestamp(message.timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 12,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleOwn: {
    backgroundColor: '#e11d48',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1f2937',
    borderBottomLeftRadius: 4,
  },
  sender: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  text: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    color: 'rgba(248,250,252,0.5)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
