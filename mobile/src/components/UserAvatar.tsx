import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  publicKey: string;
  size?: number;
};

function keyToColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 45%)`;
}

export function UserAvatar({ publicKey, size = 40 }: Props) {
  const initials = publicKey.slice(0, 2).toUpperCase();
  const bg = keyToColor(publicKey);

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#f8fafc',
    fontWeight: '700',
  },
});
