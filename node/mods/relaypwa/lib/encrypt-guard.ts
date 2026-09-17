export class EncryptionFailedError extends Error {
  constructor(publicKey: string) {
    super(`Relay: could not encrypt message for ${publicKey} — refusing to send in plaintext`);
    this.name = 'EncryptionFailedError';
  }
}

/**
 * keychain.encryptMessage() fails open: when no key is available it warns
 * to the console and returns the original message object unchanged rather
 * than refusing to send. Its success path always returns a ciphertext
 * string (JSON.stringify + aesEncrypt), so a non-string result is the
 * signal that encryption silently didn't happen. Relay must never
 * transmit that — fail closed instead.
 */
export async function encryptMessageOrThrow(app: any, publicKey: string, msg: unknown): Promise<string> {
  const result = await app.keychain.encryptMessage(publicKey, msg);
  if (typeof result !== 'string') {
    throw new EncryptionFailedError(publicKey);
  }
  return result;
}
