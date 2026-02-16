import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  message?: string;
  visible: boolean;
};

export function LoadingOverlay({ message = 'Loading...', visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color="#e11d48" />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  box: {
    backgroundColor: '#111827',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
  },
  text: {
    color: '#e2e8f0',
    fontSize: 14,
  },
});
