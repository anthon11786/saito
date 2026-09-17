export class EncryptionFailedError extends Error {
  constructor(publicKey: string) {
    super(`Relay: could not encrypt message for ${publicKey} — refusing to send in plaintext`);
    this.name = 'EncryptionFailedError';
  }
}

/**
 * keychain.encryptMessage() fails open: when no key is available it warns
 * to the console and returns the exact `msg` value it was given, unchanged,
 * rather than refusing to send. Its success path always returns a freshly
 * computed ciphertext string (JSON.stringify + aesEncrypt) that can never
 * equal the input it was derived from. So `result === msg` is the signal
 * that encryption silently didn't happen — this holds whether msg is a
 * string or an object, unlike a typeof check, which breaks when msg is
 * already a plain string (fail-open then also "looks like" a string).
 * Relay must never transmit that — fail closed instead.
 */
export async function encryptMessageOrThrow(app: any, publicKey: string, msg: unknown): Promise<string> {
  const result = await app.keychain.encryptMessage(publicKey, msg);
  if (result === msg || typeof result !== 'string') {
    throw new EncryptionFailedError(publicKey);
  }
  return result;
}
