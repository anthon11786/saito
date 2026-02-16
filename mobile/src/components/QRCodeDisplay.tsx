import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  value: string;
  size?: number;
};

export function QRCodeDisplay({ value, size = 200 }: Props) {
  return (
    <View style={styles.container}>
      <QRCode
        value={value || ' '}
        size={size}
        backgroundColor="#111827"
        color="#f8fafc"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 16,
  },
});
