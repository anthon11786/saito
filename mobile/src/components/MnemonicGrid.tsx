import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  words: string[];
};

export function MnemonicGrid({ words }: Props) {
  return (
    <View style={styles.grid}>
      {words.map((word, i) => (
        <View key={i} style={styles.cell}>
          <Text style={styles.index}>{i + 1}</Text>
          <Text style={styles.word}>{word}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    width: '30%',
  },
  index: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
    minWidth: 16,
  },
  word: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
});
