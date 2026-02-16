import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';

export function generateMnemonicFromKey(privateKeyHex: string): string {
  const entropy = Buffer.from(privateKeyHex, 'hex');
  return entropyToMnemonic(entropy);
}

export function getPrivateKeyFromMnemonic(mnemonic: string): string {
  return mnemonicToEntropy(mnemonic);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic);
}
