import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

type Props = {
  onRead: (value: string) => void;
  onClose: () => void;
};

export function QRCodeScanner({ onRead, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required to scan QR codes.</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          onRead(data);
        }}
        style={{ flex: 1 }}
      />
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 32,
  },
  closeButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  closeText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
});
