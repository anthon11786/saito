import * as SecureStore from 'expo-secure-store';

const PRIVATE_KEY_KEY = 'saito_wallet_private_key';

export async function setPrivateKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(PRIVATE_KEY_KEY, key, {
    requireAuthentication: true,
    authenticationPrompt: 'Authenticate to save your wallet key',
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getPrivateKey(): Promise<string | null> {
  return SecureStore.getItemAsync(PRIVATE_KEY_KEY, {
    requireAuthentication: true,
    authenticationPrompt: 'Authenticate to access your wallet',
  });
}

export async function hasPrivateKey(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(PRIVATE_KEY_KEY);
  return value !== null;
}

export async function deletePrivateKey(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_KEY);
}
